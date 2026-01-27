#!/bin/bash

# ============================================
# TradeWhy.AI 一键更新脚本
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="/var/www/tradewhy"

echo -e "${GREEN}"
echo "============================================"
echo "  TradeWhy.AI 更新脚本"
echo "============================================"
echo -e "${NC}"

# 进入项目目录
cd $APP_DIR

# 1. 拉取最新代码
echo -e "\n${GREEN}[1/5] 拉取最新代码...${NC}"
git pull origin main

# 2. 更新前端
echo -e "\n${GREEN}[2/5] 更新前端依赖...${NC}"
npm install

# 3. 构建前端
echo -e "\n${GREEN}[3/5] 构建前端...${NC}"
npm run build

# 4. 更新后端
echo -e "\n${GREEN}[4/5] 更新后端...${NC}"
cd server
npm install
npx prisma generate

# 5. 重启服务
echo -e "\n${GREEN}[5/5] 重启后端服务...${NC}"
pm2 restart tradewhy-api

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  更新完成！${NC}"
echo -e "${GREEN}============================================${NC}"

# 显示状态
pm2 status
