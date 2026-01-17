# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package.json
COPY package*.json ./
COPY server/package*.json ./server/

# 安装依赖
RUN npm install
RUN cd server && npm install

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 生成 Prisma Client
RUN cd server && npx prisma generate

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server/node_modules ./server/node_modules

WORKDIR /app/server

# 暴露端口
EXPOSE 4000

# 启动命令
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
