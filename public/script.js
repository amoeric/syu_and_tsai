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
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('uploadSection').style.display = 'none';
}

// 顯示上傳區塊
function showUploadSection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
}

// 授權函數
function authenticate() {
    window.location.href = '/auth';
}

// 設定事件監聽器
function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const selectBtn = document.getElementById('selectBtn');

    // 檔案選擇事件
    fileInput.addEventListener('change', handleFileSelect);

    // 選擇按鈕事件（只在按鈕上，避免重複觸發）
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        fileInput.click();
    });

    // 拖拽區域事件（只在空白區域點擊時觸發）
    uploadArea.addEventListener('click', (e) => {
        // 只有點擊空白區域時才觸發，避免與按鈕衝突
        if (e.target === uploadArea || e.target.closest('.upload-content') === uploadArea.querySelector('.upload-content')) {
            if (e.target !== selectBtn && !selectBtn.contains(e.target)) {
                fileInput.click();
            }
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
    event.currentTarget.classList.add('dragover');
}

// 處理拖拽離開
function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}

// 處理檔案拖拽
function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    addFiles(files);
}

// 添加檔案到清單
function addFiles(files) {
    // 篩選圖片檔案
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        alert('請選擇圖片檔案！');
        return;
    }

    // 添加新檔案到清單
    imageFiles.forEach(file => {
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });

    updateFileList();
    updateUploadControls();
}

// 更新檔案清單顯示
function updateFileList() {
    const fileList = document.getElementById('fileList');
    
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = selectedFiles.map((file, index) => {
        const preview = URL.createObjectURL(file);
        const fileSize = formatFileSize(file.size);
        
        return `
            <div class="file-item">
                <div class="file-info">
                    <img src="${preview}" alt="${file.name}" class="file-preview">
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <p>${fileSize}</p>
                    </div>
                </div>
                <button class="remove-btn" onclick="removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

// 更新上傳控制按鈕
function updateUploadControls() {
    const uploadControls = document.getElementById('uploadControls');
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (selectedFiles.length > 0) {
        uploadControls.style.display = 'flex';
        uploadBtn.textContent = `上傳 ${selectedFiles.length} 張圖片`;
        uploadBtn.disabled = false;
    } else {
        uploadControls.style.display = 'none';
    }
}

// 移除檔案
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    updateUploadControls();
}

// 清除所有檔案
function clearFiles() {
    selectedFiles = [];
    updateFileList();
    updateUploadControls();
    hideProgress();
    hideResults();
}

// 上傳檔案
async function uploadFiles() {
    if (selectedFiles.length === 0) {
        alert('請先選擇要上傳的圖片！');
        return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上傳中...';

    showProgress();
    updateProgress(0, '準備上傳...');

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('images', file);
    });

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        updateProgress(100, '上傳完成！');
        showResults(result.results);
        
        // 顯示成功通知
        const successCount = result.results.filter(r => r.status === 'success').length;
        const errorCount = result.results.filter(r => r.status === 'error').length;
        
        if (successCount > 0 && errorCount === 0) {
            showNotification(
                'success',
                '上傳成功！',
                `成功上傳 ${successCount} 張圖片到 Google Photos`
            );
        } else if (successCount > 0 && errorCount > 0) {
            showNotification(
                'info',
                '部分上傳成功',
                `成功 ${successCount} 張，失敗 ${errorCount} 張`
            );
        } else if (errorCount > 0) {
            showNotification(
                'error',
                '上傳失敗',
                `${errorCount} 張圖片上傳失敗`
            );
        }
        
        // 清除已上傳的檔案
        setTimeout(() => {
            clearFiles();
        }, 2000);

    } catch (error) {
        console.error('上傳失敗:', error);
        updateProgress(0, '上傳失敗：' + error.message);
        showResults([{
            filename: '上傳錯誤',
            status: 'error',
            error: error.message
        }]);
        
        // 顯示錯誤通知
        showNotification(
            'error',
            '網路錯誤',
            '上傳失敗：' + error.message
        );
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 開始上傳';
    }
}

// 顯示進度條
function showProgress() {
    document.getElementById('progressSection').style.display = 'block';
}

// 隱藏進度條
function hideProgress() {
    document.getElementById('progressSection').style.display = 'none';
}

// 更新進度
function updateProgress(percent, text) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = text;
}

// 顯示結果
function showResults(results) {
    const resultsSection = document.getElementById('resultsSection');
    
    resultsSection.innerHTML = results.map(result => {
        const isSuccess = result.status === 'success';
        const iconClass = isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle';
        const resultClass = isSuccess ? 'result-success' : 'result-error';
        const message = isSuccess ? '上傳成功' : `上傳失敗: ${result.error}`;
        
        return `
            <div class="result-item ${resultClass}">
                <div class="result-info">
                    <i class="fas ${iconClass} result-icon"></i>
                    <div>
                        <h4>${result.filename}</h4>
                        <p>${message}</p>
                    </div>
                </div>
                ${isSuccess && result.googlePhotosUrl ? `
                    <a href="${result.googlePhotosUrl}" target="_blank" class="result-link">
                        <i class="fas fa-external-link-alt"></i>
                        在 Google Photos 中查看
                    </a>
                ` : ''}
            </div>
        `;
    }).join('');
}

// 隱藏結果
function hideResults() {
    document.getElementById('resultsSection').innerHTML = '';
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 通知系統
function showNotification(type, title, message, duration = 4000) {
    // 移除現有通知
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // 設定圖示
    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    if (type === 'error') iconClass = 'fas fa-exclamation-circle';
    if (type === 'info') iconClass = 'fas fa-info-circle';
    
    notification.innerHTML = `
        <i class="${iconClass} notification-icon"></i>
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
        <button class="notification-close" onclick="closeNotification(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 觸發動畫
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // 自動關閉
    setTimeout(() => {
        closeNotification(notification.querySelector('.notification-close'));
    }, duration);
}

// 關閉通知
function closeNotification(closeBtn) {
    const notification = closeBtn.closest('.notification');
    notification.classList.remove('show');
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
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