// public/js/report.js

// 解析URL参数获取分析ID
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

async function fetchAnalysis(id) {
    const res = await fetch(`/api/analysis/${id}`);
    return await res.json();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function renderReport() {
    const id = getQueryParam('id');
    const loading = document.getElementById('reportLoading');
    const content = document.getElementById('reportContent');
    if (!id) {
        loading.innerHTML = '<span style="color:#ef4444">未指定分析ID</span>';
        return;
    }
    loading.style.display = '';
    content.style.display = 'none';
    try {
        const result = await fetchAnalysis(id);
        if (!result.success) throw new Error('获取分析数据失败');
        const file = result.data.file || {};
        const analysis = result.data.results;
        const topProtocols = (analysis.protocols || []).slice(0, 3);
        const anomaliesCount = (analysis.anomalies || []).length;
        const topConversationsCount = Math.min(
            (analysis.network?.topSources || []).length * 
            (analysis.network?.topDestinations || []).length, 
            5
        );
        // 健康诊断数据
        const insights = analysis.insights || {};
        const healthStatus = insights.overall_health || 'good';
        const healthConfig = {
            good: {
                title: '网络健康状况良好',
                desc: '未检测到严重的性能或安全问题，网络运行状态正常',
                color: '#10b981',
                icon: 'fa-check-circle'
            },
            warning: {
                title: '发现潜在问题',
                desc: '检测到一些需要关注的性能或安全问题，建议及时处理',
                color: '#f59e0b',
                icon: 'fa-exclamation-triangle'
            },
            critical: {
                title: '发现严重问题',
                desc: '检测到严重的安全风险或性能问题，需要立即处理',
                color: '#ef4444',
                icon: 'fa-exclamation-circle'
            }
        }[healthStatus] || {
            title: '未知', desc: '', color: '#64748b', icon: 'fa-question-circle'
        };
        // 智能诊断分区内容
        function renderInsightList(title, list, color) {
            if (!list || !list.length) return '';
            return `<div style="margin-bottom: 12px;">
                <div style="font-weight:600;color:${color};margin-bottom:4px;">${title}</div>
                <ul style="margin:0 0 0 16px;padding:0;">
                    ${list.map(item => `<li style="margin-bottom:2px;">${item.title || item}</li>`).join('')}
                </ul>
            </div>`;
        }
        // ========== 协议分布与流量趋势分区 ========== //
        function renderProtocolDistribution(protocols) {
            if (!protocols || !protocols.length) return '<div style="color:#9ca3af;text-align:center;">暂无协议数据</div>';
            // 取前5个协议
            const top = protocols.slice(0, 5);
            const maxPackets = Math.max(...top.map(p => p.packets || 0), 1);
            return `
                <div style="margin-bottom:24px;">
                    <h4 style="font-size:15px;font-weight:600;color:#fff;margin-bottom:12px;">🌐 主要协议分布</h4>
                    <div style="display:flex;gap:24px;align-items:flex-end;">
                        <div style="flex:1;">
                            ${top.map(p => `
                                <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
                                    <div style="width:80px;color:#a5b4fc;font-size:13px;">${p.name}</div>
                                    <div style="flex:1;background:#3b82f6;height:12px;border-radius:6px;position:relative;">
                                        <div style="background:#60a5fa;height:12px;border-radius:6px;width:${Math.round((p.packets||0)/maxPackets*100)}%;"></div>
                                    </div>
                                    <div style="width:60px;text-align:right;color:#fff;font-size:13px;">${p.packets} 包</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="min-width:120px;">
                            <table style="width:100%;font-size:12px;color:#e0e7ff;">
                                <thead><tr><th>协议</th><th>包数</th></tr></thead>
                                <tbody>
                                    ${top.map(p => `<tr><td>${p.name}</td><td>${p.packets}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
        function renderTrafficTimeline(timeline) {
            if (!timeline || !timeline.length) return '<div style="color:#9ca3af;text-align:center;">暂无流量时间线数据</div>';
            // SVG折线图
            const maxRate = Math.max(...timeline.map(pt => pt.rate||0), 1);
            const width = 600, height = 120, padding = 30;
            const points = timeline.map((pt, i) => {
                const x = padding + (i/(timeline.length-1))*(width-2*padding);
                const y = height-padding - (pt.rate/maxRate)*(height-2*padding);
                return `${x},${y}`;
            }).join(' ');
            
            // 生成circle元素
            const circles = timeline.map((pt, i) => {
                const x = padding + (i/(timeline.length-1))*(width-2*padding);
                const y = height-padding - (pt.rate/maxRate)*(height-2*padding);
                return `<circle cx="${x}" cy="${y}" r="3" fill="#3b82f6" opacity="0.7" />`;
            }).join('');
            
            return `
                <div style="margin-bottom:24px;">
                    <h4 style="font-size:15px;font-weight:600;color:#fff;margin-bottom:12px;">📈 流量时间线</h4>
                    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="background:rgba(59,130,246,0.05);border-radius:8px;">
                        <polyline fill="none" stroke="#3b82f6" stroke-width="2" points="${points}" />
                        ${circles}
                    </svg>
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#a5b4fc;margin-top:4px;">
                        <span>${new Date(timeline[0].timestamp*1000).toLocaleTimeString()}</span>
                        <span>流量趋势</span>
                        <span>${new Date(timeline[timeline.length-1].timestamp*1000).toLocaleTimeString()}</span>
                    </div>
                </div>
            `;
        }
        // ========== 主体渲染 ========== //
        content.innerHTML = `
            <div class="analysis-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); margin-bottom: 32px;">
                <div style="padding: 24px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
                    <div class="analysis-header" style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <i class="fas fa-file-alt" style="font-size: 18px; opacity: 0.9;"></i>
                            <div class="analysis-title" style="font-size: 18px; font-weight: 600;">${file.originalName || ''}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="analysis-status" style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; border: 1px solid rgba(16, 185, 129, 0.3);">
                                <i class="fas fa-check-circle"></i>
                                分析完成
                            </div>
                            <div style="color: rgba(255, 255, 255, 0.8); font-size: 13px;">
                                ${(file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : '')}
                            </div>
                        </div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: rgba(255, 255, 255, 0.95);">🚀 一眼看懂</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                            <div style="text-align: center;">
                                <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${formatFileSize(analysis.summary?.totalBytes || 0)}</div>
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
                                <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #facc15;">${anomaliesCount}</div>
                                <div style="font-size: 12px; opacity: 0.8;">发现问题</div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-bottom: 24px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <i class="fas ${healthConfig.icon}" style="color:${healthConfig.color};font-size:18px;"></i>
                            <span style="font-weight:600;font-size:15px;color:${healthConfig.color}">${healthConfig.title}</span>
                            <span style="margin-left:12px;color:#e0e7ff;font-size:13px;">${healthConfig.desc}</span>
                        </div>
                    </div>
                    <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:16px 20px 8px 20px;">
                        ${renderInsightList('性能问题', insights.performance_issues, '#ef4444')}
                        ${renderInsightList('安全风险', insights.security_concerns, '#f59e0b')}
                        ${renderInsightList('优化建议', insights.optimization_suggestions, '#3b82f6')}
                        ${renderInsightList('错误模式', insights.error_patterns, '#dc2626')}
                        ${(!insights.performance_issues && !insights.security_concerns && !insights.optimization_suggestions && !insights.error_patterns) ? '<div style="color:#10b981;">未发现异常，网络健康</div>' : ''}
                    </div>
                </div>
            </div>
            <div class="analysis-card" style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.08); margin-bottom: 32px;">
                <div style="padding: 24px;">
                    ${renderProtocolDistribution(analysis.protocols)}
                    ${renderTrafficTimeline((analysis.temporal && analysis.temporal.trafficTimeline) || [])}
                </div>
            </div>
            <!-- 后续分区继续扩展 -->
        `;
        loading.style.display = 'none';
        content.style.display = '';
    } catch (error) {
        loading.innerHTML = `<span style="color:#ef4444">加载失败: ${error.message}</span>`;
        content.style.display = 'none';
    }
}

window.addEventListener('DOMContentLoaded', renderReport); 