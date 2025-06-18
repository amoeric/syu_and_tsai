# Google Photos 圖片上傳器

一個現代化的 Web 應用程式，讓使用者可以輕鬆地將圖片上傳到 Google Photos。

## 功能特色

- 🖼️ **拖拽上傳**: 支援拖拽圖片檔案到頁面上傳
- 📱 **響應式設計**: 支援桌面和行動裝置
- 🔐 **Google OAuth**: 安全的 Google 帳號授權
- 📊 **上傳進度**: 即時顯示上傳進度和結果
- 🎨 **現代化 UI**: 美觀的使用者介面
- 🔗 **直接連結**: 上傳完成後提供 Google Photos 連結

## 安裝步驟

### 1. 克隆專案
```bash
git clone <repository-url>
cd upload_to_google_photos
```

### 2. 安裝依賴
```bash
npm install
```

### 3. 設定 Google Photos API

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Photos Library API
4. 建立 OAuth 2.0 憑證
5. 將授權重新導向 URI 設為 `http://localhost:7700/auth/callback`

### 4. 環境變數設定

複製 `.env.example` 為 `.env` 並填入你的 Google API 憑證：

```bash
cp .env.example .env
```

編輯 `.env` 檔案：
```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:7700/auth/callback
PORT=7700
```

### 5. 啟動應用程式

```bash
# 開發模式
npm run dev

# 生產模式
npm start
```

應用程式將在 `http://localhost:7700` 上運行。

## 使用方法

1. **授權**: 首次使用需要授權應用程式存取你的 Google Photos
2. **選擇圖片**: 點擊選擇檔案或直接拖拽圖片到上傳區域
3. **上傳**: 點擊上傳按鈕開始上傳到 Google Photos
4. **查看結果**: 上傳完成後可以直接連結到 Google Photos 查看

## 支援的檔案格式

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- 其他瀏覽器支援的圖片格式

## 技術架構

### 後端
- **Node.js** + **Express**: Web 服務器
- **Multer**: 檔案上傳處理
- **Google APIs**: Google Photos API 整合
- **dotenv**: 環境變數管理

### 前端
- **HTML5**: 語義化標記
- **CSS3**: 現代化樣式和動畫
- **JavaScript**: 拖拽上傳和 API 通訊
- **Font Awesome**: 圖示庫

## 專案結構

```
upload_to_google_photos/
├── public/
│   ├── index.html      # 主頁面
│   ├── style.css       # 樣式檔案
│   └── script.js       # 前端邏輯
├── uploads/            # 臨時上傳目錄
├── server.js           # Express 服務器
├── package.json        # 依賴管理
├── .env.example        # 環境變數範例
└── README.md          # 說明文件
```

## 安全注意事項

- 不要將 `.env` 檔案提交到版本控制
- 定期更新 Google API 憑證
- 考慮實作使用者認證系統
- 在生產環境中使用 HTTPS

## 故障排除

### 常見問題

1. **授權失敗**
   - 檢查 Google Cloud Console 中的 OAuth 設定
   - 確認重新導向 URI 正確

2. **上傳失敗**
   - 檢查網路連線
   - 確認 Google Photos API 配額

3. **檔案大小限制**
   - 預設檔案大小限制為 100MB
   - 可在 `server.js` 中調整 `multer` 設定

## 開發

### 開發模式
```bash
npm run dev
```

### 偵錯
- 檢查瀏覽器控制台錯誤
- 查看服務器日誌輸出
- 使用 Google Cloud Console 監控 API 使用

## 授權

MIT License - 詳見 LICENSE 檔案

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 作者

- 開發者: 你的名字
- Email: your.email@example.com 