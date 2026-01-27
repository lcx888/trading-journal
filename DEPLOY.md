# 🚀 TradeWhy.AI 部署指南

## 架构概览

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   前端 (React)  │────▶│  后端 (Node.js) │────▶│  PostgreSQL     │
│   Vercel/静态   │     │  Railway/Render │     │  云数据库       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 方案一：Railway 一键部署（推荐）

### 步骤 1：部署后端 + 数据库

1. 访问 [Railway.app](https://railway.app) 并用 GitHub 登录
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择你的仓库，设置根目录为 `trading-journal/server`
4. Railway 会自动检测 Node.js 项目
5. 添加 PostgreSQL 数据库：点击 "New" → "Database" → "PostgreSQL"
6. 设置环境变量：
   ```
   DATABASE_URL=（Railway 自动提供）
   JWT_SECRET=你的随机密钥（至少32位）
   CORS_ORIGIN=https://你的前端域名.vercel.app
   PORT=4000
   ```
7. 部署后运行数据库迁移：
   ```bash
   npx prisma db push
   ```

### 步骤 2：部署前端到 Vercel

1. 访问 [Vercel.com](https://vercel.com) 并用 GitHub 登录
2. 点击 "New Project" → 导入你的仓库
3. 设置：
   - **Root Directory**: `trading-journal`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. 添加环境变量：
   ```
   VITE_API_URL=https://你的后端域名.railway.app
   ```
5. 部署！

### 步骤 3：更新前端 API 地址

修改 `src/services/api.js`：

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_URL,
});
```

---

## 方案二：自建服务器 (VPS)

### 准备工作

- Ubuntu 20.04+ 服务器
- 域名（可选，但推荐）
- SSH 访问权限

### 步骤 1：安装依赖

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 安装 Nginx
sudo apt install -y nginx

# 安装 PM2（进程管理器）
sudo npm install -g pm2
```

### 步骤 2：配置 PostgreSQL

```bash
# 创建数据库和用户
sudo -u postgres psql
```

```sql
CREATE DATABASE trading_journal;
CREATE USER tradewhy WITH ENCRYPTED PASSWORD '你的密码';
GRANT ALL PRIVILEGES ON DATABASE trading_journal TO tradewhy;
\q
```

### 步骤 3：部署后端

```bash
# 克隆项目
git clone https://github.com/你的用户名/你的仓库.git
cd 你的仓库/trading-journal/server

# 安装依赖
npm install

# 创建 .env 文件
cat > .env << EOF
DATABASE_URL="postgresql://tradewhy:你的密码@localhost:5432/trading_journal"
JWT_SECRET="$(openssl rand -base64 32)"
PORT=4000
CORS_ORIGIN="https://你的域名.com"
EOF

# 生成 Prisma 客户端并同步数据库
npx prisma generate
npx prisma db push

# 使用 PM2 启动
pm2 start src/index.js --name tradewhy-api
pm2 save
pm2 startup
```

### 步骤 4：部署前端

```bash
cd ../  # 回到 trading-journal 目录

# 安装依赖并构建
npm install
npm run build

# 复制到 Nginx 目录
sudo cp -r dist/* /var/www/html/
```

### 步骤 5：配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/tradewhy
```

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    # API 路由代理（必须在静态文件规则之前）
    # 匹配所有 API 端点
    location ~ ^/(auth|admin|instruments|records|trades|strategies|imports|reviews|migrate|ai|install)(/|$) {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 前端静态文件
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }
}
```

> **重要**：API 路由规则必须放在静态文件规则之前，否则所有请求都会被前端路由捕获！

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/tradewhy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 步骤 6：配置 HTTPS（推荐）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d 你的域名.com
```

---

## 环境变量说明

### 后端 (.env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT 签名密钥（至少32位） | 随机字符串 |
| `PORT` | 服务器端口 | `4000` |
| `CORS_ORIGIN` | 允许的前端域名 | `https://tradewhy.ai` |

### 前端 (.env)

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_API_URL` | 后端 API 地址 | `https://api.tradewhy.ai` |

---

## 常见问题

### Q: 数据库连接失败？
确保 PostgreSQL 正在运行，且 `DATABASE_URL` 格式正确。

### Q: CORS 错误？
检查后端 `CORS_ORIGIN` 是否与前端域名匹配。

### Q: 502 Bad Gateway？
检查后端是否正在运行：`pm2 status`

---

## 维护命令

```bash
# 查看后端日志
pm2 logs tradewhy-api

# 重启后端
pm2 restart tradewhy-api

# 更新代码后重新部署
git pull
npm install
npm run build
pm2 restart tradewhy-api
```

---

## 安全建议

1. ✅ 使用强密码
2. ✅ 启用 HTTPS
3. ✅ 定期更新依赖
4. ✅ 配置防火墙（只开放 80/443 端口）
5. ✅ 定期备份数据库
