const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7700;

// 初始化資料庫
const db = new Database('wedding_messages.db');

// 建立留言表格
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT (datetime('now', '+8 hours')),
    gradient TEXT NOT NULL,
    avatar TEXT
  )
`);

// 建立使用者頭像表格
db.exec(`
  CREATE TABLE IF NOT EXISTS user_avatars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    avatar TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
  )
`);

console.log('📊 資料庫初始化完成');

// 中間件
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('images')); // 提供頭像圖片訪問
app.use(express.urlencoded({ extended: true }));

// 配置 multer 用於檔案上傳
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB 限制
  fileFilter: (req, file, cb) => {
    // 只允許圖片檔案
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳圖片檔案！'), false);
    }
  }
});

// Google Photos API 設定
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 設定 access token
if (process.env.GOOGLE_ACCESS_TOKEN) {
  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
}

// 路由：首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：Google OAuth 授權
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/photoslibrary.appendonly',
      'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata'
    ],
    prompt: 'consent', // 強制顯示同意畫面以取得 refresh_token
    include_granted_scopes: true
  });
  
  console.log('🔐 開始 OAuth 授權流程...');
  console.log('🔍 請求的權限範圍:');
  console.log('  - photoslibrary.appendonly (上傳 & 建立相簿)');
  console.log('  - photoslibrary.readonly.appcreateddata (讀取應用建立的內容)');
  console.log('重新導向到:', authUrl);
  
  res.redirect(authUrl);
});

// 路由：OAuth 回調
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error('❌ 授權被拒絕:', error);
    return res.redirect('/?auth=error');
  }
  
  if (!code) {
    console.error('❌ 授權回調中沒有 code 參數');
    return res.redirect('/?auth=error');
  }
  
  console.log('🔄 收到授權碼，開始交換 tokens...');
  
  try {
    // 使用 HTTP 請求直接交換 tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenParams = new URLSearchParams({
      code: code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:7700/auth/callback',
      grant_type: 'authorization_code'
    });
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }
    
    const tokens = await response.json();
    
    if (!tokens.access_token) {
      throw new Error('未能從 Google 取得 access_token');
    }
    
    // 設定到全域 OAuth 客戶端
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type || 'Bearer',
      expires_in: tokens.expires_in
    });
    
    // 清除相簿快取，因為可能是不同的使用者
    cachedAlbumId = null;
    
    // 記錄成功訊息
    console.log('🎉 授權成功！');
    console.log('  Access Token:', tokens.access_token ? '✅ 已取得' : '❌ 未取得');
    console.log('  Refresh Token:', tokens.refresh_token ? '✅ 已取得' : '❌ 未取得');
    console.log('  Token Type:', tokens.token_type || 'Bearer');
    console.log('  Expires In:', tokens.expires_in || 'N/A');
    
    res.redirect('/?auth=success');
  } catch (error) {
    console.error('❌ 授權失敗:', error.message);
    console.error('詳細錯誤:', error);
    res.redirect('/?auth=error');
  }
});

// 路由：上傳圖片到 Google Photos
app.post('/upload', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '請選擇要上傳的圖片' });
    }

    console.log(`📤 開始上傳 ${req.files.length} 張圖片...`);
    const uploadResults = [];

    for (const file of req.files) {
      try {
        console.log(`🔄 處理圖片: ${file.originalname}`);
        
        // 讀取檔案
        const imageBuffer = fs.readFileSync(file.path);
        
        // 步驟 1: 上傳圖片資料到 Google Photos
        const uploadToken = await uploadMediaItem(imageBuffer, file.originalname);
        
        // 步驟 2: 建立媒體項目（上傳到指定相簿）
        const mediaResponse = await createMediaItem(uploadToken, file.originalname);
        
        uploadResults.push({
          filename: file.originalname,
          status: 'success',
          googlePhotosUrl: mediaResponse.productUrl,
          mediaItemId: mediaResponse.id
        });

        console.log(`✅ ${file.originalname} 上傳成功`);

        // 清理臨時檔案
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error(`❌ 上傳 ${file.originalname} 失敗:`, error.message);
        uploadResults.push({
          filename: file.originalname,
          status: 'error',
          error: error.message
        });
        
        // 清理臨時檔案
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    console.log(`🎉 上傳完成！成功: ${uploadResults.filter(r => r.status === 'success').length}，失敗: ${uploadResults.filter(r => r.status === 'error').length}`);
    res.json({ results: uploadResults });
  } catch (error) {
    console.error('❌ 上傳錯誤:', error);
    res.status(500).json({ error: '上傳失敗: ' + error.message });
  }
});

// 輔助函數：上傳媒體項目到 Google Photos
async function uploadMediaItem(imageBuffer, filename) {
  try {
    console.log(`  📡 上傳圖片資料: ${filename}`);
    
    const response = await oauth2Client.request({
      method: 'POST',
      url: 'https://photoslibrary.googleapis.com/v1/uploads',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-File-Name': filename,
        'X-Goog-Upload-Protocol': 'raw'
      },
      body: imageBuffer
    });
    
    if (!response.data) {
      throw new Error('未收到上傳 token');
    }
    
    console.log(`  ✅ 圖片資料上傳成功，取得 token`);
    return response.data;
  } catch (error) {
    console.error(`  ❌ 媒體項目上傳失敗:`, error.message);
    throw new Error(`媒體項目上傳失敗: ${error.message}`);
  }
}

// 指定的婚禮相簿名稱
const WEDDING_ALBUM_NAME = '0629婚禮';

// 快取相簿 ID，避免重複查詢
let cachedAlbumId = null;

// 輔助函數：尋找或建立婚禮相簿
async function findOrCreateWeddingAlbum() {
  try {
    // 如果已經有快取的相簿 ID，直接返回
    if (cachedAlbumId) {
      console.log(`📁 使用快取的相簿 ID: ${cachedAlbumId}`);
      return cachedAlbumId;
    }
    
    console.log(`🔍 尋找相簿: ${WEDDING_ALBUM_NAME}`);
    
    // 先嘗試尋找現有相簿
    const albumsResponse = await oauth2Client.request({
      method: 'GET',
      url: 'https://photoslibrary.googleapis.com/v1/albums',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const albums = albumsResponse.data.albums || [];
    const existingAlbum = albums.find(album => album.title === WEDDING_ALBUM_NAME);
    
    if (existingAlbum) {
      console.log(`📁 找到現有相簿: ${WEDDING_ALBUM_NAME} (ID: ${existingAlbum.id})`);
      cachedAlbumId = existingAlbum.id; // 快取相簿 ID
      return existingAlbum.id;
    }
    
    // 如果沒有找到，建立新相簿
    console.log(`📁 建立新相簿: ${WEDDING_ALBUM_NAME}`);
    const createResponse = await oauth2Client.request({
      method: 'POST',
      url: 'https://photoslibrary.googleapis.com/v1/albums',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        album: {
          title: WEDDING_ALBUM_NAME
        }
      })
    });
    
    console.log(`✅ 成功建立相簿: ${WEDDING_ALBUM_NAME} (ID: ${createResponse.data.id})`);
    cachedAlbumId = createResponse.data.id; // 快取新建立的相簿 ID
    return createResponse.data.id;
    
  } catch (error) {
    console.error(`❌ 相簿操作失敗:`, error.message);
    console.log(`📤 將上傳到 Google Photos 主頁面`);
    // 如果相簿操作失敗，返回 null，照片會上傳到主頁面
    return null;
  }
}

// 輔助函數：建立媒體項目
async function createMediaItem(uploadToken, filename) {
  try {
    // 取得婚禮相簿 ID
    const albumId = await findOrCreateWeddingAlbum();
    
    console.log(`  🔧 建立媒體項目: ${filename}${albumId ? ` (相簿: ${WEDDING_ALBUM_NAME})` : ' (主頁面)'}`);
    
    const requestBody = {
      newMediaItems: [
        {
          description: `婚禮照片 - 上傳於 ${new Date().toLocaleString('zh-TW')}`,
          simpleMediaItem: {
            uploadToken: uploadToken,
            fileName: filename
          }
        }
      ]
    };
    
    // 如果有相簿 ID，則指定上傳到該相簿
    if (albumId) {
      requestBody.albumId = albumId;
    }
    
    const response = await oauth2Client.request({
      method: 'POST',
      url: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.data || !response.data.newMediaItemResults || response.data.newMediaItemResults.length === 0) {
      throw new Error('建立媒體項目失敗：無回應資料');
    }
    
    const result = response.data.newMediaItemResults[0];
    
    if (result.status && result.status.message !== 'Success') {
      throw new Error(`建立媒體項目失敗：${result.status.message}`);
    }
    
    if (!result.mediaItem) {
      throw new Error('建立媒體項目失敗：未返回媒體項目');
    }
    
    console.log(`  ✅ 媒體項目建立成功${albumId ? ` (已加入 ${WEDDING_ALBUM_NAME} 相簿)` : ''}`);
    return result.mediaItem;
  } catch (error) {
    console.error(`  ❌ 建立媒體項目失敗:`, error.message);
    throw new Error(`建立媒體項目失敗: ${error.message}`);
  }
}

// 隨機漸變背景
const gradients = [
  'from-rose-50 to-pink-50',
  'from-purple-50 to-blue-50',
  'from-green-50 to-teal-50',
  'from-yellow-50 to-orange-50',
  'from-indigo-50 to-purple-50',
  'from-pink-50 to-rose-50'
];

// 取得所有可用的頭像
function getAvailableAvatars() {
  const avatarsDir = path.join(__dirname, 'images', 'avatars');
  try {
    const files = fs.readdirSync(avatarsDir);
    return files
      .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
      .map(file => `images/avatars/${file}`);
  } catch (error) {
    console.error('❌ 讀取頭像資料夾失敗:', error);
    return [];
  }
}

// 為使用者分配頭像
function assignAvatarToUser(userName) {
  const availableAvatars = getAvailableAvatars();
  if (availableAvatars.length === 0) {
    return null;
  }
  
  // 使用使用者名稱作為種子來產生一致的隨機數
  let hash = 0;
  for (let i = 0; i < userName.length; i++) {
    const char = userName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 轉換為 32 位整數
  }
  
  const index = Math.abs(hash) % availableAvatars.length;
  return availableAvatars[index];
}

// 取得或建立使用者頭像
function getUserAvatar(userName) {
  const selectUserAvatar = db.prepare('SELECT avatar FROM user_avatars WHERE name = ?');
  const insertUserAvatar = db.prepare('INSERT INTO user_avatars (name, avatar) VALUES (?, ?)');
  
  // 先檢查是否已有頭像
  const existingAvatar = selectUserAvatar.get(userName);
  if (existingAvatar) {
    return existingAvatar.avatar;
  }
  
  // 分配新頭像
  const newAvatar = assignAvatarToUser(userName);
  if (newAvatar) {
    try {
      insertUserAvatar.run(userName, newAvatar);
      return newAvatar;
    } catch (error) {
      console.error('❌ 儲存使用者頭像失敗:', error);
    }
  }
  
  return null;
}

// 準備資料庫語句
const insertMessage = db.prepare('INSERT INTO messages (name, message, gradient, timestamp, avatar) VALUES (?, ?, ?, ?, ?)');
const selectAllMessages = db.prepare('SELECT * FROM messages ORDER BY timestamp DESC');
const selectMessagesWithLimit = db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ? OFFSET ?');
const countMessages = db.prepare('SELECT COUNT(*) as total FROM messages');

// 路由：取得留言（支援分頁）
app.get('/messages', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    
    const messages = selectMessagesWithLimit.all(limit, offset);
    const totalCount = countMessages.get().total;
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;
    
    res.json({ 
      messages,
      pagination: {
        currentPage: page,
        limit,
        total: totalCount,
        totalPages,
        hasMore
      }
    });
  } catch (error) {
    console.error('❌ 取得留言失敗:', error);
    res.status(500).json({ error: '取得留言失敗' });
  }
});

// 路由：新增留言
app.post('/messages', (req, res) => {
  try {
    const { name, message } = req.body;
    
    if (!name || !message) {
      return res.status(400).json({ error: '姓名和留言內容都是必填的' });
    }
    
    if (message.length > 500) {
      return res.status(400).json({ error: '留言內容不能超過 500 字' });
    }
    
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    const selectedGradient = gradients[Math.floor(Math.random() * gradients.length)];
    
    // 取得使用者頭像
    const userAvatar = getUserAvatar(trimmedName);
    
    // 產生 UTC+8 時間
    const now = new Date();
    const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const timestamp = utc8Time.toISOString().replace('T', ' ').slice(0, 19);
    
    // 插入到資料庫
    const result = insertMessage.run(trimmedName, trimmedMessage, selectedGradient, timestamp, userAvatar);
    
    const newMessage = {
      id: result.lastInsertRowid,
      name: trimmedName,
      message: trimmedMessage,
      timestamp: timestamp,
      gradient: selectedGradient,
      avatar: userAvatar
    };
    
    console.log(`💌 新留言來自 ${newMessage.name}: ${newMessage.message.substring(0, 50)}...`);
    
    res.json({ 
      success: true, 
      message: '留言已成功送出！',
      data: newMessage 
    });
  } catch (error) {
    console.error('❌ 留言錯誤:', error);
    res.status(500).json({ error: '留言失敗，請稍後再試' });
  }
});

// 路由：取得相簿預覽
app.get('/album-preview', async (req, res) => {
  try {
    console.log('🖼️ 開始載入相簿預覽...');
    
    // 檢查是否已授權
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      console.log('❌ 未授權，返回空相簿');
      return res.json({ photos: [], albumUrl: null });
    }
    
    // 建立 Google Photos API 客戶端（使用直接的 HTTP 請求）
    const accessToken = oauth2Client.credentials.access_token;
    
    let albumId = cachedAlbumId;
    let albumUrl = null;
    
    // 如果沒有快取的相簿 ID，嘗試找到婚禮相簿
    if (!albumId) {
      try {
        const albumsResponse = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!albumsResponse.ok) {
          throw new Error(`HTTP ${albumsResponse.status}: ${albumsResponse.statusText}`);
        }
        
        const albumsData = await albumsResponse.json();
        const albums = albumsData.albums || [];
        const weddingAlbum = albums.find(album => album.title === WEDDING_ALBUM_NAME);
        
        if (weddingAlbum) {
          albumId = weddingAlbum.id;
          cachedAlbumId = albumId;
          albumUrl = weddingAlbum.productUrl;
          console.log(`✅ 找到婚禮相簿: ${WEDDING_ALBUM_NAME}`);
        } else {
          console.log('❌ 未找到婚禮相簿');
          return res.json({ photos: [], albumUrl: null });
        }
      } catch (error) {
        console.error('❌ 列出相簿失敗:', error.message);
        return res.json({ photos: [], albumUrl: null });
      }
    }
    
    // 取得相簿中的照片（最新5張）
    try {
      const searchResponse = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          albumId: albumId,
          pageSize: 50,  // 先取得更多照片以便排序
          orderBy: 'MediaMetadata.creation_time desc'  // 按建立時間降序排列（最新的在前）
        })
      });
      
      if (!searchResponse.ok) {
        throw new Error(`HTTP ${searchResponse.status}: ${searchResponse.statusText}`);
      }
      
      const searchData = await searchResponse.json();
      const mediaItems = searchData.mediaItems || [];
      console.log(`📸 找到 ${mediaItems.length} 張照片`);
      
      // 按建立時間排序（最新的在前）並只取前5張
      const sortedItems = mediaItems
        .sort((a, b) => {
          const timeA = new Date(a.mediaMetadata?.creationTime || 0);
          const timeB = new Date(b.mediaMetadata?.creationTime || 0);
          return timeB - timeA; // 降序排列（最新的在前）
        })
        .slice(0, 5); // 只取前5張
      
      console.log(`📸 取得最新 ${sortedItems.length} 張照片`);
      
      // 處理照片資料
      const photos = sortedItems.map(item => ({
        id: item.id,
        filename: item.filename,
        thumbnailUrl: `${item.baseUrl}=w400-h400-c`, // 400x400 縮圖
        fullUrl: `${item.baseUrl}=w1920-h1080`, // 較大尺寸
        mimeType: item.mimeType,
        creationTime: item.mediaMetadata?.creationTime
      }));
      
      // 如果還沒有相簿 URL，嘗試從相簿資訊中取得
      if (!albumUrl && albumId) {
        try {
          const albumResponse = await fetch(`https://photoslibrary.googleapis.com/v1/albums/${albumId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (albumResponse.ok) {
            const albumData = await albumResponse.json();
            albumUrl = albumData.productUrl;
          }
        } catch (error) {
          console.log('⚠️ 無法取得相簿 URL:', error.message);
        }
      }
      
      console.log('✅ 相簿預覽載入成功');
      res.json({ 
        photos: photos,
        albumUrl: albumUrl,
        albumName: WEDDING_ALBUM_NAME
      });
      
    } catch (error) {
      console.error('❌ 搜尋相簿照片失敗:', error.message);
      res.json({ photos: [], albumUrl: albumUrl });
    }
    
  } catch (error) {
    console.error('❌ 載入相簿預覽失敗:', error);
    res.status(500).json({ error: '載入相簿預覽失敗' });
  }
});

// 路由：檢查授權狀態
app.get('/auth-status', (req, res) => {
  const isAuthenticated = oauth2Client.credentials && oauth2Client.credentials.access_token;
  res.json({ authenticated: !!isAuthenticated });
});

app.listen(PORT, () => {
  console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
  console.log('📊 環境變數檢查:');
  console.log('  CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ 已設定' : '❌ 未設定');
  console.log('  CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ 已設定' : '❌ 未設定');
  console.log('  REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || 'http://localhost:7700/auth/callback');
  console.log('');
  console.log('📝 請前往 http://localhost:7700 開始使用');
  console.log('🔐 首次使用需要 Google 授權');
});

// 優雅關閉資料庫連接
process.on('SIGINT', () => {
  console.log('\n🔄 正在關閉服務器...');
  db.close();
  console.log('✅ 資料庫連接已關閉');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 正在關閉服務器...');
  db.close();
  console.log('✅ 資料庫連接已關閉');
  process.exit(0);
}); 