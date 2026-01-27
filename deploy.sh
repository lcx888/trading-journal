#!/bin/bash

# ============================================
# TradeWhy.AI Trading Journal 一键部署脚本
# 适用于 Ubuntu 22.04
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "============================================"
echo "  TradeWhy.AI Trading Journal 部署脚本"
echo "============================================"
echo -e "${NC}"

# 配置变量 - 请根据需要修改
DOMAIN="${1:-}"  # 域名，如果不传则使用 IP 访问
DB_PASSWORD="${2:-$(openssl rand -base64 12)}"
JWT_SECRET="$(openssl rand -base64 32)"
APP_DIR="/var/www/tradewhy"
REPO_URL="https://github.com/lcx888/trading-journal.git"

echo -e "${YELLOW}配置信息：${NC}"
echo "  域名: ${DOMAIN:-'使用 IP 访问'}"
echo "  安装目录: $APP_DIR"
echo "  数据库密码: $DB_PASSWORD"
echo ""

read -p "确认继续部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 1
fi

# ============================================
# 1. 系统更新和基础依赖
# ============================================
echo -e "\n${GREEN}[1/8] 更新系统和安装基础依赖...${NC}"
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git build-essential

# ============================================
# 2. 安装 Node.js 20
# ============================================
echo -e "\n${GREEN}[2/8] 安装 Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node.js 版本: $(node -v)"
echo "NPM 版本: $(npm -v)"

# ============================================
# 3. 安装 PostgreSQL
# ============================================
echo -e "\n${GREEN}[3/8] 安装 PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
fi
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库和用户
sudo -u postgres psql -c "DROP DATABASE IF EXISTS trading_journal;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS tradewhy;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER tradewhy WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE trading_journal OWNER tradewhy;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE trading_journal TO tradewhy;"

echo -e "${GREEN}PostgreSQL 配置完成${NC}"

# ============================================
# 4. 安装 PM2
# ============================================
echo -e "\n${GREEN}[4/8] 安装 PM2...${NC}"
sudo npm install -g pm2

# ============================================
# 5. 克隆代码
# ============================================
echo -e "\n${GREEN}[5/8] 克隆代码...${NC}"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR
cd $APP_DIR

if [ -d ".git" ]; then
    echo "代码已存在，拉取最新版本..."
    git pull
else
    git clone $REPO_URL .
fi

# ============================================
# 6. 部署后端
# ============================================
echo -e "\n${GREEN}[6/8] 部署后端...${NC}"
cd $APP_DIR/server

# 安装依赖
npm install

# 创建环境变量
cat > .env << EOF
DATABASE_URL="postgresql://tradewhy:${DB_PASSWORD}@localhost:5432/trading_journal"
JWT_SECRET="${JWT_SECRET}"
PORT=4000
CORS_ORIGIN="${DOMAIN:+https://$DOMAIN}"
EOF

# 如果没有域名，允许所有来源
if [ -z "$DOMAIN" ]; then
    sed -i 's/CORS_ORIGIN=.*/CORS_ORIGIN="*"/' .env
fi

# 生成 Prisma 客户端并同步数据库
npx prisma generate
npx prisma db push

# 使用 PM2 启动后端
pm2 delete tradewhy-api 2>/dev/null || true
pm2 start src/index.js --name tradewhy-api
pm2 save

echo -e "${GREEN}后端部署完成，运行在 http://localhost:4000${NC}"

# ============================================
# 7. 构建前端
# ============================================
echo -e "\n${GREEN}[7/8] 构建前端...${NC}"
cd $APP_DIR

# 安装依赖
npm install

# 设置 API 地址
if [ -n "$DOMAIN" ]; then
    echo "VITE_API_BASE_URL=https://$DOMAIN/api" > .env.production
else
    # 获取服务器公网 IP
    PUBLIC_IP=$(curl -s ifconfig.me)
    echo "VITE_API_BASE_URL=http://$PUBLIC_IP/api" > .env.production
fi

# 构建
npm run build

echo -e "${GREEN}前端构建完成${NC}"

# ============================================
# 8. 配置 Nginx
# ============================================
echo -e "\n${GREEN}[8/8] 配置 Nginx...${NC}"
sudo apt install -y nginx

# 创建 Nginx 配置
if [ -n "$DOMAIN" ]; then
    SERVER_NAME="$DOMAIN"
else
    SERVER_NAME="_"
fi

sudo tee /etc/nginx/sites-available/tradewhy > /dev/null << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # 前端静态文件
    root $APP_DIR/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        rewrite ^/api/(.*) /\$1 break;
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 启用配置
sudo ln -sf /etc/nginx/sites-available/tradewhy /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# 测试并重载 Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx

# ============================================
# 完成
# ============================================
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

if [ -n "$DOMAIN" ]; then
    echo -e "访问地址: ${YELLOW}http://$DOMAIN${NC}"
    echo ""
    echo -e "${YELLOW}下一步：配置 HTTPS${NC}"
    echo "  sudo apt install certbot python3-certbot-nginx -y"
    echo "  sudo certbot --nginx -d $DOMAIN"
else
    PUBLIC_IP=$(curl -s ifconfig.me)
    echo -e "访问地址: ${YELLOW}http://$PUBLIC_IP${NC}"
fi

echo ""
echo -e "${YELLOW}重要信息（请保存）：${NC}"
echo "  数据库密码: $DB_PASSWORD"
echo "  JWT 密钥: $JWT_SECRET"
echo ""
echo -e "${YELLOW}常用命令：${NC}"
echo "  查看后端日志: pm2 logs tradewhy-api"
echo "  重启后端: pm2 restart tradewhy-api"
echo "  查看状态: pm2 status"
echo ""
