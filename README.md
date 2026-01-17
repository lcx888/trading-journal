# 📊 交易日志管理系统 (Trading Journal)

一款专为期货交易者设计的专业交易日志管理工具，帮助您记录、分析和优化交易策略。

![Trading Journal](https://img.shields.io/badge/Version-1.0.0-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Node](https://img.shields.io/badge/Node.js-20+-brightgreen)

---

## ✨ 功能特点

### 📈 交易数据管理
- **多账本管理**：支持创建多个交易账本，分类管理不同账户或策略的交易记录
- **ATAS 数据导入**：一键导入 ATAS 交易软件导出的 Excel 文件
- **智能去重**：自动识别并过滤重复交易记录
- **品种自动识别**：自动解析交易品种代码并配置相关参数

### 📊 数据分析与统计
- **仪表盘概览**：直观展示总盈亏、胜率、最大回撤等核心指标
- **多维度筛选**：按时间、品种、方向、盈亏等多条件筛选交易记录
- **可视化图表**：盈亏曲线、品种分布、时段分析等专业图表
- **交易日历**：按日期查看每日交易表现

### 🤖 AI 智能复盘
- **AI 交易分析**：基于交易数据生成智能分析报告
- **策略建议**：AI 根据历史表现提供优化建议
- **模式识别**：识别交易中的行为模式和潜在问题

### 🔧 策略管理
- **交易策略库**：创建和管理常用交易策略
- **策略标签**：为每笔交易标记使用的策略
- **策略统计**：分析各策略的胜率和盈亏表现

### 👥 用户系统
- **用户注册/登录**：邮箱密码注册，JWT 安全认证
- **数据隔离**：每个用户的数据完全独立
- **管理员后台**：用户管理、权限控制

---

## 🛠️ 技术栈

### 前端
- **React 18** - 现代化前端框架
- **Vite 7** - 极速构建工具
- **Ant Design 5** - 企业级 UI 组件库
- **Tailwind CSS** - 原子化 CSS 框架
- **ECharts** - 专业可视化图表库
- **Lucide React** - 精美图标库

### 后端
- **Node.js 20** - JavaScript 运行时
- **Express 4** - 轻量级 Web 框架
- **Prisma 5** - 现代化 ORM 框架
- **SQLite / PostgreSQL** - 数据库支持
- **JWT** - 安全身份认证
- **bcryptjs** - 密码加密

---

## 📦 快速开始

### 环境要求
- Node.js 20.x 或更高版本
- npm 或 yarn 包管理器

### 本地开发

```bash
# 克隆项目
git clone https://github.com/lcx888/trading-journal.git
cd trading-journal

# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 初始化数据库
npx prisma generate
npx prisma db push

# 启动后端服务
npm run dev

# 新开终端，启动前端
cd ..
npm run dev
```

### 生产部署

```bash
# 构建前端
npm run build

# 启动后端（使用 PM2）
cd server
pm2 start src/index.js --name trading-api
```

---

## 🌐 部署方式

### 方式一：宝塔面板部署（推荐）

1. 安装宝塔面板
2. 安装 Nginx、Node.js、PM2
3. 上传代码到 `/www/wwwroot/trading-journal`
4. 配置环境变量
5. 构建前端 `npm run build`
6. 使用 PM2 启动后端
7. 配置 Nginx 反向代理

### 方式二：Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 访问
http://your-server-ip
```

### 方式三：Railway 部署

1. 连接 GitHub 仓库
2. 添加 PostgreSQL 数据库
3. 配置环境变量
4. 自动部署

---

## ⚙️ 环境变量

```env
# 数据库连接
DATABASE_URL="file:./dev.db"  # SQLite
# DATABASE_URL="postgresql://user:pass@localhost:5432/db"  # PostgreSQL

# JWT 密钥
JWT_SECRET="your-secret-key"

# CORS 配置
CORS_ORIGIN="*"

# 服务端口
PORT=4000
```

---

## 📁 项目结构

```
trading-journal/
├── src/                    # 前端源码
│   ├── components/         # 通用组件
│   ├── pages/              # 页面组件
│   │   ├── Dashboard.jsx   # 仪表盘
│   │   ├── TradingRecords.jsx  # 交易记录
│   │   ├── TradeList.jsx   # 交易明细
│   │   ├── TradingStrategies.jsx  # 策略管理
│   │   ├── AIAnalysis.jsx  # AI 复盘
│   │   ├── TradeCalendar.jsx  # 交易日历
│   │   ├── ImportData.jsx  # 数据导入
│   │   ├── Settings.jsx    # 设置
│   │   ├── Auth.jsx        # 登录注册
│   │   ├── Admin.jsx       # 管理后台
│   │   └── Home.jsx        # 首页
│   ├── services/           # 服务层
│   │   ├── api.js          # API 请求
│   │   ├── auth.js         # 认证服务
│   │   ├── storage.js      # 数据存储
│   │   └── atasParser.js   # ATAS 文件解析
│   └── utils/              # 工具函数
├── server/                 # 后端源码
│   ├── src/
│   │   ├── index.js        # 主入口
│   │   ├── db.js           # 数据库连接
│   │   ├── defaults.js     # 默认配置
│   │   ├── install.js      # 安装向导
│   │   └── middleware/     # 中间件
│   └── prisma/
│       └── schema.prisma   # 数据库模型
├── dist/                   # 前端构建输出
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

---

## 🔐 权限系统

| 角色 | 权限 |
|------|------|
| user | 普通用户，管理自己的交易数据 |
| admin | 管理员，可查看用户列表 |
| superadmin | 超级管理员，完整管理权限 |

---

## 📱 功能截图

### 仪表盘
- 总览交易数据
- 盈亏曲线图表
- 品种分布统计

### 交易记录
- 账本管理
- 交易列表
- 数据筛选导出

### AI 复盘
- 智能分析报告
- 交易模式识别
- 优化建议

---

## 🚀 未来规划

- [ ] 支持更多交易软件数据导入
- [ ] 移动端适配
- [ ] 多语言支持
- [ ] 实时行情对接
- [ ] 社区功能
- [ ] 交易信号分享

---

## 📄 开源协议

本项目基于 MIT 协议开源。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: [提交问题](https://github.com/lcx888/trading-journal/issues)

---

**让每一笔交易都有迹可循，让复盘成为习惯！** 📈
