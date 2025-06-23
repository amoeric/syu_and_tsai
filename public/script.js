let selectedFiles = [];

// 頁面載入時檢查授權狀態
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
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