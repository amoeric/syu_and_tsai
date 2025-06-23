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
    document.getElementById('uploadSection').classList.add('hidden');
}

// 顯示上傳區塊
function showUploadSection() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('uploadSection').classList.remove('hidden');
}

// 授權函數
function authenticate() {
    window.location.href = '/auth';
}

// 設定事件監聽器
function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const authBtn = document.getElementById('authBtn');
    const uploadBtn = document.getElementById('uploadBtn');

    // 授權按鈕事件
    if (authBtn) {
        authBtn.addEventListener('click', authenticate);
    }

    // 上傳按鈕事件
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadFiles);
    }

    // 檔案選擇事件
    fileInput.addEventListener('change', handleFileSelect);

    // 拖拽區域事件
    uploadArea.addEventListener('click', (e) => {
        // 避免與按鈕衝突
        if (!e.target.closest('.select-btn')) {
            fileInput.click();
        }
    });
    
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
}

// 處理檔案選擇
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    addFiles(files);
    
    // 清除檔案輸入的值，避免重複選擇問題
    event.target.value = '';
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
    // 篩選圖片檔案
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showNotification('error', '請選擇圖片檔案！', '只支援 JPG、PNG、GIF 格式的圖片');
        return;
    }

    // 檢查檔案數量限制
    if (selectedFiles.length + imageFiles.length > 10) {
        showNotification('error', '檔案數量超過限制', '每次最多只能上傳 10 張照片');
        return;
    }

    // 添加新檔案到清單
    imageFiles.forEach(file => {
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });

    updateFileList();
    updateUploadButton();
    
    showNotification('success', '照片已選擇', `已選擇 ${selectedFiles.length} 張美好的回憶照片 📸`);
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
            showNotification('success', '上傳成功！', `${selectedFiles.length} 張美好回憶已安全保存到 Google Photos 💕`);
            
            // 清空檔案列表
            selectedFiles = [];
            updateFileList();
            updateUploadButton();
            
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

    // 字數限制提示
    if (messageTextarea) {
        messageTextarea.addEventListener('input', function() {
            const charCount = this.value.length;
            const maxChars = 500;
            
            if (charCount > maxChars) {
                this.value = this.value.substring(0, maxChars);
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
    
    const messagesHTML = messages.map(msg => `
        <div class="bg-gradient-to-r ${msg.gradient} p-6 rounded-2xl shadow-lg transform hover:scale-102 transition-transform duration-300">
            <p class="text-lg text-gray-700 mb-4 italic">
                "${msg.message}"
            </p>
            <div class="flex justify-between items-center">
                <p class="text-primary-600 font-semibold">- ${msg.name}</p>
                <p class="text-xs text-gray-500">${formatMessageDate(msg.timestamp)}</p>
            </div>
        </div>
    `).join('');
    
    const loadingHTML = hasMore ? `
        <div id="loading-more" class="text-center py-8 ${isLoading ? '' : 'hidden'}">
            <i class="fas fa-spinner fa-spin text-2xl text-primary-500 mb-2"></i>
            <p class="text-gray-500">載入更多留言...</p>
        </div>
        <div id="load-more-trigger" class="h-4"></div>
    ` : `
        <div class="text-center py-8 text-gray-400">
            <p class="text-sm">✨ 已顯示所有留言</p>
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
    
    // 取得今天和留言日期（都用本地時間）
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
    
    // 格式化時間
    const timeStr = timestamp.split(' ')[1]; // 直接取時間部分
    
    // 今天顯示時：分：秒
    if (diffDays === 0) {
        return timeStr;
    }
    // 昨天顯示：昨天 時：分：秒
    else if (diffDays === 1) {
        return '昨天 ' + timeStr;
    }
    // 更早顯示：月/日 時：分：秒
    else {
        const datePart = timestamp.split(' ')[0]; // "2024-12-23"
        const [year, month, day] = datePart.split('-');
        return `${month}/${day} ${timeStr}`;
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