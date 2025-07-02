#!/bin/bash

echo "🚀 启动 NetInsight MVP"
echo "======================="

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 18+，当前版本: $(node -v)"
    exit 1
fi

# 检查Python版本
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python 3.9+"
    exit 1
fi

# 检查MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB 未检测到，请确保MongoDB已安装并运行在 localhost:27017"
    echo "   或者使用 Docker: docker run -d -p 27017:27017 mongo:6.0"
fi

echo "✅ 环境检查通过"

# 创建必要目录
mkdir -p uploads logs
echo "✅ 创建目录完成"

# 安装Node.js依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Node.js 依赖安装失败"
        exit 1
    fi
fi

# 安装Python依赖
echo "🐍 安装 Python 依赖..."

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "📦 创建Python虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔄 激活虚拟环境..."
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Python 依赖安装失败"
    exit 1
fi

echo "✅ Python环境准备完成"

# 设置Python脚本权限
chmod +x analysis-scripts/*.py
echo "✅ 设置脚本权限完成"

# 复制环境配置
if [ ! -f ".env" ]; then
    echo "📝 创建环境配置文件..."
    cat > .env << 'EOF'
# 服务配置
PORT=3000
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/netinsight

# JWT配置
JWT_SECRET=netinsight_jwt_secret_key_2024
JWT_EXPIRES_IN=7d

# 文件存储配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10737418240
ALLOWED_FILE_TYPES=pcap,cap,har,pcapng

# Python脚本路径
PYTHON_SCRIPTS_PATH=./analysis-scripts

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# 分析配置
ANALYSIS_TIMEOUT=300000
MAX_CONCURRENT_ANALYSIS=3
EOF
fi

echo "🎯 启动NetInsight API服务..."
echo "📍 服务地址: http://localhost:3000"
echo "📊 健康检查: http://localhost:3000/health"
echo "📁 文件上传: POST http://localhost:3000/api/files/upload"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 启动服务
npm run dev 