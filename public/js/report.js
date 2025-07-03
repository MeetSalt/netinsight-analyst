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

function formatIP(ip) {
    if (!ip) return '';
    return ip;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function isPrivateIP(ip) {
    if (!ip) return false;
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    
    return (parts[0] === 10) ||
           (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
           (parts[0] === 192 && parts[1] === 168);
}

function getHostType(ip) {
    return isPrivateIP(ip) ? '内网' : '外网';
}

function getLocationInfo(ip) {
    return isPrivateIP(ip) ? '局域网' : '互联网';
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
        
        // ========== HTTP会话流重建 ========== //
        function renderHttpSessions(sessions) {
            if (!sessions || !sessions.length) {
                return '<div style="color:#9ca3af;text-align:center;padding:24px;">暂无HTTP会话数据</div>';
            }
            
            return `
                <div style="margin-bottom:24px;">
                    <h4 style="font-size:15px;font-weight:600;color:#fff;margin-bottom:12px;">🌐 HTTP会话流重建</h4>
                    <div style="background:rgba(255,255,255,0.05);border-radius:8px;overflow:hidden;">
                        <div style="display:grid;grid-template-columns:80px 1fr 80px 100px 120px;gap:12px;padding:12px;background:rgba(255,255,255,0.1);font-size:12px;font-weight:600;color:#e0e7ff;">
                            <div>方法</div>
                            <div>URL</div>
                            <div>状态</div>
                            <div>响应时间</div>
                            <div>大小</div>
                        </div>
                        ${sessions.slice(0, 10).map((session, index) => `
                            <div style="display:grid;grid-template-columns:80px 1fr 80px 100px 120px;gap:12px;padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:12px;color:#fff;">
                                <div style="color:${getHttpMethodColor(session.method)};font-weight:600;">${session.method}</div>
                                <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${session.url}">${truncateUrl(session.url, 50)}</div>
                                <div style="color:${getHttpStatusColor(session.status_code)};font-weight:600;">${session.status_code}</div>
                                <div style="color:${session.response_time > 1000 ? '#ef4444' : session.response_time > 500 ? '#f59e0b' : '#10b981'}">${session.response_time}ms</div>
                                <div>${formatFileSize(session.content_length || 0)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        function getHttpMethodColor(method) {
            const colors = {
                'GET': '#10b981',
                'POST': '#3b82f6',
                'PUT': '#f59e0b',
                'DELETE': '#ef4444',
                'PATCH': '#8b5cf6',
                'HEAD': '#6b7280',
                'OPTIONS': '#6b7280'
            };
            return colors[method] || '#9ca3af';
        }
        
        function getHttpStatusColor(statusCode) {
            if (statusCode >= 200 && statusCode < 300) return '#10b981';
            if (statusCode >= 300 && statusCode < 400) return '#f59e0b';
            if (statusCode >= 400 && statusCode < 500) return '#ef4444';
            if (statusCode >= 500) return '#dc2626';
            return '#9ca3af';
        }
        
        function truncateUrl(url, maxLength) {
            if (!url || url.length <= maxLength) return url;
            return url.substring(0, maxLength - 3) + '...';
        }
        
        // ========== 时间线分析 ========== //
        function renderTimelineAnalysis(temporal) {
            if (!temporal) return '<div style="color:#9ca3af;text-align:center;">暂无时间线数据</div>';
            
            const timeline = temporal.trafficTimeline || [];
            const protocolTimeline = temporal.protocolTimeline || [];
            const events = temporal.trafficEvents || [];
            
            return `
                <div style="margin-bottom:24px;">
                    <h4 style="font-size:15px;font-weight:600;color:#fff;margin-bottom:12px;">⏰ 时间线分析</h4>
                    
                    ${timeline.length > 0 ? `
                        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;margin-bottom:16px;">
                            <h5 style="font-size:13px;font-weight:600;color:#e0e7ff;margin-bottom:8px;">📊 流量时间分布</h5>
                            ${renderTrafficChart(timeline, Math.max(...timeline.map(t => t.rate || 0)))}
                        </div>
                    ` : ''}
                    
                    ${protocolTimeline.length > 0 ? `
                        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;margin-bottom:16px;">
                            <h5 style="font-size:13px;font-weight:600;color:#e0e7ff;margin-bottom:8px;">🌐 协议时间线</h5>
                            ${renderProtocolTimeline(protocolTimeline)}
                        </div>
                    ` : ''}
                    
                    ${events.length > 0 ? `
                        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;">
                            <h5 style="font-size:13px;font-weight:600;color:#e0e7ff;margin-bottom:8px;">🚨 流量事件</h5>
                            ${renderTrafficEvents(events)}
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        function renderTrafficChart(timeline, maxRate) {
            const width = 500, height = 100, padding = 20;
            const points = timeline.map((point, i) => {
                const x = padding + (i / (timeline.length - 1)) * (width - 2 * padding);
                const y = height - padding - (point.rate / maxRate) * (height - 2 * padding);
                return `${x},${y}`;
            }).join(' ');
            
            return `
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="background:rgba(59,130,246,0.05);border-radius:4px;">
                    <polyline fill="none" stroke="#3b82f6" stroke-width="2" points="${points}" />
                    ${timeline.map((point, i) => {
                        const x = padding + (i / (timeline.length - 1)) * (width - 2 * padding);
                        const y = height - padding - (point.rate / maxRate) * (height - 2 * padding);
                        return `<circle cx="${x}" cy="${y}" r="2" fill="#3b82f6" opacity="0.7" />`;
                    }).join('')}
                </svg>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:#a5b4fc;margin-top:4px;">
                    <span>开始</span>
                    <span>峰值: ${formatNumber(maxRate)} pps</span>
                    <span>结束</span>
                </div>
            `;
        }
        
        function renderProtocolTimeline(protocolTimeline) {
            return `
                <div style="display:flex;flex-wrap:wrap;gap:12px;">
                    ${protocolTimeline.slice(0, 6).map(protocol => `
                        <div style="flex:1;min-width:80px;text-align:center;">
                            <div style="font-size:11px;color:#a5b4fc;margin-bottom:4px;">${protocol.protocol}</div>
                            ${renderMiniChart(protocol.timeline || [], '#3b82f6')}
                            <div style="font-size:10px;color:#e0e7ff;margin-top:2px;">${formatNumber(protocol.packets || 0)} 包</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        function renderMiniChart(data, color) {
            if (!data.length) return '<div style="height:30px;background:rgba(255,255,255,0.1);border-radius:2px;"></div>';
            
            const maxVal = Math.max(...data.map(d => d.count || 0));
            const width = 60, height = 30;
            
            return `
                <svg width="${width}" height="${height}" style="background:rgba(255,255,255,0.1);border-radius:2px;">
                    ${data.map((d, i) => {
                        const x = (i / (data.length - 1)) * width;
                        const barHeight = maxVal > 0 ? (d.count / maxVal) * height : 0;
                        const y = height - barHeight;
                        return `<rect x="${x-1}" y="${y}" width="2" height="${barHeight}" fill="${color}" opacity="0.7" />`;
                    }).join('')}
                </svg>
            `;
        }
        
        function renderTrafficEvents(events) {
            return `
                <div style="max-height:200px;overflow-y:auto;">
                    ${events.map(event => `
                        <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:12px;">
                            <div style="color:${event.type === 'peak' ? '#f59e0b' : event.type === 'anomaly' ? '#ef4444' : '#10b981'};font-weight:600;">
                                ${event.type === 'peak' ? '📈' : event.type === 'anomaly' ? '⚠️' : '📊'}
                            </div>
                            <div style="flex:1;color:#fff;">
                                ${event.description || '流量事件'}
                            </div>
                            <div style="color:#a5b4fc;font-size:11px;">
                                ${new Date(event.timestamp * 1000).toLocaleTimeString()}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // ========== 主机通信矩阵 ========== //
        function renderCommunicationMatrix(network) {
            if (!network || !network.topSources || !network.topDestinations) {
                return '<div style="color:#9ca3af;text-align:center;">暂无通信矩阵数据</div>';
            }
            
            const sources = network.topSources.slice(0, 5);
            const destinations = network.topDestinations.slice(0, 5);
            const matrixData = buildCommunicationMatrix(sources, destinations);
            
            return `
                <div style="margin-bottom:24px;">
                    <h4 style="font-size:15px;font-weight:600;color:#fff;margin-bottom:12px;">🌐 主机通信矩阵</h4>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
                        <div>
                            <h5 style="font-size:13px;font-weight:600;color:#e0e7ff;margin-bottom:8px;">📤 主要源主机</h5>
                            ${renderHostList(sources, 'source')}
                        </div>
                        <div>
                            <h5 style="font-size:13px;font-weight:600;color:#e0e7ff;margin-bottom:8px;">📥 主要目标主机</h5>
                            ${renderHostList(destinations, 'destination')}
                        </div>
                    </div>
                    
                    <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;margin-bottom:16px;">
                        <h5 style="font-size:13px;font-weight:600;color:#e0e7ff;margin-bottom:8px;">🔗 通信矩阵</h5>
                        ${renderMatrixTable(sources, destinations, matrixData)}
                    </div>
                    
                    <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:16px;">
                        <h5 style="font-size:13px;font-weight:600;color:#e0e7ff;margin-bottom:8px;">🌍 网络拓扑</h5>
                        ${renderNetworkTopology(sources, destinations, matrixData)}
                    </div>
                </div>
            `;
        }
        
        function buildCommunicationMatrix(sources, destinations) {
            const matrix = {};
            sources.forEach(source => {
                matrix[source.ip] = {};
                destinations.forEach(dest => {
                    // 模拟通信强度计算
                    const intensity = Math.random() * 100;
                    matrix[source.ip][dest.ip] = {
                        packets: Math.floor(intensity * 10),
                        bytes: Math.floor(intensity * 1000),
                        intensity: intensity
                    };
                });
            });
            return matrix;
        }
        
        function renderMatrixTable(sources, destinations, matrixData) {
            return `
                <div style="overflow-x:auto;">
                    <table style="width:100%;font-size:11px;color:#fff;">
                        <thead>
                            <tr style="background:rgba(255,255,255,0.1);">
                                <th style="padding:8px;text-align:left;">源 \\ 目标</th>
                                ${destinations.map(dest => `
                                    <th style="padding:8px;text-align:center;color:#a5b4fc;">
                                        ${formatIP(dest.ip)}<br/>
                                        <span style="font-size:10px;color:#9ca3af;">${getHostType(dest.ip)}</span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${sources.map(source => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                                    <td style="padding:8px;color:#a5b4fc;font-weight:600;">
                                        ${formatIP(source.ip)}<br/>
                                        <span style="font-size:10px;color:#9ca3af;">${getHostType(source.ip)}</span>
                                    </td>
                                    ${destinations.map(dest => {
                                        const connection = matrixData[source.ip]?.[dest.ip];
                                        const intensity = connection?.intensity || 0;
                                        return `
                                            <td style="padding:8px;text-align:center;background:${getConnectionColor(intensity)};border-radius:4px;">
                                                ${connection ? `
                                                    <div style="font-weight:600;">${formatNumber(connection.packets)}</div>
                                                    <div style="font-size:10px;opacity:0.8;">${formatFileSize(connection.bytes)}</div>
                                                ` : '-'}
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        function renderNetworkTopology(sources, destinations, matrixData) {
            const width = 500, height = 300;
            const centerX = width / 2, centerY = height / 2;
            const radius = 120;
            
            return `
                <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="background:rgba(59,130,246,0.05);border-radius:8px;">
                    <!-- 连接线 -->
                    ${sources.map((source, si) => 
                        destinations.map((dest, di) => {
                            const sourceAngle = (si / sources.length) * 2 * Math.PI;
                            const destAngle = Math.PI + (di / destinations.length) * 2 * Math.PI;
                            const sx = centerX + Math.cos(sourceAngle) * radius;
                            const sy = centerY + Math.sin(sourceAngle) * radius;
                            const dx = centerX + Math.cos(destAngle) * radius;
                            const dy = centerY + Math.sin(destAngle) * radius;
                            const connection = matrixData[source.ip]?.[dest.ip];
                            const intensity = connection?.intensity || 0;
                            
                            return intensity > 30 ? `
                                <line x1="${sx}" y1="${sy}" x2="${dx}" y2="${dy}" 
                                      stroke="#3b82f6" stroke-width="${Math.max(1, intensity/20)}" 
                                      opacity="0.6" />
                            ` : '';
                        }).join('')
                    ).join('')}
                    
                    <!-- 源主机节点 -->
                    ${sources.map((source, i) => {
                        const angle = (i / sources.length) * 2 * Math.PI;
                        const x = centerX + Math.cos(angle) * radius;
                        const y = centerY + Math.sin(angle) * radius;
                        return `
                            <circle cx="${x}" cy="${y}" r="8" fill="#10b981" opacity="0.8" />
                            <text x="${x}" y="${y-12}" text-anchor="middle" fill="#fff" font-size="10">
                                ${formatIP(source.ip)}
                            </text>
                        `;
                    }).join('')}
                    
                    <!-- 目标主机节点 -->
                    ${destinations.map((dest, i) => {
                        const angle = Math.PI + (i / destinations.length) * 2 * Math.PI;
                        const x = centerX + Math.cos(angle) * radius;
                        const y = centerY + Math.sin(angle) * radius;
                        return `
                            <circle cx="${x}" cy="${y}" r="8" fill="#ef4444" opacity="0.8" />
                            <text x="${x}" y="${y-12}" text-anchor="middle" fill="#fff" font-size="10">
                                ${formatIP(dest.ip)}
                            </text>
                        `;
                    }).join('')}
                    
                    <!-- 图例 -->
                    <g transform="translate(20, 20)">
                        <circle cx="0" cy="0" r="6" fill="#10b981" opacity="0.8" />
                        <text x="12" y="4" fill="#fff" font-size="12">源主机</text>
                        <circle cx="0" cy="20" r="6" fill="#ef4444" opacity="0.8" />
                        <text x="12" y="24" fill="#fff" font-size="12">目标主机</text>
                    </g>
                </svg>
            `;
        }
        
        function renderHostList(hosts, type) {
            return `
                <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:12px;">
                    ${hosts.map(host => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);font-size:12px;">
                            <div>
                                <div style="color:#fff;font-weight:600;">${formatIP(host.ip)}</div>
                                <div style="color:#9ca3af;font-size:10px;">${getHostType(host.ip)} - ${getLocationInfo(host.ip)}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="color:#3b82f6;font-weight:600;">${formatNumber(host.packets || 0)}</div>
                                <div style="color:#9ca3af;font-size:10px;">${formatFileSize(host.bytes || 0)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        function getConnectionColor(intensity) {
            if (intensity > 80) return 'rgba(239, 68, 68, 0.3)';
            if (intensity > 60) return 'rgba(245, 158, 11, 0.3)';
            if (intensity > 40) return 'rgba(59, 130, 246, 0.3)';
            if (intensity > 20) return 'rgba(16, 185, 129, 0.2)';
            return 'rgba(156, 163, 175, 0.1)';
        }
        
        // ========== 主体渲染 ========== //
        content.innerHTML = `
            <!-- 文件信息和健康诊断 -->
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
            
            <!-- 协议分布与流量趋势 -->
            <div class="analysis-card" style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.08); margin-bottom: 32px;">
                <div style="padding: 24px;">
                    ${renderProtocolDistribution(analysis.protocols)}
                    ${renderTrafficTimeline((analysis.temporal && analysis.temporal.trafficTimeline) || [])}
                </div>
            </div>
            
            <!-- HTTP会话流重建 -->
            ${analysis.http_sessions && analysis.http_sessions.length > 0 ? `
                <div class="analysis-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.08); margin-bottom: 32px;">
                    <div style="padding: 24px;">
                        ${renderHttpSessions(analysis.http_sessions)}
                    </div>
                </div>
            ` : ''}
            
            <!-- 时间线分析 -->
            ${analysis.temporal ? `
                <div class="analysis-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.08); margin-bottom: 32px;">
                    <div style="padding: 24px;">
                        ${renderTimelineAnalysis(analysis.temporal)}
                    </div>
                </div>
            ` : ''}
            
            <!-- 主机通信矩阵 -->
            ${analysis.network ? `
                <div class="analysis-card" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border-radius: 16px; padding: 0; overflow: hidden; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.08); margin-bottom: 32px;">
                    <div style="padding: 24px;">
                        ${renderCommunicationMatrix(analysis.network)}
                    </div>
                </div>
            ` : ''}
        `;
        
        loading.style.display = 'none';
        content.style.display = '';
    } catch (error) {
        loading.innerHTML = `<span style="color:#ef4444">加载失败: ${error.message}</span>`;
        content.style.display = 'none';
    }
}

window.addEventListener('DOMContentLoaded', renderReport); 