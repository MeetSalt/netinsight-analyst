// =========== NetInsight 前端应用 ===========

class NetInsightApp {
    constructor() {
        this.init();
        this.bindEvents();
        this.loadInitialData();
        this.startPeriodicUpdates();
    }

    init() {
        // API 基础 URL
        this.API_BASE = '';
        
        // 当前文件列表
        this.files = [];
        
        // 上传队列
        this.uploadQueue = [];
        
        // 定时器
        this.updateInterval = null;
        
        // DOM 元素
        this.elements = {
            // 导航
            navLinks: document.querySelectorAll('.nav-link'),
            sections: document.querySelectorAll('.section'),
            
            // 文件上传
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            selectFileBtn: document.getElementById('selectFileBtn'),
            uploadProgress: document.getElementById('uploadProgress'),
            progressText: document.getElementById('progressText'),
            progressPercent: document.getElementById('progressPercent'),
            progressFill: document.getElementById('progressFill'),
            
            // 队列状态
            queueInfo: document.getElementById('queueInfo'),
            
            // 分析结果
            analysisContent: document.getElementById('analysisContent'),
            
            // 历史记录
            historyContent: document.getElementById('historyContent'),
            historyLoading: document.getElementById('historyLoading'),
            
            // 模态框
            modal: document.getElementById('analysisModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalBody: document.getElementById('modalBody'),
            modalClose: document.getElementById('modalClose'),
            modalCloseBtn: document.getElementById('modalCloseBtn'),
            exportBtn: document.getElementById('exportBtn'),
            
            // 通知系统
            notifications: document.getElementById('notifications')
        };
        
        console.log('NetInsight 应用初始化完成');
    }

    bindEvents() {
        // 导航切换
        this.elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // 文件上传事件
        this.elements.selectFileBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
            // 清空input的值，这样同一个文件可以重复选择
            e.target.value = '';
        });

