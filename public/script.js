let selectedFiles = [];

// 分頁變數
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let allMessages = [];

// 頁面載入時檢查授權狀態
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
    setupMessageForm();
    setupInfiniteScroll();
    loadMessages();
    loadAlbumPreview();
    initSlideshow();
});

// 檢查授權狀態
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth-status');
        const data = await response.json();
        
        if (data.authenticated) {
            showUploadSection();
        } else {
            showAuthSection();
        }
    } catch (error) {
        console.error('檢查授權狀態失敗:', error);
        showAuthSection();
    }
}

// 顯示授權區塊
function showAuthSection() {
    document.getElementById('authSection').classList.remove('hidden');
    document.querySelector('.upload-section').classList.add('hidden');
}

// 顯示上傳區塊
function showUploadSection() {
    document.getElementById('authSection').classList.add('hidden');
    document.querySelector('.upload-section').classList.remove('hidden');
}

// 授權函數
function authenticate() {
    window.location.href = '/auth';
}

// 設定事件監聽器
function setupEventListeners() {
    console.log('設置事件監聽器...');
    
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const authBtn = document.getElementById('authBtn');
    const uploadBtn = document.getElementById('uploadBtn');

    console.log('DOM 元素檢查:');
    console.log('uploadArea:', uploadArea);
    console.log('fileInput:', fileInput);
    console.log('authBtn:', authBtn);
    console.log('uploadBtn:', uploadBtn);

    // 授權按鈕事件
    if (authBtn) {
        authBtn.addEventListener('click', authenticate);
        console.log('授權按鈕事件已設置');
    }

    // 上傳按鈕事件
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadFiles);
        console.log('上傳按鈕事件已設置');
    }

    // 檔案選擇事件
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
        console.log('檔案選擇事件已設置');
        
        // 測試檔案輸入是否正常工作
        fileInput.addEventListener('click', () => {
            console.log('檔案輸入被點擊');
        });
    } else {
        console.error('找不到檔案輸入元素！');
    }

    // 拖拽區域事件
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            console.log('上傳區域被點擊:', e.target);
            // 避免與按鈕衝突
            if (!e.target.closest('.select-btn')) {
                if (fileInput) {
                    console.log('觸發檔案選擇對話框');
                    fileInput.click();
                } else {
                    console.error('檔案輸入元素不存在，無法觸發檔案選擇');
                }
            }
        });
        
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        console.log('拖拽區域事件已設置');
    } else {
        console.error('找不到上傳區域元素！');
    }
}

// 處理檔案選擇
function handleFileSelect(event) {
    try {
        console.log('檔案選擇事件觸發:', event);
        const files = Array.from(event.target.files);
        console.log('選擇的檔案數量:', files.length);
        console.log('檔案列表:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
        
        addFiles(files);
        
        // 清除檔案輸入的值，避免重複選擇問題
        event.target.value = '';
    } catch (error) {
        console.error('檔案選擇處理錯誤:', error);
        showNotification('error', '檔案選擇失敗', '請重新選擇檔案，或嘗試重新整理頁面');
    }
}

// 處理拖拽懸停
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('border-primary-500');
    event.currentTarget.classList.add('bg-primary-50');
}

// 處理拖拽離開
function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('border-primary-500');
    event.currentTarget.classList.remove('bg-primary-50');
}

// 處理檔案拖拽
function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('border-primary-500');
    event.currentTarget.classList.remove('bg-primary-50');
    
    const files = Array.from(event.dataTransfer.files);
    addFiles(files);
}

// 添加檔案到清單
function addFiles(files) {
    try {
        console.log('開始處理檔案:', files.length, '個檔案');
        
        // 篩選圖片檔案
        const imageFiles = files.filter(file => {
            const isImage = file.type.startsWith('image/');
            console.log(`檔案 ${file.name}: 類型=${file.type}, 是圖片=${isImage}`);
            return isImage;
        });
        
        console.log('篩選後的圖片檔案數量:', imageFiles.length);
        
        if (imageFiles.length === 0) {
            console.log('沒有找到圖片檔案');
            showNotification('error', '請選擇圖片檔案！', '只支援 JPG、PNG、GIF 格式的圖片');
            return;
        }

        // 檢查檔案數量限制
        if (selectedFiles.length + imageFiles.length > 10) {
            console.log('檔案數量超過限制:', selectedFiles.length + imageFiles.length);
            showNotification('error', '檔案數量超過限制', '每次最多只能上傳 10 張照片');
            return;
        }

        // 添加新檔案到清單
        imageFiles.forEach(file => {
            if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
                selectedFiles.push(file);
                console.log('添加檔案:', file.name);
            } else {
                console.log('檔案已存在，跳過:', file.name);
            }
        });

        console.log('目前選擇的檔案總數:', selectedFiles.length);
        
        updateFileList();
        updateUploadButton();
        
        showNotification('success', '照片已選擇', `已選擇 ${selectedFiles.length} 張美好的回憶照片 📸`);
    } catch (error) {
        console.error('添加檔案錯誤:', error);
        showNotification('error', '處理檔案時發生錯誤', '請重新選擇檔案');
    }
}

