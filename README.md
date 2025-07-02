# NetInsight - 智能网络分析平台

<div align="center">
  <img src="https://img.shields.io/badge/Version-v1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/Python-3.8+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/Docker-Ready-brightgreen.svg" alt="Docker">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</div>

## 🎯 项目简介

**NetInsight** 是一个专业的网络分析SaaS平台，致力于让非专家用户也能轻松理解网络数据包，快速定位网络问题。

### 🚀 核心价值主张
> **"让你无需成为网络专家，也能看懂网络数据包，快速定位问题"**

### 👥 目标用户
- **初级运维/IT支持人员**：需要快速诊断用户报告的"网络慢"、"连不上"等问题
- **Web/App开发者**：需要调试API调用、查看HTTP请求/响应
- **客户成功/技术支持团队**：需要根据客户提供的抓包文件验证问题根源
- **有技术背景的小企业主/站长**：想检查网站性能或是否存在可疑流量

## ✨ 核心功能

### 🔥 杀手级功能
- **HTTP会话流重建**：自动重建TCP流为可读的HTTP请求/响应对，类似浏览器开发者工具Network面板
- **智能诊断引擎**：AI驱动的问题发现和优化建议，将技术术语转换为自然语言

### 🧠 智能分析能力
- **性能问题自动检测**：慢查询API(>2秒)、高延迟模式、重复请求检测
- **安全风险识别**：HTTP明文传输、URL敏感信息、Cookie安全标志
- **错误模式分析**：4xx客户端错误、5xx服务器错误、重定向过多
- **优化建议生成**：缓存策略、压缩优化、资源合并建议

### 📊 可视化分析
- **协议分布可视化**：动态条形图 + SVG饼图，协议占比一目了然
- **Top N对话**：智能识别最重要的通信关系，自动分类内网↔外网流量
- **网络活动热点**：自动识别最活跃的源IP和目标IP设备
- **智能过滤系统**：直观的协议和IP过滤，无需学习复杂语法

## 🛠️ 技术栈

### 后端技术
- **Node.js 18+** - 服务器运行时
- **Express.js** - Web应用框架
- **MongoDB** - 数据库存储
- **Python 3.8+** - 数据包分析引擎
- **Scapy** - 网络数据包处理库

### 前端技术
- **原生JavaScript** - 前端逻辑
- **HTML5/CSS3** - 用户界面
- **Chart.js** - 数据可视化
- **Font Awesome** - 图标库

### 部署技术
- **Docker & Docker Compose** - 容器化部署
- **Nginx** - 反向代理（可选）
- **PM2** - 进程管理（生产环境）

## 🚀 快速开始

### 环境要求
- Docker & Docker Compose
- Node.js 18+ (本地开发)
- Python 3.8+ (本地开发)

### 一键部署
```bash
# 克隆项目
git clone https://github.com/jlingjace/netinsight-analyst.git
cd netinsight-analyst

# 启动所有服务
docker-compose up -d

# 访问应用
open http://localhost:3000
```

### 本地开发
```bash
# 安装依赖
npm install
pip install -r requirements.txt

# 启动MongoDB
docker run -d -p 27017:27017 --name netinsight-mongodb mongo:latest

# 启动应用
npm start

# 访问应用
open http://localhost:3000
```

## 📁 项目结构

```
netinsight-analyst/
├── 📂 src/                    # Node.js 后端代码
│   ├── 📂 config/            # 配置文件
│   ├── 📂 middleware/        # 中间件
│   ├── 📂 models/            # 数据模型
│   ├── 📂 routes/            # 路由定义
│   ├── 📂 services/          # 业务逻辑
│   └── 📂 utils/             # 工具函数
├── 📂 public/                # 前端静态文件
│   ├── 📂 css/               # 样式文件
│   ├── 📂 js/                # JavaScript文件
│   └── index.html            # 主页面
├── 📂 analysis-scripts/      # Python分析脚本
│   ├── analyze_pcap.py       # PCAP文件分析
│   └── analyze_har.py        # HAR文件分析
├── 📂 uploads/               # 上传文件存储
├── 📂 logs/                  # 日志文件
├── docker-compose.yml        # Docker编排文件
├── Dockerfile               # Docker镜像构建
└── README.md                # 项目文档
```

## 🎮 使用指南

### 1. 上传网络文件
支持以下格式：
- **PCAP/PCAPNG** - Wireshark抓包文件
- **CAP** - 网络捕获文件  
- **HAR** - 浏览器导出的HTTP Archive文件

### 2. 查看分析结果
- **一眼看懂模块**：总流量、主要协议、通信对话、发现问题
- **HTTP会话流重建**：完整的请求/响应对展示
- **智能诊断引擎**：AI发现的问题和优化建议
- **协议分布可视化**：直观的饼图和柱状图