        // 拖拽上传
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('dragover');
        });

        this.elements.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
        });

        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
            this.handleFileSelect(e.dataTransfer.files);
        });

        this.elements.uploadArea.addEventListener('click', (e) => {
            // 只有点击上传区域本身时才触发，不是按钮时才触发
            if (e.target === this.elements.uploadArea || e.target.closest('.upload-text')) {
                this.elements.fileInput.click();
            }
        });

        // 模态框事件
        this.elements.modalClose.addEventListener('click', () => {
            this.closeModal();
        });

        this.elements.modalCloseBtn.addEventListener('click', () => {
            this.closeModal();
        });

        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.closeModal();
            }
        });

        // 导出按钮
        this.elements.exportBtn.addEventListener('click', () => {
            this.exportReport();
        });

        // 历史记录操作按钮事件委托
        this.elements.historyContent.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const fileId = button.dataset.fileId;

            if (!fileId) return;

            switch (action) {
                case 'view':
                    this.viewAnalysis(fileId);
                    break;
                case 'restart':
                    this.restartAnalysis(fileId);
                    break;
                case 'delete':
                    this.deleteFile(fileId);
                    break;
            }
        });

        // 分析结果页面操作按钮事件委托
        this.elements.analysisContent.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const fileId = button.dataset.fileId;

            if (!fileId) return;

            if (action === 'view') {
                this.viewAnalysis(fileId);
            }
        });

        console.log('事件绑定完成');
    }

    // =========== 导航管理 ===========
    handleNavigation(e) {
        e.preventDefault();
        
        const targetSection = e.currentTarget.dataset.section;
        
        // 更新导航状态
        this.elements.navLinks.forEach(link => {
            link.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        // 切换内容区域
        this.elements.sections.forEach(section => {
            section.classList.remove('active');
        });
        
        const targetElement = document.getElementById(`${targetSection}-section`);
        if (targetElement) {
            targetElement.classList.add('active');
            
            // 根据切换的页面加载对应数据
            switch (targetSection) {
                case 'analysis':
                    this.loadAnalysisResults();
                    break;
                case 'history':
                    this.loadHistory();
                    break;
                case 'upload':
                    this.updateQueueStatus();
                    break;
            }
        }
    }

    // =========== 文件上传 ===========
    handleFileSelect(files) {
        if (!files || files.length === 0) return;

        // 验证文件
        const validFiles = Array.from(files).filter(file => this.validateFile(file));
        
        if (validFiles.length === 0) {
            this.showNotification('请选择有效的网络分析文件', 'error');
            return;
        }

        // 上传文件
        validFiles.forEach(file => this.uploadFile(file));
    }

    validateFile(file) {
        // 检查文件类型
        const validTypes = ['.pcap', '.cap', '.pcapng', '.har'];
        const fileName = file.name.toLowerCase();
        const isValidType = validTypes.some(type => fileName.endsWith(type));
        
        if (!isValidType) {
            this.showNotification(`文件 ${file.name} 格式不支持`, 'error');
            return false;
        }

        // 暂时移除文件大小限制，等订阅功能完成后再添加
        // TODO: 根据用户订阅计划设置不同的文件大小限制

        return true;
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showUploadProgress(true);
            this.updateUploadProgress(0, `正在上传 ${file.name}...`);

            const response = await fetch(`${this.API_BASE}/api/files/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`上传失败: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.updateUploadProgress(100, '上传成功!');
                this.showNotification(`文件 ${file.name} 上传成功，开始分析`, 'success');
                
                // 延迟隐藏进度条
                setTimeout(() => {
                    this.showUploadProgress(false);
                    this.updateUploadProgress(0, '');
                }, 2000);

                // 刷新数据
                this.loadHistory();
                this.updateQueueStatus();
                
                // 如果当前在分析页面，也刷新分析结果
                if (document.getElementById('analysis-section').classList.contains('active')) {
                    this.loadAnalysisResults();
                }
            } else {
                throw new Error(result.message || '上传失败');
            }

        } catch (error) {
            console.error('上传错误:', error);
            this.showNotification(`上传失败: ${error.message}`, 'error');
            this.showUploadProgress(false);
        }
    }

    showUploadProgress(show) {
        this.elements.uploadProgress.style.display = show ? 'block' : 'none';
    }

    updateUploadProgress(percent, text) {
        this.elements.progressPercent.textContent = `${percent}%`;
        this.elements.progressText.textContent = text;
        this.elements.progressFill.style.width = `${percent}%`;
    }

    // =========== API 调用 ===========
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`API 调用失败: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API 调用错误:', error);
            throw error;
        }
    }

    // =========== 队列状态更新 ===========
    async updateQueueStatus() {
        try {
            const result = await this.apiCall('/api/analysis/queue/status');
            
            if (result.success) {
                const { waiting, running } = result.data;
                this.elements.queueInfo.textContent = `等待中: ${waiting} | 分析中: ${running}`;
            }
        } catch (error) {
            console.error('获取队列状态失败:', error);
        }
    }

    // =========== 历史记录 ===========
    async loadHistory() {
        try {
            this.elements.historyLoading.style.display = 'flex';
            
            const result = await this.apiCall('/api/files');
            
            if (result.success) {
                this.files = result.data.files;
                this.renderHistory();
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
            this.showNotification('加载历史记录失败', 'error');
        } finally {
            this.elements.historyLoading.style.display = 'none';
        }
    }

    renderHistory() {
        if (this.files.length === 0) {
            this.elements.historyContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clock empty-icon"></i>
                    <h3>暂无历史记录</h3>
                    <p>请先上传文件进行分析</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="history-table">
                <table class="table">
                    <thead>
                        <tr>
                            <th>文件名</th>
                            <th>文件类型</th>
                            <th>文件大小</th>
                            <th>上传时间</th>
                            <th>分析状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.files.map(file => this.renderFileRow(file)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.elements.historyContent.innerHTML = tableHTML;
    }

    renderFileRow(file) {
        const statusClass = this.getStatusClass(file.analysisStatus);
        const statusText = this.getStatusText(file.analysisStatus);
        const fileSize = this.formatFileSize(file.fileSize);
                    const uploadTime = file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('zh-CN') : '未记录';

        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${file.originalName}</div>
                </td>
                <td>
                    <span class="file-type">${file.fileType.toUpperCase()}</span>
                </td>
                <td>${fileSize}</td>
                <td>${uploadTime}</td>
                <td>
                    <span class="analysis-status ${statusClass}">
                        <i class="fas ${this.getStatusIcon(file.analysisStatus)}"></i>
                        ${statusText}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        ${file.analysisStatus === 'completed' ? `
                            <button class="btn btn-primary btn-sm" data-action="view" data-file-id="${file._id}">
                                <i class="fas fa-eye"></i> 查看结果
                            </button>
                        ` : ''}
                        ${file.analysisStatus === 'pending' || file.analysisStatus === 'failed' ? `
                            <button class="btn btn-warning btn-sm" data-action="restart" data-file-id="${file._id}">
                                <i class="fas fa-redo"></i> 重新分析
                            </button>
                        ` : ''}
                        <button class="btn btn-danger btn-sm" data-action="delete" data-file-id="${file._id}">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getStatusClass(status) {
        const classes = {
            'pending': 'status-processing',
            'processing': 'status-processing',
            'running': 'status-processing',
            'completed': 'status-completed',
            'failed': 'status-failed'
        };
        return classes[status] || 'status-processing';
    }

    getStatusText(status) {
        const texts = {
            'pending': '等待分析',
            'processing': '分析中',
            'running': '分析中',
            'completed': '分析完成',
            'failed': '分析失败'
        };
        return texts[status] || '未知状态';
    }

    getStatusIcon(status) {
        const icons = {
            'pending': 'fa-clock',
            'processing': 'fa-spinner fa-spin',
            'running': 'fa-spinner fa-spin',
            'completed': 'fa-check-circle',
            'failed': 'fa-exclamation-circle'
        };
        return icons[status] || 'fa-question-circle';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // =========== 分析结果 ===========
    async loadAnalysisResults() {
        try {
            // 获取最近的已完成分析
            const completedFiles = this.files.filter(file => file.analysisStatus === 'completed');
            
            if (completedFiles.length === 0) {
                this.elements.analysisContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-chart-line empty-icon"></i>
                        <h3>暂无分析结果</h3>
                        <p>请先上传文件进行分析</p>
                    </div>
                `;
                return;
            }

            // 显示最新的分析结果
            const latestFile = completedFiles[0];
            await this.displayAnalysisCard(latestFile);

        } catch (error) {
            console.error('加载分析结果失败:', error);
            this.showNotification('加载分析结果失败', 'error');
        }
    }

    async displayAnalysisCard(file) {
        try {
            const analysisResult = await this.apiCall(`/api/analysis/${file._id}`);
            
            if (!analysisResult.success) {
                throw new Error('获取分析结果失败');
            }

            const analysis = analysisResult.data.results;
            const topProtocols = (analysis.protocols || []).slice(0, 3);
            const anomaliesCount = (analysis.anomalies || []).length;
            const topConversationsCount = Math.min(
                (analysis.network?.topSources || []).length * 
                (analysis.network?.topDestinations || []).length, 
                5
            );
            
            const cardHTML = `
                <div class="analysis-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                    <div style="padding: 24px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
                        <div class="analysis-header" style="margin-bottom: 20px;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <i class="fas fa-file-alt" style="font-size: 18px; opacity: 0.9;"></i>
                                <div class="analysis-title" style="font-size: 18px; font-weight: 600;">${file.originalName}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="analysis-status" style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; border: 1px solid rgba(16, 185, 129, 0.3);">
                                    <i class="fas fa-check-circle"></i>
                                    分析完成
                                </div>
                                <div style="color: rgba(255, 255, 255, 0.8); font-size: 13px;">
                                    ${new Date(file.uploadedAt).toLocaleString()}
                                </div>
                            </div>
                        </div>
                        
                        <!-- 快速洞察 -->
                        <div style="background: rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: rgba(255, 255, 255, 0.95);">🚀 一眼看懂</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                                <div style="text-align: center;">
                                    <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${this.formatFileSize(analysis.summary?.totalBytes || 0)}</div>
                                    <div style="font-size: 12px; opacity: 0.8;">总流量</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${topProtocols.length}</div>
                                    <div style="font-size: 12px; opacity: 0.8;">主要协议</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${topConversationsCount}</div>
                                    <div style="font-size: 12px; opacity: 0.8;">通信对话</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px; color: ${anomaliesCount > 0 ? '#fbbf24' : '#10b981'};">${anomaliesCount}</div>
                                    <div style="font-size: 12px; opacity: 0.8;">发现问题</div>
                                </div>
                            </div>
                        </div>

                        <!-- 主要协议 -->
                        ${topProtocols.length > 0 ? `
                            <div style="margin-bottom: 20px;">
                                <h5 style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">主要协议类型:</h5>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    ${topProtocols.map(protocol => `
                                        <span style="background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">
                                            ${protocol.name} (${protocol.percentage?.toFixed(1)}%)
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- 健康状态指示 -->
                        <div style="margin-bottom: 20px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <i class="fas fa-heartbeat" style="font-size: 14px;"></i>
                                <span style="font-size: 14px; font-weight: 500;">网络健康状态</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${anomaliesCount === 0 ? `
                                    <div style="display: flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.2); padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.3);">
                                        <i class="fas fa-check-circle" style="color: #10b981; font-size: 12px;"></i>
                                        <span style="color: #10b981; font-size: 12px; font-weight: 500;">运行正常</span>
                                    </div>
                                ` : `
                                    <div style="display: flex; align-items: center; gap: 6px; background: rgba(245, 158, 11, 0.2); padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(245, 158, 11, 0.3);">
                                        <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 12px;"></i>
                                        <span style="color: #f59e0b; font-size: 12px; font-weight: 500;">发现 ${anomaliesCount} 个问题</span>
                                    </div>
                                `}
                                <div style="font-size: 12px; opacity: 0.7;">
                                    网络活动: ${(analysis.summary?.packetsPerSecond || 0).toFixed(1)} 包/秒
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div style="padding: 20px 24px; background: rgba(0, 0, 0, 0.1);">
                        <button class="btn btn-primary" data-action="view" data-file-id="${file._id}" style="width: 100%; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 12px; border-radius: 8px; font-weight: 500; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fas fa-chart-line"></i>
                            查看完整分析报告
                        </button>
                    </div>
                </div>
            `;

            this.elements.analysisContent.innerHTML = cardHTML;

        } catch (error) {
            console.error('显示分析卡片失败:', error);
            // 显示错误状态的卡片
            this.elements.analysisContent.innerHTML = `
                <div class="analysis-card" style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; text-align: center;">
                    <i class="fas fa-exclamation-circle" style="font-size: 24px; color: #dc2626; margin-bottom: 12px;"></i>
                    <div style="color: #dc2626; font-weight: 500; margin-bottom: 8px;">分析结果加载失败</div>
                    <div style="color: #6b7280; font-size: 14px;">${error.message}</div>
                </div>
            `;
        }
    }

    // =========== 分析详情模态框 ===========
    async viewAnalysis(fileId) {
        try {
            const analysisResult = await this.apiCall(`/api/analysis/${fileId}`);
            
            if (!analysisResult.success) {
                throw new Error('获取分析结果失败');
            }

            const file = this.files.find(f => f._id === fileId);
            const analysis = analysisResult.data.results;

            this.elements.modalTitle.textContent = `分析结果 - ${file?.originalName || '未知文件'}`;
            this.elements.modalBody.innerHTML = this.renderAnalysisDetails(analysis);
            this.showModal();

        } catch (error) {
            console.error('查看分析失败:', error);
            this.showNotification('获取分析详情失败', 'error');
        }
    }

    renderAnalysisDetails(analysis) {
        return `
            <div class="analysis-details">
                <!-- 分析过滤器 -->
                <div class="analysis-filters" style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                    <h4 style="margin: 0 0 12px 0; color: #374151;">🔍 快速过滤</h4>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <select id="protocolFilter" style="padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white;">
                            <option value="">所有协议</option>
                            ${(analysis.protocols || []).map(protocol => 
                                `<option value="${protocol.name}">${protocol.name} (${protocol.packets}包)</option>`
                            ).join('')}
                        </select>
                        <input type="text" id="ipFilter" placeholder="过滤IP地址..." style="padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; flex: 1; min-width: 200px;">
                        <button onclick="app.applyFilters()" style="padding: 6px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">应用过滤</button>
                        <button onclick="app.clearFilters()" style="padding: 6px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">清除</button>
                    </div>
                </div>

                <!-- Top N 对话 - 杀手级功能 -->
                <div style="margin-bottom: 24px;">
                    <h4 style="color: #1f2937; margin-bottom: 16px;">💬 主要通信对话 (Top Conversations)</h4>
                    <div class="top-conversations">
                        ${this.renderTopConversations(analysis)}
                    </div>
                </div>

                <!-- 协议分布可视化 -->
                <div style="margin-bottom: 24px;">
                    <h4 style="color: #1f2937; margin-bottom: 16px;">🌐 协议分布</h4>
                    <div class="protocol-visualization">
                        ${this.renderProtocolDistribution(analysis.protocols || [])}
                    </div>
                </div>

                <!-- 基础统计 -->
                <div style="margin-bottom: 24px;">
                    <h4 style="color: #1f2937; margin-bottom: 16px;">📊 流量概览</h4>
                    <div class="analysis-summary">
                        <div class="summary-item">
                            <span class="summary-value">${analysis.summary?.totalPackets || 0}</span>
                            <span class="summary-label">数据包总数</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-value">${this.formatFileSize(analysis.summary?.totalBytes || 0)}</span>
                            <span class="summary-label">数据总量</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-value">${(analysis.summary?.duration || 0).toFixed(1)}s</span>
                            <span class="summary-label">持续时间</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-value">${(analysis.summary?.packetsPerSecond || 0).toFixed(1)}</span>
                            <span class="summary-label">包/秒</span>
                        </div>
                    </div>
                </div>

                <!-- HTTP会话流重建 - 杀手级功能 -->
                ${analysis.http_sessions && analysis.http_sessions.total_sessions > 0 ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="color: #1f2937; margin-bottom: 16px;">🌐 HTTP会话流重建 (Network Activity)</h4>
                        <div style="background: rgba(59, 130, 246, 0.05); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                            <div style="display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-exchange-alt" style="color: #3b82f6;"></i>
                                    <span style="color: #374151; font-weight: 500;">总会话数: ${analysis.http_sessions.total_sessions}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-server" style="color: #10b981;"></i>
                                    <span style="color: #374151; font-weight: 500;">域名数: ${analysis.http_sessions.summary?.unique_hosts || 0}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-code" style="color: #f59e0b;"></i>
                                    <span style="color: #374151; font-weight: 500;">HTTP方法: ${(analysis.http_sessions.summary?.methods || []).join(', ')}</span>
                                </div>
                            </div>
                        </div>
                        ${this.renderHttpSessions(analysis.http_sessions.sessions || [])}
                    </div>
                ` : ''}

                <!-- 网络活动热点 -->
                <div style="margin-bottom: 24px;">
                    <h4 style="color: #1f2937; margin-bottom: 16px;">🔥 网络活动热点</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <h5 style="color: #6b7280; margin-bottom: 8px;">🔄 最活跃源IP</h5>
                            ${this.renderTopIPs(analysis.network?.topSources || [], 'source')}
                        </div>
                        <div>
                            <h5 style="color: #6b7280; margin-bottom: 8px;">🎯 最活跃目标IP</h5>
                            ${this.renderTopIPs(analysis.network?.topDestinations || [], 'destination')}
                        </div>
                    </div>
                </div>

                <!-- 智能诊断引擎 - 升级版 -->
                ${analysis.smart_insights ? this.renderSmartInsights(analysis.smart_insights) : ''}

                ${analysis.anomalies && analysis.anomalies.length > 0 ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="color: #dc2626; margin-bottom: 16px;">⚠️ 网络异常检测</h4>
                        <div class="anomalies-list">
                            ${analysis.anomalies.map(anomaly => `
                                <div class="anomaly-item" style="padding: 16px; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 8px; margin-bottom: 12px;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                        <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                                        <span style="font-weight: 600; color: #dc2626;">${this.getAnomalyTitle(anomaly.type)}</span>
                                        <span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${anomaly.severity || 'medium'}</span>
                                    </div>
                                    <div style="color: #374151; margin-bottom: 8px;">${anomaly.description}</div>
                                    ${anomaly.details ? `<div style="font-size: 13px; color: #6b7280;">${this.formatAnomalyDetails(anomaly.details)}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // =========== 新增的渲染方法 ===========
    renderTopConversations(analysis) {
        const sources = analysis.network?.topSources || [];
        const destinations = analysis.network?.topDestinations || [];
        
        // 创建对话对 (简化版，实际应该基于完整的连接数据)
        const conversations = [];
        
        // 合并源和目标IP，创建对话对
        sources.forEach(source => {
            destinations.forEach(dest => {
                if (source.ip !== dest.ip) {
                    conversations.push({
                        source: source.ip,
                        destination: dest.ip,
                        packets: Math.min(source.packets, dest.packets),
                        bytes: Math.min(source.bytes, dest.bytes),
                        description: this.getConversationDescription(source.ip, dest.ip)
                    });
                }
            });
        });
        
        // 取前5个对话
        const topConversations = conversations
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 5);
        
        if (topConversations.length === 0) {
            return '<div style="text-align: center; color: #6b7280; padding: 20px;">暂无通信对话数据</div>';
        }
        
        return topConversations.map((conv, index) => `
            <div class="conversation-item" style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; background: white;">
                <div style="display: flex; align-items: center; justify-content: between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">${index + 1}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">
                                <span style="color: #059669;">${conv.source}</span> 
                                <i class="fas fa-exchange-alt" style="color: #6b7280; margin: 0 8px;"></i>
                                <span style="color: #dc2626;">${conv.destination}</span>
                            </div>
                            <div style="font-size: 13px; color: #6b7280;">${conv.description}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: #374151;">${this.formatFileSize(conv.bytes)}</div>
                        <div style="font-size: 12px; color: #6b7280;">${conv.packets} 包</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="app.analyzeConversation('${conv.source}', '${conv.destination}')" style="padding: 4px 12px; font-size: 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; color: #374151;">
                        <i class="fas fa-search"></i> 详细分析
                    </button>
                    <button onclick="app.filterByConversation('${conv.source}', '${conv.destination}')" style="padding: 4px 12px; font-size: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; cursor: pointer; color: #1d4ed8;">
                        <i class="fas fa-filter"></i> 过滤此对话
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderProtocolDistribution(protocols) {
        if (!protocols || protocols.length === 0) {
            return '<div style="text-align: center; color: #6b7280; padding: 20px;">暂无协议数据</div>';
        }

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
        
        return `
            <div style="display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start;">
                <div class="protocol-bars">
                    ${protocols.slice(0, 7).map((protocol, index) => `
                        <div style="margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-weight: 500; color: #374151;">${protocol.name}</span>
                                <span style="font-size: 14px; color: #6b7280;">${protocol.packets} 包 (${protocol.percentage?.toFixed(1)}%)</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${protocol.percentage}%; height: 100%; background: ${colors[index % colors.length]}; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="protocol-pie" style="text-align: center;">
                    <div style="position: relative; width: 200px; height: 200px; margin: 0 auto;">
                        ${this.renderSimplePieChart(protocols.slice(0, 5), colors)}
                    </div>
                    <div style="margin-top: 16px; font-size: 13px; color: #6b7280;">
                        协议分布图
                    </div>
                </div>
            </div>
        `;
    }

    renderSimplePieChart(protocols, colors) {
        const total = protocols.reduce((sum, p) => sum + p.packets, 0);
        if (total === 0) {
            return `
                <div style="width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 14px;">
                    暂无数据
                </div>
            `;
        }

        let currentAngle = 0;
        const radius = 90;
        const centerX = 100;
        const centerY = 100;
        
        const slices = protocols.map((protocol, index) => {
            const percentage = (protocol.packets / total) * 100;
            const angle = (percentage / 100) * 360;
            
            // 计算弧的路径
            const startAngle = currentAngle * Math.PI / 180;
            const endAngle = (currentAngle + angle) * Math.PI / 180;
            
            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
            ].join(' ');
            
            currentAngle += angle;
            
            return `
                <path d="${pathData}" 
                      fill="${colors[index % colors.length]}" 
                      stroke="white" 
                      stroke-width="2">
                    <title>${protocol.name}: ${protocol.packets} 包 (${percentage.toFixed(1)}%)</title>
                </path>
            `;
        }).join('');
        
        return `
            <svg width="200" height="200" viewBox="0 0 200 200" style="transform: rotate(-90deg);">
                ${slices}
            </svg>
            <div style="
                position: absolute;
                width: 80px;
                height: 80px;
                top: 60px;
                left: 60px;
                background: white;
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                color: #374151;
                border: 2px solid #f3f4f6;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
                <span style="font-size: 16px;">${protocols.length}</span>
                <span style="font-size: 11px; font-weight: normal; color: #6b7280;">协议</span>
            </div>
        `;
    }

    renderTopIPs(ips, type) {
        if (!ips || ips.length === 0) {
            return '<div style="text-align: center; color: #6b7280; padding: 12px; font-size: 14px;">暂无数据</div>';
        }

        return ips.slice(0, 5).map((ip, index) => `
            <div style="display: flex; align-items: center; justify-content: between; padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <span style="background: ${type === 'source' ? '#10b981' : '#f59e0b'}; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">${index + 1}</span>
                    <span style="font-family: monospace; font-size: 13px; color: #374151;">${ip.ip}</span>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; font-weight: 500; color: #374151;">${this.formatFileSize(ip.bytes)}</div>
                    <div style="font-size: 11px; color: #6b7280;">${ip.packets} 包</div>
                </div>
            </div>
        `).join('');
    }

    getAnomalyTitle(type) {
        const titles = {
            'high_icmp_traffic': 'ICMP流量异常',
            'port_scan_detected': '端口扫描攻击',
            'ddos_attack': 'DDoS攻击迹象',
            'high_retransmission': 'TCP重传过多',
            'unusual_protocol': '异常协议使用',
            'large_packets': '异常大数据包',
            'high_traffic_volume': '流量峰值异常'
        };
        return titles[type] || type;
    }

    formatAnomalyDetails(details) {
        if (typeof details === 'string') return details;
        if (typeof details === 'object') {
            return Object.entries(details)
                .map(([key, value]) => `${key}: ${value}`)
                .join(' | ');
        }
        return '';
    }

    getConversationDescription(sourceIP, destIP) {
        // 简单的IP类型判断
        if (this.isPrivateIP(sourceIP) && !this.isPrivateIP(destIP)) {
            return '内网到外网通信';
        } else if (!this.isPrivateIP(sourceIP) && this.isPrivateIP(destIP)) {
            return '外网到内网通信';
        } else if (this.isPrivateIP(sourceIP) && this.isPrivateIP(destIP)) {
            return '内网通信';
        } else {
            return '外网通信';
        }
    }

    isPrivateIP(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        
        // 私有IP地址范围
        return (
            first === 10 || 
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && second === 168)
        );
    }

    // =========== 过滤功能 ===========
    applyFilters() {
        const protocolFilter = document.getElementById('protocolFilter')?.value || '';
        const ipFilter = document.getElementById('ipFilter')?.value || '';
        
        console.log('应用过滤:', { protocolFilter, ipFilter });
        this.showNotification(`过滤条件已应用: ${protocolFilter || '所有协议'} | ${ipFilter || '所有IP'}`, 'info');
        
        // TODO: 实际的过滤逻辑将在后续版本中实现
        // 这里应该重新渲染分析结果，只显示符合条件的数据
    }

    clearFilters() {
        if (document.getElementById('protocolFilter')) {
            document.getElementById('protocolFilter').value = '';
        }
        if (document.getElementById('ipFilter')) {
            document.getElementById('ipFilter').value = '';
        }
        
        this.showNotification('过滤条件已清除', 'info');
        
        // TODO: 重新加载完整数据
    }

    analyzeConversation(sourceIP, destIP) {
        this.showNotification(`正在分析 ${sourceIP} ↔ ${destIP} 的详细通信...`, 'info');
        // TODO: 实现会话流重建功能
    }

    filterByConversation(sourceIP, destIP) {
        if (document.getElementById('ipFilter')) {
            document.getElementById('ipFilter').value = `${sourceIP},${destIP}`;
        }
        this.applyFilters();
    }

    showModal() {
        this.elements.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.elements.modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // =========== 文件操作 ===========
    async restartAnalysis(fileId) {
        try {
            const result = await this.apiCall(`/api/analysis/${fileId}/restart`, {
                method: 'POST'
            });

            if (result.success) {
                this.showNotification('重新分析已启动', 'success');
                this.loadHistory();
                this.updateQueueStatus();
            }
        } catch (error) {
            console.error('重新分析失败:', error);
            this.showNotification('重新分析失败', 'error');
        }
    }

    async deleteFile(fileId) {
        if (!confirm('确定要删除这个文件吗？此操作不可恢复。')) {
            return;
        }

        try {
            const result = await this.apiCall(`/api/files/${fileId}`, {
                method: 'DELETE'
            });

            if (result.success) {
                this.showNotification('文件删除成功', 'success');
                this.loadHistory();
                this.updateQueueStatus();
            }
        } catch (error) {
            console.error('删除文件失败:', error);
            this.showNotification('删除文件失败', 'error');
        }
    }

    exportReport() {
        this.showNotification('报告导出功能开发中...', 'info');
    }

    // =========== 通知系统 ===========
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        }[type];

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="${icon}"></i>
                <span>${message}</span>
            </div>
        `;

        this.elements.notifications.appendChild(notification);

        // 自动移除通知
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // =========== 初始化数据 ===========
    async loadInitialData() {
        await this.loadHistory();
        await this.updateQueueStatus();
    }

    // =========== 定期更新 ===========
    startPeriodicUpdates() {
        // 每5秒更新一次队列状态
        this.updateInterval = setInterval(() => {
            this.updateQueueStatus();
            
            // 如果有处理中的文件，刷新历史记录
            const processingFiles = this.files.filter(file => 
                file.analysisStatus === 'processing' || file.analysisStatus === 'pending'
            );
            
            if (processingFiles.length > 0) {
                this.loadHistory();
            }
        }, 5000);
    }

    // =========== 清理资源 ===========
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    // =========== HTTP会话流重建方法 ===========
    renderHttpSessions(sessions) {
        if (!sessions || sessions.length === 0) {
            return `
                <div style="text-align: center; color: #6b7280; padding: 24px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <i class="fas fa-globe" style="font-size: 24px; margin-bottom: 8px; color: #9ca3af;"></i>
                    <div style="font-weight: 500; margin-bottom: 4px;">暂无HTTP会话数据</div>
                    <div style="font-size: 13px;">未检测到HTTP流量或数据包未包含HTTP负载</div>
                </div>
            `;
        }

        return `
            <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">
                <!-- 表头 -->
                <div style="display: grid; grid-template-columns: 60px 80px 1fr 120px 80px 100px 80px; gap: 12px; padding: 12px 16px; background: #f9fafb; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                    <div>#</div>
                    <div>方法</div>
                    <div>URL</div>
                    <div>主机</div>
                    <div>状态</div>
                    <div>响应时间</div>
                    <div>操作</div>
                </div>
                
                <!-- HTTP会话列表 -->
                <div style="max-height: 400px; overflow-y: auto;">
                    ${sessions.map((session, index) => this.renderHttpSessionRow(session, index)).join('')}
                </div>
            </div>
        `;
    }

    renderHttpSessionRow(session, index) {
        const statusColor = this.getHttpStatusColor(session.status_code);
        const methodColor = this.getHttpMethodColor(session.method);
        const responseTime = session.response_time ? `${session.response_time.toFixed(0)}ms` : 'N/A';
        
        return `
            <div class="http-session-row" 
                 style="display: grid; grid-template-columns: 60px 80px 1fr 120px 80px 100px 80px; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background-color 0.2s;"
                 onmouseover="this.style.backgroundColor='#f9fafb'"
                 onmouseout="this.style.backgroundColor='white'"
                 onclick="app.viewHttpSessionDetails('${session.flow_key || ''}', ${index})">
                
                <!-- 序号 -->
                <div style="font-size: 13px; color: #6b7280; font-weight: 500;">${index + 1}</div>
                
                <!-- HTTP方法 -->
                <div>
                    <span style="background: ${methodColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                        ${session.method || 'N/A'}
                    </span>
                </div>
                
                <!-- URL -->
                <div style="font-size: 13px; color: #374151; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${session.url || ''}">
                    ${this.truncateUrl(session.url || '', 60)}
                </div>
                
                <!-- 主机 -->
                <div style="font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${session.host || ''}">
                    ${session.host || 'N/A'}
                </div>
                
                <!-- 状态码 -->
                <div>
                    ${session.status_code ? `
                        <span style="background: ${statusColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                            ${session.status_code}
                        </span>
                    ` : '<span style="color: #9ca3af; font-size: 12px;">pending</span>'}
                </div>
                
                <!-- 响应时间 -->
                <div style="font-size: 13px; color: ${session.response_time > 1000 ? '#ef4444' : session.response_time > 500 ? '#f59e0b' : '#10b981'}; font-weight: 500;">
                    ${responseTime}
                </div>
                
                <!-- 操作 -->
                <div>
                    <button onclick="event.stopPropagation(); app.viewHttpSessionDetails('${session.flow_key || ''}', ${index})" 
                            style="padding: 4px 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; cursor: pointer; color: #1d4ed8; font-size: 11px;">
                        <i class="fas fa-eye"></i> 详情
                    </button>
                </div>
            </div>
        `;
    }

    getHttpMethodColor(method) {
        const colors = {
            'GET': '#10b981',      // 绿色
            'POST': '#3b82f6',     // 蓝色  
            'PUT': '#f59e0b',      // 橙色
            'DELETE': '#ef4444',   // 红色
            'PATCH': '#8b5cf6',    // 紫色
            'HEAD': '#6b7280',     // 灰色
            'OPTIONS': '#06b6d4'   // 青色
        };
        return colors[method] || '#6b7280';
    }

    getHttpStatusColor(statusCode) {
        if (!statusCode) return '#9ca3af';
        
        if (statusCode >= 200 && statusCode < 300) return '#10b981';  // 2xx 成功 - 绿色
        if (statusCode >= 300 && statusCode < 400) return '#f59e0b';  // 3xx 重定向 - 橙色  
        if (statusCode >= 400 && statusCode < 500) return '#ef4444';  // 4xx 客户端错误 - 红色
        if (statusCode >= 500) return '#dc2626';                      // 5xx 服务器错误 - 深红色
        
        return '#6b7280';  // 默认灰色
    }

    truncateUrl(url, maxLength) {
        if (!url || url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    }

    viewHttpSessionDetails(flowKey, sessionIndex) {
        this.showNotification(`查看HTTP会话详情: 流 ${flowKey}`, 'info');
        
        // TODO: 实现HTTP会话详情模态框
        // 这里可以显示完整的请求/响应头部、body等详细信息
        console.log('HTTP Session Details:', flowKey, sessionIndex);
    }

    // =========== 智能诊断引擎界面方法 ===========
    renderSmartInsights(insights) {
        if (!insights) {
            return '';
        }

        const healthStatus = insights.overall_health || 'good';
        const healthConfig = this.getHealthConfig(healthStatus);

        return `
            <div style="margin-bottom: 24px;">
                <h4 style="color: #1f2937; margin-bottom: 16px;">🧠 智能诊断引擎 (AI Insights)</h4>
                
                <!-- 整体健康状态 -->
                <div style="background: ${healthConfig.bgColor}; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${healthConfig.borderColor};">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <i class="${healthConfig.icon}" style="color: ${healthConfig.iconColor}; font-size: 18px;"></i>
                        <span style="font-weight: 700; color: ${healthConfig.textColor}; font-size: 16px;">${healthConfig.title}</span>
                    </div>
                    <div style="color: #374151; font-size: 14px;">${healthConfig.description}</div>
                </div>

                <!-- 诊断分类 -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
                    ${this.renderInsightCategory('🚀 性能问题', insights.performance_issues, '#ef4444')}
                    ${this.renderInsightCategory('🔒 安全风险', insights.security_concerns, '#f59e0b')}
                    ${this.renderInsightCategory('🛠️ 错误模式', insights.error_patterns, '#dc2626')}
                    ${this.renderInsightCategory('💡 优化建议', insights.optimization_suggestions, '#3b82f6')}
                </div>
            </div>
        `;
    }

    getHealthConfig(status) {
        const configs = {
            'good': {
                title: '网络健康状况良好',
                description: '未检测到严重的性能或安全问题，网络运行状态正常',
                bgColor: 'rgba(16, 185, 129, 0.1)',
                borderColor: '#10b981',
                iconColor: '#059669',
                textColor: '#059669',
                icon: 'fas fa-check-circle'
            },
            'warning': {
                title: '发现潜在问题',
                description: '检测到一些需要关注的性能或安全问题，建议及时处理',
                bgColor: 'rgba(245, 158, 11, 0.1)',
                borderColor: '#f59e0b',
                iconColor: '#d97706',
                textColor: '#d97706',
                icon: 'fas fa-exclamation-triangle'
            },
            'critical': {
                title: '发现严重问题',
                description: '检测到严重的安全风险或性能问题，需要立即处理',
                bgColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: '#ef4444',
                iconColor: '#dc2626',
                textColor: '#dc2626',
                icon: 'fas fa-exclamation-circle'
            }
        };
        return configs[status] || configs['good'];
    }

    renderInsightCategory(title, issues, accentColor) {
        if (!issues || issues.length === 0) {
            return `
                <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; padding: 16px;">
                    <h5 style="color: #374151; margin-bottom: 12px; font-size: 14px; font-weight: 600;">${title}</h5>
                    <div style="text-align: center; color: #9ca3af; padding: 20px 0;">
                        <i class="fas fa-check" style="font-size: 16px; margin-bottom: 8px; color: #10b981;"></i>
                        <div style="font-size: 13px;">未发现问题</div>
                    </div>
                </div>
            `;
        }

        return `
            <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; padding: 16px;">
                <h5 style="color: #374151; margin-bottom: 12px; font-size: 14px; font-weight: 600;">
                    ${title}
                    <span style="background: ${accentColor}; color: white; padding: 2px 6px; border-radius: 8px; font-size: 11px; margin-left: 8px;">
                        ${issues.length}
                    </span>
                </h5>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${issues.map(issue => this.renderInsightItem(issue, accentColor)).join('')}
                </div>
            </div>
        `;
    }

    renderInsightItem(issue, accentColor) {
        const severityConfig = this.getSeverityConfig(issue.severity);
        
        return `
            <div style="padding: 12px; border: 1px solid #f3f4f6; border-radius: 6px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.backgroundColor='#f9fafb'; this.style.borderColor='${accentColor}'"
                 onmouseout="this.style.backgroundColor='white'; this.style.borderColor='#f3f4f6'"
                 onclick="app.showInsightDetails('${issue.type}', ${JSON.stringify(issue).replace(/'/g, '\\\'')})">
                
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <span style="font-weight: 500; color: #111827; font-size: 13px;">${issue.title}</span>
                    <span style="background: ${severityConfig.bgColor}; color: ${severityConfig.textColor}; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 500;">
                        ${severityConfig.label}
                    </span>
                </div>
                
                <div style="color: #6b7280; font-size: 12px; line-height: 1.4; margin-bottom: 8px;">
                    ${issue.description}
                </div>
                
                <div style="color: #059669; font-size: 11px; font-style: italic;">
                    💡 ${issue.suggestion}
                </div>
                
                ${issue.details ? `
                    <div style="margin-top: 8px; padding: 6px; background: #f9fafb; border-radius: 4px; font-size: 11px; color: #6b7280;">
                        ${this.formatInsightDetails(issue.details)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    getSeverityConfig(severity) {
        const configs = {
            'critical': { label: '严重', bgColor: '#fef2f2', textColor: '#dc2626' },
            'high': { label: '高', bgColor: '#fef3e2', textColor: '#ea580c' },
            'medium': { label: '中', bgColor: '#fefce8', textColor: '#ca8a04' },
            'low': { label: '低', bgColor: '#f0fdf4', textColor: '#16a34a' }
        };
        return configs[severity] || configs['medium'];
    }

    formatInsightDetails(details) {
        if (typeof details === 'string') return details;
        
        const items = [];
        Object.entries(details).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                items.push(`${key}: ${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}`);
            } else {
                items.push(`${key}: ${value}`);
            }
        });
        
        return items.join(' | ');
    }

    showInsightDetails(type, issue) {
        // TODO: 实现详细信息模态框
        this.showNotification(`查看${issue.title}的详细信息`, 'info');
        console.log('Insight Details:', type, issue);
    }
}

// 应用初始化
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new NetInsightApp();
    // 添加到全局作用域供HTML调用
    window.app = app;
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
}); 