// 更新檔案清單顯示
function updateFileList() {
    const fileList = document.getElementById('fileList');
    
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = selectedFiles.map((file, index) => {
        const fileSize = formatFileSize(file.size);
        
        return `
            <div class="flex justify-between items-center p-4 bg-primary-50 border border-primary-200 rounded-lg mb-2 hover:bg-primary-100 transition-colors duration-200">
                <div class="flex items-center flex-1">
                    <div class="text-2xl mr-4">📷</div>
                    <div class="flex-1">
                        <div class="font-medium text-gray-800">${file.name}</div>
                        <div class="text-sm text-gray-500">${fileSize}</div>
                    </div>
                </div>
                <button class="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors duration-200" onclick="removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

// 更新上傳按鈕
function updateUploadButton() {
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (selectedFiles.length > 0) {
        uploadBtn.classList.remove('hidden');
        uploadBtn.innerHTML = `<i class="fas fa-cloud-upload-alt mr-2"></i> 上傳 ${selectedFiles.length} 張珍貴回憶`;
        uploadBtn.disabled = false;
    } else {
        uploadBtn.classList.add('hidden');
    }
}

// 移除檔案
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    updateUploadButton();
    
    if (selectedFiles.length === 0) {
        hideProgress();
    }
}

// 上傳檔案
async function uploadFiles() {
    if (selectedFiles.length === 0) {
        showNotification('error', '沒有選擇照片', '請先選擇要分享的美好回憶照片');
        return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在上傳回憶...';

    showProgress();
    updateProgress(0, '準備將美好回憶上傳到雲端...');

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('images', file);
    });

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            updateProgress(100, '所有照片都已成功上傳！');
            showNotification('success', '上傳成功！', `${selectedFiles.length} 張美好回憶已安全保存到 "0629婚禮" 相簿 💕`);
            
            // 清空檔案列表
            selectedFiles = [];
            updateFileList();
            updateUploadButton();
            
            // 刷新相簿預覽以顯示新上傳的照片
            setTimeout(() => {
                loadAlbumPreview();
            }, 1000);
            
            // 延遲隱藏進度條
            setTimeout(() => {
                hideProgress();
            }, 2000);
        } else {
            throw new Error(result.error || '上傳失敗');
        }
    } catch (error) {
        console.error('上傳錯誤:', error);
        updateProgress(0, '上傳失敗');
        showNotification('error', '上傳失敗', error.message || '請稍後再試，或檢查網路連線');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> 上傳 ${selectedFiles.length} 張珍貴回憶`;
    }
}

// 顯示進度條
function showProgress() {
    document.getElementById('progressSection').classList.remove('hidden');
}

// 隱藏進度條
function hideProgress() {
    document.getElementById('progressSection').classList.add('hidden');
}

// 更新進度
function updateProgress(percent, text) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = text;
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 顯示通知
function showNotification(type, title, message, duration = 4000) {
    // 移除現有通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // 根據類型選擇圖標
    let icon = '';
    switch(type) {
        case 'success':
            icon = '💕';
            break;
        case 'error':
            icon = '💔';
            break;
        case 'info':
            icon = '💌';
            break;
        default:
            icon = '📸';
    }
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center;">
            <span style="font-size: 1.2em; margin-right: 10px;">${icon}</span>
            <div>
                <strong>${title}</strong><br>
                <span style="font-size: 0.9em; opacity: 0.9;">${message}</span>
            </div>
        </div>
        <button class="close-btn" onclick="closeNotification(this)">×</button>
    `;

    // 添加到頁面
    document.body.appendChild(notification);

    // 顯示動畫
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // 自動關閉
    setTimeout(() => {
        closeNotification(notification.querySelector('.close-btn'));
    }, duration);
}

// 關閉通知
function closeNotification(closeBtn) {
    const notification = closeBtn.closest('.notification');
    if (notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }
}

// 檢查 URL 參數以顯示授權結果
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('auth') === 'success') {
    setTimeout(() => {
        checkAuthStatus();
        showNotification(
            'success',
            '授權成功！',
            '已成功連接到你的 Google Photos 帳戶'
        );
    }, 1000);
} else if (urlParams.get('auth') === 'error') {
    showNotification(
        'error',
        '授權失敗',
        '無法連接到 Google Photos，請重試'
    );
}

// 設定留言表單
function setupMessageForm() {
    const messageForm = document.querySelector('.message-form');
    const messageTextarea = document.querySelector('.message-textarea');
    const messageNameInput = document.querySelector('.message-name');
    const messageSubmitBtn = document.querySelector('.message-submit-btn');

    if (messageSubmitBtn) {
        messageSubmitBtn.addEventListener('click', submitMessage);
    }

    // 字數限制提示和自動調整高度
    if (messageTextarea) {
        messageTextarea.addEventListener('input', function() {
            const charCount = this.value.length;
            const maxChars = 500;
            
            if (charCount > maxChars) {
                this.value = this.value.substring(0, maxChars);
            }
            
            // 自動調整 textarea 高度
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
        
        // Enter 鍵發送留言，Shift+Enter 換行
        messageTextarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitMessage();
            }
        });
    }
}

// 載入留言
async function loadMessages(page = 1, append = false) {
    if (isLoading) return;
    
    isLoading = true;
    updateLoadingState(true);
    
    try {
        const response = await fetch(`/messages?page=${page}&limit=5`);
        const data = await response.json();
        
        if (data.messages) {
            if (append) {
                allMessages = [...allMessages, ...data.messages];
            } else {
                allMessages = data.messages;
            }
            
            hasMore = data.pagination.hasMore;
            currentPage = data.pagination.currentPage;
            
            displayMessages(allMessages);
        }
    } catch (error) {
        console.error('載入留言失敗:', error);
        showNotification('error', '載入失敗', '無法載入留言，請重新整理頁面');
    } finally {
        isLoading = false;
        updateLoadingState(false);
    }
}

// 顯示留言
function displayMessages(messages) {
    const messagesContainer = document.querySelector('.messages-container');
    
    if (!messagesContainer) return;
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="text-center py-16">
                <div class="text-6xl mb-4">💌</div>
                <h3 class="text-2xl font-semibold text-gray-600 mb-2">趕快留言吧</h3>
                <p class="text-gray-500">成為第一個為新人留下祝福的人！</p>
            </div>
        `;
        return;
    }
    
    const messagesHTML = messages.map((msg, index) => {
        // 使用資料庫中的頭像，如果沒有則使用預設頭像
        const avatarSrc = msg.avatar || 'images/avatars/cat.png';
        
        return `
            <div class="flex items-start space-x-4 mb-6">
                <!-- 頭像 -->
                <div class="flex-shrink-0">
                    <div class="w-12 h-12 rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden">
                        <img src="${avatarSrc}" alt="${msg.name}的頭像" class="w-full h-full object-cover" onerror="this.src='images/avatars/cat.png'">
                    </div>
                </div>
                
                <!-- 訊息氣泡 -->
                <div class="flex-1">
                    <!-- 名稱和時間 -->
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-lg font-medium text-gray-700">${msg.name}</p>
                        <p class="text-xs text-gray-400 ml-2">${formatMessageDate(msg.timestamp)}</p>
                    </div>
                    
                    <!-- 氣泡框 -->
                    <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-500 relative">
                        <!-- 留言內容 -->
                        <p class="text-gray-800 leading-relaxed text-sm">
                            ${msg.message}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    const loadingHTML = hasMore ? `
        <div id="loading-more" class="text-center py-8 ${isLoading ? '' : 'hidden'}">
            <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
            <p class="text-gray-500">載入更多留言...</p>
        </div>
        <div id="load-more-trigger" class="h-4"></div>
    ` : `
        <div class="text-center py-8 text-gray-400">
            <p class="text-sm">已顯示所有留言</p>
        </div>
    `;
    
    messagesContainer.innerHTML = messagesHTML + loadingHTML;
}

// 提交留言
async function submitMessage() {
    const messageTextarea = document.querySelector('.message-textarea');
    const messageNameInput = document.querySelector('.message-name');
    const messageSubmitBtn = document.querySelector('.message-submit-btn');
    
    const name = messageNameInput.value.trim();
    const message = messageTextarea.value.trim();
    
    if (!name || !message) {
        showNotification('error', '請填寫完整資訊', '姓名和祝福內容都是必填的');
        return;
    }
    
    if (message.length > 500) {
        showNotification('error', '內容太長', '祝福內容不能超過 500 字');
        return;
    }
    
    // 顯示提交狀態
    const originalText = messageSubmitBtn.innerHTML;
    messageSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>送出中...';
    messageSubmitBtn.disabled = true;
    
    try {
        const response = await fetch('/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, message })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('success', '留言成功！', '您的祝福已經送出，感謝您的分享 💕');
            
            // 清空表單
            messageTextarea.value = '';
            messageNameInput.value = '';
            
            // 重新載入留言（重置為第一頁）
            currentPage = 1;
            hasMore = true;
            allMessages = [];
            loadMessages();
        } else {
            throw new Error(result.error || '留言失敗');
        }
    } catch (error) {
        console.error('留言錯誤:', error);
        showNotification('error', '留言失敗', error.message || '請稍後再試');
    } finally {
        // 恢復按鈕狀態
        messageSubmitBtn.innerHTML = originalText;
        messageSubmitBtn.disabled = false;
    }
}

// 設定無限滾動
function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && hasMore && !isLoading) {
                loadMessages(currentPage + 1, true);
            }
        });
    }, {
        rootMargin: '100px'
    });

    // 監聽滾動觸發器
    setInterval(() => {
        const trigger = document.getElementById('load-more-trigger');
        if (trigger) {
            observer.observe(trigger);
        }
    }, 1000);
}

// 更新載入狀態
function updateLoadingState(loading) {
    const loadingElement = document.getElementById('loading-more');
    if (loadingElement) {
        if (loading) {
            loadingElement.classList.remove('hidden');
        } else {
            loadingElement.classList.add('hidden');
        }
    }
}

// 格式化留言日期
function formatMessageDate(timestamp) {
    // timestamp 格式是 "2024-12-23 14:30:25"，這是 UTC+8 時間
    // 直接解析為本地時間
    const date = new Date(timestamp.replace(' ', 'T'));
    const now = new Date();
    
    // 計算時間差（毫秒）
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // 小於 1 分鐘顯示「剛剛」
    if (diffMinutes < 1) {
        return '剛剛';
    }
    // 小於 1 小時顯示「x 分鐘前」
    else if (diffMinutes < 60) {
        return `${diffMinutes} 分鐘前`;
    }
    // 大於等於 1 小時，使用原本的顯示方式
    else {
        // 取得今天和留言日期（都用本地時間）
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const daysDiff = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
        
        // 格式化時間
        const timeStr = timestamp.split(' ')[1]; // 直接取時間部分
        
        // 今天顯示時：分：秒
        if (daysDiff === 0) {
            return timeStr;
        }
        // 昨天顯示：昨天 時：分：秒
        else if (daysDiff === 1) {
            return '昨天 ' + timeStr;
        }
        // 更早顯示：月/日 時：分：秒
        else {
            const datePart = timestamp.split(' ')[0]; // "2024-12-23"
            const [year, month, day] = datePart.split('-');
            return `${month}/${day} ${timeStr}`;
        }
    }
}

// 格式化日期（保留原有功能）
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return '今天';
    } else if (diffDays <= 7) {
        return `${diffDays} 天前`;
    } else {
        return date.toLocaleDateString('zh-TW');
    }
}

// 載入相簿預覽
async function loadAlbumPreview() {
    console.log('開始載入相簿預覽...');
    
    const loadingEl = document.getElementById('albumLoading');
    const gridEl = document.getElementById('albumGrid');
    const emptyEl = document.getElementById('albumEmpty');
    const viewMoreBtn = document.getElementById('viewMoreBtn');
    
    try {
        // 顯示載入狀態
        loadingEl.classList.remove('hidden');
        gridEl.classList.add('hidden');
        emptyEl.classList.add('hidden');
        if (viewMoreBtn) {
            viewMoreBtn.classList.add('hidden');
        }
        
        const response = await fetch('/album-preview');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('相簿預覽資料:', data);
        
        // 隱藏載入狀態
        loadingEl.classList.add('hidden');
        
        if (data.photos && data.photos.length > 0) {
            // 顯示照片網格
            displayAlbumPhotos(data.photos);
            gridEl.classList.remove('hidden');
            
            // 如果有相簿連結，顯示查看更多按鈕
            if (data.albumUrl && viewMoreBtn) {
                const viewMoreLink = viewMoreBtn.querySelector('a');
                if (viewMoreLink) {
                    viewMoreLink.href = data.albumUrl;
                }
                viewMoreBtn.classList.remove('hidden');
            }
        } else {
            // 顯示空狀態
            emptyEl.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('載入相簿預覽失敗:', error);
        
        // 隱藏載入狀態，顯示空狀態
        loadingEl.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        
        // 可以選擇顯示錯誤訊息或保持靜默
        // showNotification('error', '載入相簿失敗', '無法載入相簿預覽，請稍後再試');
    }
}

// 顯示相簿照片
function displayAlbumPhotos(photos) {
    const gridEl = document.getElementById('albumGrid');
    
    // 清空現有內容
    gridEl.innerHTML = `
        <!-- 手機版：水平滾動容器 -->
        <div class="md:hidden overflow-x-auto pb-4 album-scroll">
            <div class="flex gap-4 w-max">
                <!-- 手機版照片會在這裡動態載入 -->
            </div>
        </div>
        <!-- 桌面版：網格布局 -->
        <div class="hidden md:grid md:grid-cols-5 gap-4">
            <!-- 桌面版照片會在這裡動態載入 -->
        </div>
    `;
    
    // 取得容器元素
    const mobileContainer = gridEl.querySelector('.md\\:hidden .flex');
    const desktopContainer = gridEl.querySelector('.hidden.md\\:grid');
    
    photos.forEach((photo, index) => {
        // 創建手機版照片元素（固定寬度，可水平滾動）
        const mobilePhotoEl = document.createElement('div');
        mobilePhotoEl.className = 'relative group overflow-hidden rounded-2xl bg-gray-100 hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex-shrink-0';
        mobilePhotoEl.style.width = '120px';
        mobilePhotoEl.style.height = '120px';
        
        mobilePhotoEl.innerHTML = `
            <img 
                src="${photo.thumbnailUrl}" 
                alt="婚禮照片 ${index + 1}"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
                onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full bg-gray-200 text-2xl\\'>📷</div>'"
            />
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                <span class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-lg">
                    zoom_in
                </span>
            </div>
        `;
        
        // 創建桌面版照片元素（響應式網格）
        const desktopPhotoEl = document.createElement('div');
        desktopPhotoEl.className = 'relative group overflow-hidden rounded-2xl aspect-square bg-gray-100 hover:shadow-lg transition-all duration-300 transform hover:scale-105';
        
        desktopPhotoEl.innerHTML = `
            <img 
                src="${photo.thumbnailUrl}" 
                alt="婚禮照片 ${index + 1}"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
                onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full bg-gray-200\\'>📷</div>'"
            />
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                <span class="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-2xl">
                    zoom_in
                </span>
            </div>
        `;
        
        // 點擊照片時的行為
        const clickHandler = () => {
            openLightbox(photo, index, photos);
        };
        
        mobilePhotoEl.addEventListener('click', clickHandler);
        desktopPhotoEl.addEventListener('click', clickHandler);
        
        // 添加到對應容器
        mobileContainer.appendChild(mobilePhotoEl);
        desktopContainer.appendChild(desktopPhotoEl);
    });
}

// 燈箱功能
let currentLightboxIndex = 0;
let currentLightboxPhotos = [];

function openLightbox(photo, index, photos) {
    currentLightboxIndex = index;
    currentLightboxPhotos = photos;
    
    // 創建燈箱元素
    const lightbox = document.createElement('div');
    lightbox.id = 'photoLightbox';
    lightbox.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm';
    lightbox.style.animation = 'fadeIn 0.3s ease-out';
    
    lightbox.innerHTML = `
        <div class="relative max-w-full max-h-full p-4 flex items-center justify-center">
            <!-- 關閉按鈕 -->
            <button class="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 transition-colors z-10 w-12 h-12 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20" onclick="closeLightbox()">
                ×
            </button>
            
            <!-- 上一張按鈕 -->
            <button class="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-3xl hover:text-gray-300 transition-colors z-10 w-12 h-12 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 ${photos.length <= 1 ? 'hidden' : ''}" onclick="previousPhoto()">
                ‹
            </button>
            
            <!-- 下一張按鈕 -->
            <button class="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-3xl hover:text-gray-300 transition-colors z-10 w-12 h-12 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 ${photos.length <= 1 ? 'hidden' : ''}" onclick="nextPhoto()">
                ›
            </button>
            
            <!-- 照片容器 -->
            <div class="relative max-w-full max-h-full">
                <img id="lightboxImage" 
                     src="${photo.thumbnailUrl.replace('=w400-h400-c', '=w1200-h1200')}" 
                     alt="婚禮照片 ${index + 1}"
                     class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                     style="max-height: 90vh; max-width: 90vw;"
                     onerror="this.src='${photo.thumbnailUrl}'"
                />
                
                <!-- 載入動畫 -->
                <div id="lightboxLoading" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
            </div>
            
            <!-- 照片計數器 -->
            <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full ${photos.length <= 1 ? 'hidden' : ''}">
                ${index + 1} / ${photos.length}
            </div>
        </div>
    `;
    
    // 添加到頁面
    document.body.appendChild(lightbox);
    
    // 設置圖片載入事件
    const img = lightbox.querySelector('#lightboxImage');
    const loading = lightbox.querySelector('#lightboxLoading');
    
    img.onload = () => {
        loading.style.display = 'none';
    };
    
    // 點擊背景關閉燈箱
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // 鍵盤事件
    document.addEventListener('keydown', handleLightboxKeydown);
    
    // 防止背景滾動
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lightbox = document.getElementById('photoLightbox');
    if (lightbox) {
        lightbox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            lightbox.remove();
        }, 300);
    }
    
    // 移除鍵盤事件監聽
    document.removeEventListener('keydown', handleLightboxKeydown);
    
    // 恢復背景滾動
    document.body.style.overflow = '';
}

function previousPhoto() {
    if (currentLightboxPhotos.length <= 1) return;
    
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxPhotos.length) % currentLightboxPhotos.length;
    updateLightboxPhoto();
}

function nextPhoto() {
    if (currentLightboxPhotos.length <= 1) return;
    
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxPhotos.length;
    updateLightboxPhoto();
}

function updateLightboxPhoto() {
    const img = document.getElementById('lightboxImage');
    const loading = document.getElementById('lightboxLoading');
    const counter = document.querySelector('.absolute.bottom-4');
    
    if (!img || !currentLightboxPhotos[currentLightboxIndex]) return;
    
    // 顯示載入動畫
    loading.style.display = 'flex';
    
    // 更新照片
    const photo = currentLightboxPhotos[currentLightboxIndex];
    img.src = photo.thumbnailUrl.replace('=w400-h400-c', '=w1200-h1200');
    img.alt = `婚禮照片 ${currentLightboxIndex + 1}`;
    
    // 更新計數器
    if (counter) {
        counter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxPhotos.length}`;
    }
    
    // 圖片載入完成後隱藏載入動畫
    img.onload = () => {
        loading.style.display = 'none';
    };
    
    // 如果高畫質載入失敗，回退到縮圖
    img.onerror = () => {
        img.src = photo.thumbnailUrl;
    };
}

function handleLightboxKeydown(e) {
    switch(e.key) {
        case 'Escape':
            closeLightbox();
            break;
        case 'ArrowLeft':
            previousPhoto();
            break;
        case 'ArrowRight':
            nextPhoto();
            break;
    }
}

// 幻燈片功能
let slideImages = [];
let currentSlideIndex = 0;
let isSlideAutoPlay = true;
let slideInterval;

// 初始化幻燈片
function initSlideshow() {
    console.log('初始化幻燈片...');
    
    // 定義 amin 資料夾中的照片（已轉換為JPG格式）
    slideImages = [
        'IMG_5310.jpg', 'IMG_4267.jpg', 'IMG_5070.jpg', 'IMG_5094.jpg', 'IMG_3257.jpg',
        'IMG_3330.jpg', 'IMG_3546.jpg', 'IMG_3931.jpg', 'IMG_3621.png', 'IMG_2903.jpg',
        'IMG_2735.jpg', 'IMG_2663.jpg'
    ];
    
    createSlideElements();
    setupSlideControls();
    startAutoPlay();
    
    // 隱藏載入狀態
    document.getElementById('slideshowLoading').style.display = 'none';
}

// 創建幻燈片元素
function createSlideElements() {
    const container = document.getElementById('slideshowContainer');
    const dotsContainer = document.getElementById('slideshowDots');
    
    // 清空容器
    container.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    // 創建幻燈片
    slideImages.forEach((imageName, index) => {
        // 創建幻燈片
        const slide = document.createElement('div');
        slide.className = 'w-full h-full flex-shrink-0 relative';
        slide.innerHTML = `
            <img 
                src="images/amin/${imageName}" 
                alt="美好回憶 ${index + 1}"
                class="w-full h-full object-contain bg-white"
                onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full bg-gray-200 text-4xl\\'>📷</div>'"
            />
        `;
        container.appendChild(slide);
        
        // 創建指示點
        const dot = document.createElement('button');
        dot.className = `w-3 h-3 rounded-full transition-all duration-300 ${index === 0 ? 'bg-rose-500' : 'bg-gray-300'}`;
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });
    
    // 更新計數器
    updateSlideCounter();
}

// 設置幻燈片控制
function setupSlideControls() {
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const playPauseBtn = document.getElementById('playPauseBtn');
    
    prevBtn.addEventListener('click', previousSlide);
    nextBtn.addEventListener('click', nextSlide);
    playPauseBtn.addEventListener('click', toggleAutoPlay);
    
    // 鍵盤控制
    document.addEventListener('keydown', handleSlideKeydown);
}

// 上一張幻燈片
function previousSlide() {
    currentSlideIndex = (currentSlideIndex - 1 + slideImages.length) % slideImages.length;
    updateSlidePosition();
    updateSlideDots();
    updateSlideCounter();
}

// 下一張幻燈片
function nextSlide() {
    currentSlideIndex = (currentSlideIndex + 1) % slideImages.length;
    updateSlidePosition();
    updateSlideDots();
    updateSlideCounter();
}

// 跳轉到指定幻燈片
function goToSlide(index) {
    currentSlideIndex = index;
    updateSlidePosition();
    updateSlideDots();
    updateSlideCounter();
}

// 更新幻燈片位置
function updateSlidePosition() {
    const container = document.getElementById('slideshowContainer');
    const translateX = -currentSlideIndex * 100;
    container.style.transform = `translateX(${translateX}%)`;
}

// 更新指示點
function updateSlideDots() {
    const dots = document.querySelectorAll('#slideshowDots button');
    dots.forEach((dot, index) => {
        if (index === currentSlideIndex) {
            dot.className = 'w-3 h-3 rounded-full transition-all duration-300 bg-rose-500';
        } else {
            dot.className = 'w-3 h-3 rounded-full transition-all duration-300 bg-gray-300';
        }
    });
}

// 更新計數器
function updateSlideCounter() {
    const counter = document.getElementById('slideCounter');
    counter.textContent = `${currentSlideIndex + 1} / ${slideImages.length}`;
}

// 開始自動播放
function startAutoPlay() {
    if (slideInterval) clearInterval(slideInterval);
    
    slideInterval = setInterval(() => {
        if (isSlideAutoPlay) {
            nextSlide();
        }
    }, 4000); // 4秒切換一次
}

// 停止自動播放
function stopAutoPlay() {
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
}

// 切換自動播放
function toggleAutoPlay() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const icon = playPauseBtn.querySelector('i');
    
    isSlideAutoPlay = !isSlideAutoPlay;
    
    if (isSlideAutoPlay) {
        icon.className = 'fas fa-pause';
        startAutoPlay();
    } else {
        icon.className = 'fas fa-play';
        stopAutoPlay();
    }
}

// 鍵盤控制
function handleSlideKeydown(e) {
    // 只有在沒有燈箱開啟時才處理幻燈片鍵盤事件
    if (document.getElementById('photoLightbox')) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                previousSlide();
            }
            break;
        case 'ArrowRight':
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                nextSlide();
            }
            break;
        case ' ':
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                toggleAutoPlay();
            }
            break;
    }
}