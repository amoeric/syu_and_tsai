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
    gradient TEXT NOT NULL
  )
`);

console.log('📊 資料庫初始化完成');

// 中間件
app.use(express.json());
app.use(express.static('public'));
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
      'https://www.googleapis.com/auth/photoslibrary',
      'https://www.googleapis.com/auth/photoslibrary.appendonly'
    ],
    prompt: 'consent', // 強制顯示同意畫面以取得 refresh_token
    include_granted_scopes: true
  });
  
  console.log('🔐 開始 OAuth 授權流程...');
  console.log('🔍 請求的權限範圍:');
  console.log('  - photoslibrary (讀取)');
  console.log('  - photoslibrary.appendonly (上傳)');
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
        
        // 步驟 2: 建立媒體項目
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

// 輔助函數：建立媒體項目
async function createMediaItem(uploadToken, filename) {
  try {
    console.log(`  🔧 建立媒體項目: ${filename}`);
    
    const response = await oauth2Client.request({
      method: 'POST',
      url: 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        newMediaItems: [
          {
            description: `上傳於 ${new Date().toLocaleString('zh-TW')}`,
            simpleMediaItem: {
              uploadToken: uploadToken,
              fileName: filename
            }
          }
        ]
      })
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
    
    console.log(`  ✅ 媒體項目建立成功`);
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

// 準備資料庫語句
const insertMessage = db.prepare('INSERT INTO messages (name, message, gradient, timestamp) VALUES (?, ?, ?, ?)');
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
    
    // 產生 UTC+8 時間
    const now = new Date();
    const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const timestamp = utc8Time.toISOString().replace('T', ' ').slice(0, 19);
    
    // 插入到資料庫
    const result = insertMessage.run(trimmedName, trimmedMessage, selectedGradient, timestamp);
    
    const newMessage = {
      id: result.lastInsertRowid,
      name: trimmedName,
      message: trimmedMessage,
      timestamp: timestamp,
      gradient: selectedGradient
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