### 3. 深度分析
- **Top N对话**：查看最重要的网络通信
- **安全审计**：检查明文传输、敏感信息泄露
- **性能优化**：发现慢查询、缓存问题、资源优化机会

## 🔧 配置说明

### 环境变量
```bash
# 服务配置
PORT=3000                    # 服务端口
NODE_ENV=production          # 运行环境

# 数据库配置  
MONGODB_URI=mongodb://localhost:27017/netinsight

# 文件上传配置
MAX_FILE_SIZE=10737418240    # 最大文件大小(10GB)
UPLOAD_DIR=/app/uploads      # 上传目录

# 分析配置
MAX_CONCURRENT_ANALYSIS=3    # 最大并发分析数
ANALYSIS_TIMEOUT=300000      # 分析超时时间(5分钟)
```

### Docker Compose配置
参考 `docker-compose.yml` 文件进行个性化配置。

## 🏗️ 开发指南

### API接口
- `GET /api/files` - 获取文件列表
- `POST /api/files/upload` - 上传文件
- `GET /api/analysis/:id` - 获取分析结果
- `POST /api/analysis/:id/restart` - 重新分析文件

### 添加新的分析功能
1. 在 `analysis-scripts/` 中添加Python分析脚本
2. 更新 `src/models/Analysis.js` 数据模型
3. 修改 `public/js/app.js` 前端展示逻辑

### 自定义主题
修改 `public/css/styles.css` 文件中的CSS变量。

## 📈 产品发展路线图

### ✅ MVP阶段（已完成）
- [x] 文件上传和基础分析
- [x] HTTP会话流重建
- [x] 智能诊断引擎
- [x] 可视化界面

### 🚧 增强阶段（开发中）
- [ ] 高级可视化（时序图、网络拓扑）
- [ ] 实时流量分析
- [ ] 团队协作功能
- [ ] API接入能力

### 🔮 生态阶段（规划中）
- [ ] 报告生成与导出
- [ ] 特定协议深度解析
- [ ] 移动端适配
- [ ] 企业级功能

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- JavaScript: 使用 ESLint
- Python: 使用 Black + Flake8
- 提交信息: 使用 Conventional Commits

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Scapy](https://scapy.net/) - 强大的Python网络分析库
- [Chart.js](https://www.chartjs.org/) - 优秀的JavaScript图表库
- [Font Awesome](https://fontawesome.com/) - 丰富的图标资源

## 📞 联系我们

- **项目主页**: https://github.com/jlingjace/netinsight-analyst
- **问题反馈**: [Issues](https://github.com/jlingjace/netinsight-analyst/issues)
- **功能建议**: [Discussions](https://github.com/jlingjace/netinsight-analyst/discussions)

---

<div align="center">
  <p>⭐ 如果这个项目对你有帮助，请给我们一个Star！⭐</p>
  <p>Made with ❤️ by NetInsight Team</p>
</div>

## 最新更新

- ✅ **重大BUG修复 + 功能完善** (2025-01-02) 🔧 **系统稳定性提升**
  - **上传时间显示修复**：从"Invalid Date"修复为正确的时间格式显示
  - **数据库Schema更新**：添加http_sessions和smart_insights字段支持
  - **分析结果完整显示**：HTTP会话流重建和智能诊断引擎现在正确显示
  - **历史记录修复**：所有上传文件的分析结果现在都可以正常查看
  - **字段映射修复**：前端使用正确的uploadedAt字段显示上传时间

- ✅ **智能诊断引擎上线** (2025-01-02) 🧠 **AI驱动功能**
  - **性能问题自动检测**：慢查询API(>2秒)、高延迟模式、重复请求检测
  - **安全风险识别**：HTTP明文传输、URL敏感信息、Cookie安全标志
  - **错误模式分析**：4xx客户端错误、5xx服务器错误、重定向过多
  - **优化建议生成**：缓存策略、压缩优化、资源合并建议
  - **智能健康评估**：good/warning/critical三级健康状态
  - **自然语言描述**：技术术语转换为易懂的问题描述和解决建议

- ✅ **HTTP会话流重建功能上线** (2025-01-02) 🚀 **杀手级功能**
  - **完整HTTP会话分析**：自动重建TCP流为可读的HTTP请求/响应对
  - **类似开发者工具**：模仿浏览器Network面板，显示方法、URL、状态码、响应时间
  - **性能洞察**：响应时间颜色编码（绿色<500ms，橙色<1000ms，红色>1000ms）
  - **安全审计**：展示HTTP头部、Cookie、User-Agent等敏感信息
  - **协议分布饼图修复**：使用SVG重新实现，彻底解决显示问题
  - **完全解除文件大小限制**：从50MB提升到10GB，支持大型网络抓包文件
