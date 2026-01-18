import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 手动加载 .env 文件（确保在其他导入之前）
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { execSync } from 'child_process';
import { prisma } from './db.js';
import { DEFAULT_INSTRUMENTS } from './defaults.js';
import { authRequired, adminRequired } from './middleware/auth.js';
import { setupInstallRoutes, isInstalled } from './install.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeEmail, generateToken } from './email.js';
import { analyzeTradesWithAI, analyzeSingleTrade, chatWithAI, generateDailySummary } from './deepseek.js';

// 在启动时运行数据库迁移（仅生产环境或数据库不存在时）
async function runMigrations() {
  // 本地开发时跳过自动迁移（已手动执行过）
  if (process.env.SKIP_MIGRATIONS === 'true') {
    console.log('Skipping database migrations (SKIP_MIGRATIONS=true)');
    return;
  }
  
  console.log('Running database migrations...');
  console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL);
  
  try {
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { 
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db'
      }
    });
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    // 如果迁移失败，尝试继续启动（数据库可能已经是最新的）
  }
}

await runMigrations();

const app = express();
const PORT = process.env.PORT || 4000;

// 生产环境允许所有来源，开发环境使用本地地址
app.use(cors({ 
  origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// 生产环境：提供前端静态文件
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// 安装向导路由
setupInstallRoutes(app);

const signToken = (user, rememberMe = false) => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET || 'dev_secret',
  { expiresIn: rememberMe ? '30d' : '7d' }
);

// 获取请求来源 URL
const getBaseUrl = (req) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
};

const normalizeTrade = (trade, userId) => ({
  id: trade.id,
  userId,
  recordId: trade.recordId || null,
  instrumentCode: trade.instrumentCode || null,
  openTime: trade.openTime ? new Date(trade.openTime) : null,
  pnl: trade.pnl ?? null,
  data: JSON.stringify(trade), // SQLite 需要字符串
});

const mapTrade = (row) => {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return {
    ...data,
    id: row.id,
    recordId: row.recordId,
    instrumentCode: row.instrumentCode,
    openTime: row.openTime,
    pnl: row.pnl,
  };
};

const refreshRecordStats = async (userId, recordId) => {
  const trades = await prisma.trade.findMany({
    where: { userId, recordId },
    select: { pnl: true },
  });
  const tradeCount = trades.length;
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winCount = trades.filter(t => (t.pnl || 0) > 0).length;
  const winRate = tradeCount > 0 ? Number((winCount / tradeCount * 100).toFixed(1)) : 0;
  await prisma.record.update({
    where: { id: recordId },
    data: { tradeCount, totalPnL: Number(totalPnL.toFixed(2)), winRate },
  });
};

// ========== Auth ==========
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: '邮箱和密码必填' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: '密码至少 6 位' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ message: '邮箱已存在' });
  }

  const totalUsers = await prisma.user.count();
  const role = totalUsers === 0 ? 'admin' : 'user';
  const passwordHash = await bcrypt.hash(password, 10);
  
  // 生成验证令牌
  const verifyToken = generateToken();
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时
  
  const user = await prisma.user.create({
    data: { 
      email: normalizedEmail, 
      passwordHash, 
      role, 
      status: 'active',
      emailVerified: false,
      verifyToken,
      verifyExpires,
    },
  });

  await prisma.instrument.createMany({
    data: DEFAULT_INSTRUMENTS.map(inst => ({ ...inst, userId: user.id })),
  });

  // 发送验证邮件
  const baseUrl = getBaseUrl(req);
  await sendVerificationEmail(normalizedEmail, verifyToken, baseUrl);

  const token = signToken(user);
  return res.json({ 
    token, 
    user: { id: user.id, email: user.email, role: user.role, status: user.status, emailVerified: user.emailVerified },
    message: '注册成功！验证邮件已发送，请查收。'
  });
});

app.post('/auth/login', async (req, res) => {
  const { email, password, rememberMe } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: '邮箱和密码必填' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return res.status(401).json({ message: '邮箱或密码错误' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ message: '账号已禁用' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: '邮箱或密码错误' });
  }

  // 更新最后登录时间
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: String(clientIp).split(',')[0] },
  });

  const token = signToken(user, !!rememberMe);
  return res.json({ 
    token, 
    user: { id: user.id, email: user.email, role: user.role, status: user.status, emailVerified: user.emailVerified } 
  });
});

app.get('/auth/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ message: '用户不存在' });
  return res.json({ 
    id: user.id, 
    email: user.email, 
    role: user.role, 
    status: user.status,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
  });
});

// 验证邮箱
app.post('/auth/verify-email', async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: '验证令牌缺失' });
  }

  const user = await prisma.user.findFirst({
    where: { verifyToken: token, verifyExpires: { gt: new Date() } },
  });
  
  if (!user) {
    return res.status(400).json({ message: '验证链接无效或已过期' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyToken: null, verifyExpires: null },
  });

  return res.json({ message: '邮箱验证成功！' });
});

// 重新发送验证邮件
app.post('/auth/resend-verification', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }
  if (user.emailVerified) {
    return res.status(400).json({ message: '邮箱已验证' });
  }

  const verifyToken = generateToken();
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await prisma.user.update({
    where: { id: user.id },
    data: { verifyToken, verifyExpires },
  });

  const baseUrl = getBaseUrl(req);
  await sendVerificationEmail(user.email, verifyToken, baseUrl);

  return res.json({ message: '验证邮件已重新发送' });
});

// 忘记密码 - 发送重置邮件
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: '请输入邮箱' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  
  // 不管用户是否存在都返回成功（防止邮箱枚举）
  if (user) {
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1小时
    
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetExpires },
    });

    const baseUrl = getBaseUrl(req);
    await sendPasswordResetEmail(user.email, resetToken, baseUrl);
  }

  return res.json({ message: '如果该邮箱已注册，重置链接已发送' });
});

// 重置密码
app.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ message: '参数缺失' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: '密码至少 6 位' });
  }

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetExpires: { gt: new Date() } },
  });
  
  if (!user) {
    return res.status(400).json({ message: '重置链接无效或已过期' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetExpires: null },
  });

  return res.json({ message: '密码重置成功！请使用新密码登录。' });
});

// 修改密码（需要登录）
app.post('/auth/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: '请输入当前密码和新密码' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ message: '新密码至少 6 位' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: '当前密码错误' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return res.json({ message: '密码修改成功！' });
});

// 修改邮箱（需要登录）
app.post('/auth/change-email', authRequired, async (req, res) => {
  const { newEmail, password } = req.body || {};
  if (!newEmail || !password) {
    return res.status(400).json({ message: '请输入新邮箱和当前密码' });
  }

  const normalizedEmail = String(newEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: '密码错误' });
  }

  // 检查新邮箱是否已被使用
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ message: '该邮箱已被使用' });
  }

  // 生成验证令牌（存储新邮箱信息）
  const verifyToken = generateToken();
  const verifyExpires = new Date(Date.now() + 60 * 60 * 1000); // 1小时
  
  await prisma.user.update({
    where: { id: user.id },
    data: { 
      verifyToken: `change:${normalizedEmail}:${verifyToken}`,
      verifyExpires,
    },
  });

  const baseUrl = getBaseUrl(req);
  await sendEmailChangeEmail(normalizedEmail, verifyToken, baseUrl);

  return res.json({ message: '验证邮件已发送到新邮箱，请查收确认。' });
});

// 确认更改邮箱
app.post('/auth/confirm-email-change', async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: '验证令牌缺失' });
  }

  const users = await prisma.user.findMany({
    where: { verifyExpires: { gt: new Date() } },
  });
  
  const user = users.find(u => u.verifyToken && u.verifyToken.includes(token));
  if (!user || !user.verifyToken) {
    return res.status(400).json({ message: '验证链接无效或已过期' });
  }

  const parts = user.verifyToken.split(':');
  if (parts[0] !== 'change' || parts[2] !== token) {
    return res.status(400).json({ message: '验证链接无效' });
  }

  const newEmail = parts[1];
  await prisma.user.update({
    where: { id: user.id },
    data: { 
      email: newEmail,
      emailVerified: true,
      verifyToken: null, 
      verifyExpires: null,
    },
  });

  return res.json({ message: '邮箱更改成功！' });
});

// 注销账户
app.post('/auth/delete-account', authRequired, async (req, res) => {
  const { password, confirmText } = req.body || {};
  if (!password) {
    return res.status(400).json({ message: '请输入密码确认' });
  }
  if (confirmText !== '确认注销') {
    return res.status(400).json({ message: '请输入"确认注销"以确认操作' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: '密码错误' });
  }

  // 删除用户相关数据
  await prisma.review.deleteMany({ where: { userId: user.id } });
  await prisma.importRecord.deleteMany({ where: { userId: user.id } });
  await prisma.trade.deleteMany({ where: { userId: user.id } });
  await prisma.strategy.deleteMany({ where: { userId: user.id } });
  await prisma.record.deleteMany({ where: { userId: user.id } });
  await prisma.instrument.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  return res.json({ message: '账户已注销' });
});

// ========== Admin ==========
app.get('/admin/users', authRequired, adminRequired, async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
  });
  return res.json(users);
});

app.patch('/admin/users/:id', authRequired, adminRequired, async (req, res) => {
  const { role, status } = req.body || {};
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    },
  });
  return res.json({ id: updated.id, email: updated.email, role: updated.role, status: updated.status });
});

// ========== Instruments ==========
app.get('/instruments', authRequired, async (req, res) => {
  const existing = await prisma.instrument.findMany({
    where: { userId: req.user.id },
    orderBy: { code: 'asc' },
  });
  if (existing.length === 0) {
    await prisma.instrument.createMany({
      data: DEFAULT_INSTRUMENTS.map(inst => ({ ...inst, userId: req.user.id })),
    });
    const seeded = await prisma.instrument.findMany({
      where: { userId: req.user.id },
      orderBy: { code: 'asc' },
    });
    return res.json(seeded);
  }
  return res.json(existing);
});

app.put('/instruments', authRequired, async (req, res) => {
  const instruments = Array.isArray(req.body?.instruments) ? req.body.instruments : [];
  await prisma.instrument.deleteMany({ where: { userId: req.user.id } });
  if (instruments.length > 0) {
    await prisma.instrument.createMany({
      data: instruments.map(inst => ({ ...inst, userId: req.user.id })),
    });
  }
  return res.json({ success: true });
});

// ========== Records ==========
app.get('/records', authRequired, async (req, res) => {
  const records = await prisma.record.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(records);
});

app.post('/records', authRequired, async (req, res) => {
  const record = req.body || {};
  const created = await prisma.record.create({
    data: {
      id: record.id || `record_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId: req.user.id,
      name: record.name,
      description: record.description || '',
      status: record.status || 'active',
      tradeCount: record.tradeCount || 0,
      totalPnL: record.totalPnL || 0,
      winRate: record.winRate || 0,
    },
  });
  return res.json(created);
});

app.patch('/records/:id', authRequired, async (req, res) => {
  const updated = await prisma.record.update({
    where: { id: req.params.id },
    data: req.body || {},
  });
  return res.json(updated);
});

app.delete('/records/:id', authRequired, async (req, res) => {
  await prisma.trade.deleteMany({ where: { userId: req.user.id, recordId: req.params.id } });
  await prisma.record.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

app.post('/records/:id/refresh-stats', authRequired, async (req, res) => {
  await refreshRecordStats(req.user.id, req.params.id);
  const record = await prisma.record.findUnique({ where: { id: req.params.id } });
  return res.json(record);
});

// ========== Trades ==========
app.get('/trades', authRequired, async (req, res) => {
  const { recordId } = req.query;
  const trades = await prisma.trade.findMany({
    where: { userId: req.user.id, ...(recordId ? { recordId: String(recordId) } : {}) },
    orderBy: { openTime: 'desc' },
  });
  return res.json(trades.map(mapTrade));
});

app.post('/trades/bulk', authRequired, async (req, res) => {
  const trades = Array.isArray(req.body?.trades) ? req.body.trades : [];
  if (trades.length === 0) return res.json({ inserted: 0 });
  const data = trades.map(t => normalizeTrade(t, req.user.id));
  // SQLite 不支持 skipDuplicates，逐条插入并忽略错误
  let inserted = 0;
  for (const trade of data) {
    try {
      await prisma.trade.create({ data: trade });
      inserted++;
    } catch (e) {
      // 忽略重复错误
    }
  }
  const result = { count: inserted };
  return res.json({ inserted: result.count });
});

app.put('/trades', authRequired, async (req, res) => {
  const trades = Array.isArray(req.body?.trades) ? req.body.trades : [];
  await prisma.trade.deleteMany({ where: { userId: req.user.id } });
  if (trades.length > 0) {
    for (const t of trades) {
      try {
        await prisma.trade.create({ data: normalizeTrade(t, req.user.id) });
      } catch (e) { /* 忽略 */ }
    }
  }
  return res.json({ success: true });
});

app.patch('/trades/:id', authRequired, async (req, res) => {
  try {
    const existing = await prisma.trade.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: '交易不存在' });
    const existingData = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data;
    const merged = { ...existingData, ...(req.body || {}) };
    const updated = await prisma.trade.update({
      where: { id: req.params.id },
      data: {
        data: JSON.stringify(merged), // SQLite 需要字符串
        recordId: merged.recordId || null,
        instrumentCode: merged.instrumentCode || null,
        openTime: merged.openTime ? new Date(merged.openTime) : null,
        pnl: merged.pnl ?? null,
      },
    });
    return res.json(mapTrade(updated));
  } catch (error) {
    console.error('更新交易失败:', error);
    return res.status(500).json({ message: '更新失败', error: error.message });
  }
});

app.delete('/trades/:id', authRequired, async (req, res) => {
  await prisma.trade.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

app.delete('/trades', authRequired, async (req, res) => {
  await prisma.trade.deleteMany({ where: { userId: req.user.id } });
  return res.json({ success: true });
});

// ========== Strategies ==========
app.get('/strategies', authRequired, async (req, res) => {
  const strategies = await prisma.strategy.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(strategies);
});

app.post('/strategies', authRequired, async (req, res) => {
  const strategy = req.body || {};
  const created = await prisma.strategy.create({
    data: {
      id: strategy.id || `strategy_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId: req.user.id,
      name: strategy.name,
      description: strategy.description || '',
      color: strategy.color || '#2962ff',
      category: strategy.category || '通用',
      usageCount: strategy.usageCount || 0,
    },
  });
  return res.json(created);
});

app.patch('/strategies/:id', authRequired, async (req, res) => {
  const updated = await prisma.strategy.update({
    where: { id: req.params.id },
    data: req.body || {},
  });
  return res.json(updated);
});

app.delete('/strategies/:id', authRequired, async (req, res) => {
  await prisma.strategy.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

app.post('/strategies/refresh-usage', authRequired, async (req, res) => {
  const trades = await prisma.trade.findMany({
    where: { userId: req.user.id },
    select: { data: true },
  });
  const counts = {};
  trades.forEach(t => {
    const data = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
    const ids = data?.strategyIds || [];
    if (Array.isArray(ids)) {
      ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    }
  });
  const strategies = await prisma.strategy.findMany({ where: { userId: req.user.id } });
  const updated = await Promise.all(strategies.map(s => prisma.strategy.update({
    where: { id: s.id },
    data: { usageCount: counts[s.id] || 0 },
  })));
  return res.json(updated);
});

// ========== Imports ==========
app.get('/imports', authRequired, async (req, res) => {
  const history = await prisma.importRecord.findMany({
    where: { userId: req.user.id },
    orderBy: { importDate: 'desc' },
  });
  return res.json(history);
});

app.post('/imports', authRequired, async (req, res) => {
  const record = req.body || {};
  const created = await prisma.importRecord.create({
    data: {
      userId: req.user.id,
      filename: record.filename,
      importDate: record.importDate ? new Date(record.importDate) : new Date(),
      tradesCount: record.tradesCount || 0,
      totalPnL: record.totalPnL || 0,
      recordId: record.recordId || null,
      recordName: record.recordName || null,
    },
  });
  return res.json(created);
});

// ========== Reviews ==========
app.get('/reviews', authRequired, async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(reviews.map(r => {
    const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    return { ...data, id: r.id, date: r.date, type: r.type };
  }));
});

app.post('/reviews', authRequired, async (req, res) => {
  const review = req.body || {};
  const data = { ...review };
  delete data.id;
  delete data.date;
  delete data.type;
  const id = review.id || `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const dataStr = JSON.stringify(data); // SQLite 需要字符串
  const saved = await prisma.review.upsert({
    where: { userId_date: { userId: req.user.id, date: review.date } },
    update: {
      type: review.type,
      data: dataStr,
    },
    create: {
      id,
      userId: req.user.id,
      date: review.date,
      type: review.type,
      data: dataStr,
    },
  });
  const savedData = typeof saved.data === 'string' ? JSON.parse(saved.data) : saved.data;
  return res.json({ ...savedData, id: saved.id, date: saved.date, type: saved.type });
});

app.delete('/reviews/:date', authRequired, async (req, res) => {
  await prisma.review.delete({
    where: { userId_date: { userId: req.user.id, date: req.params.date } },
  });
  return res.json({ success: true });
});

// ========== Migration ==========
app.post('/migrate', authRequired, async (req, res) => {
  const payload = req.body || {};
  const instruments = Array.isArray(payload.instruments) ? payload.instruments : [];
  const records = Array.isArray(payload.records) ? payload.records : [];
  const trades = Array.isArray(payload.trades) ? payload.trades : [];
  const strategies = Array.isArray(payload.strategies) ? payload.strategies : [];
  const imports = Array.isArray(payload.imports) ? payload.imports : [];
  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];

  if (instruments.length > 0) {
    await prisma.instrument.deleteMany({ where: { userId: req.user.id } });
    await prisma.instrument.createMany({
      data: instruments.map(inst => ({ ...inst, userId: req.user.id })),
    });
  }

  if (records.length > 0) {
    for (const r of records) {
      try {
        await prisma.record.create({
          data: {
            id: r.id,
            userId: req.user.id,
            name: r.name,
            description: r.description || '',
            status: r.status || 'active',
            tradeCount: r.tradeCount || 0,
            totalPnL: r.totalPnL || 0,
            winRate: r.winRate || 0,
          }
        });
      } catch (e) { /* 忽略重复 */ }
    }
  }

  if (trades.length > 0) {
    for (const t of trades) {
      try {
        await prisma.trade.create({ data: normalizeTrade(t, req.user.id) });
      } catch (e) { /* 忽略重复 */ }
    }
  }

  if (strategies.length > 0) {
    for (const s of strategies) {
      try {
        await prisma.strategy.create({
          data: {
            id: s.id,
            userId: req.user.id,
            name: s.name,
            description: s.description || '',
            color: s.color || '#2962ff',
            category: s.category || '通用',
            usageCount: s.usageCount || 0,
          }
        });
      } catch (e) { /* 忽略重复 */ }
    }
  }

  if (imports.length > 0) {
    await prisma.importRecord.createMany({
      data: imports.map(i => ({
        userId: req.user.id,
        filename: i.filename,
        importDate: i.importDate ? new Date(i.importDate) : new Date(),
        tradesCount: i.tradesCount || 0,
        totalPnL: i.totalPnL || 0,
        recordId: i.recordId || null,
        recordName: i.recordName || null,
      })),
    });
  }

  if (reviews.length > 0) {
    for (const r of reviews) {
      const data = { ...r };
      delete data.id;
      delete data.date;
      delete data.type;
      const dataStr = JSON.stringify(data);
      await prisma.review.upsert({
        where: { userId_date: { userId: req.user.id, date: r.date } },
        update: { type: r.type, data: dataStr },
        create: { id: r.id || `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, userId: req.user.id, date: r.date, type: r.type, data: dataStr },
      });
    }
  }

  for (const record of records) {
    await refreshRecordStats(req.user.id, record.id);
  }

  return res.json({ success: true });
});

// ==================== AI 分析 API ====================

// AI 智能分析 - 分析所有交易
app.post('/ai/analyze', authRequired, async (req, res) => {
  try {
    const { recordId, dateRange } = req.body || {};
    
    let where = { userId: req.user.id };
    if (recordId && recordId !== 'all') {
      where.recordId = recordId;
    }
    
    const trades = await prisma.trade.findMany({
      where,
      orderBy: { openTime: 'asc' },
    });
    
    // 解析 trade data
    const parsedTrades = trades.map(t => {
      const data = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
      return { ...data, id: t.id, pnl: t.pnl, instrumentCode: t.instrumentCode, openTime: t.openTime };
    });
    
    // 日期范围筛选
    let filteredTrades = parsedTrades;
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = new Date(dateRange[0]);
      const end = new Date(dateRange[1]);
      filteredTrades = parsedTrades.filter(t => {
        const tradeDate = new Date(t.openTime);
        return tradeDate >= start && tradeDate <= end;
      });
    }
    
    const result = await analyzeTradesWithAI(filteredTrades);
    
    // 保存分析结果到数据库
    if (result.success && result.analysis) {
      try {
        const instruments = [...new Set(filteredTrades.map(t => t.instrumentCode).filter(Boolean))].join(',');
        const dateRangeStr = dateRange ? `${dateRange[0]} - ${dateRange[1]}` : null;
        const now = new Date();
        const title = `AI分析 ${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        
        // 生成摘要
        const summary = `${result.tradeData?.summary?.totalTrades || 0}笔交易 | 盈亏$${result.tradeData?.summary?.totalPnL || 0} | 胜率${result.tradeData?.summary?.winRate || 0}%`;
        
        await prisma.aIAnalysis.create({
          data: {
            userId: req.user.id,
            title,
            summary,
            report: result.analysis,
            totalTrades: result.tradeData?.summary?.totalTrades || 0,
            totalPnL: parseFloat(result.tradeData?.summary?.totalPnL) || 0,
            winRate: parseFloat(result.tradeData?.summary?.winRate) || 0,
            profitFactor: parseFloat(result.tradeData?.summary?.profitFactor) || 0,
            maxDrawdown: parseFloat(result.tradeData?.summary?.maxDrawdown) || 0,
            dateRange: dateRangeStr,
            instruments,
          },
        });
      } catch (saveError) {
        console.error('保存分析记录失败:', saveError);
        // 保存失败不影响返回结果
      }
    }
    
    return res.json(result);
  } catch (error) {
    console.error('AI 分析失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 获取 AI 分析历史列表
app.get('/ai/history', authRequired, async (req, res) => {
  try {
    const analyses = await prisma.aIAnalysis.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        summary: true,
        totalTrades: true,
        totalPnL: true,
        winRate: true,
        profitFactor: true,
        instruments: true,
        createdAt: true,
      },
    });
    return res.json(analyses);
  } catch (error) {
    console.error('获取分析历史失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 获取单个 AI 分析详情
app.get('/ai/history/:id', authRequired, async (req, res) => {
  try {
    const analysis = await prisma.aIAnalysis.findUnique({
      where: { id: req.params.id },
    });
    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: '分析记录不存在' });
    }
    return res.json(analysis);
  } catch (error) {
    console.error('获取分析详情失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 删除 AI 分析记录
app.delete('/ai/history/:id', authRequired, async (req, res) => {
  try {
    const analysis = await prisma.aIAnalysis.findUnique({
      where: { id: req.params.id },
    });
    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: '分析记录不存在' });
    }
    await prisma.aIAnalysis.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('删除分析记录失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// AI 分析单笔交易
app.post('/ai/analyze-trade/:id', authRequired, async (req, res) => {
  try {
    const trade = await prisma.trade.findUnique({ where: { id: req.params.id } });
    if (!trade || trade.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: '交易不存在' });
    }
    
    const data = typeof trade.data === 'string' ? JSON.parse(trade.data) : trade.data;
    const parsedTrade = { ...data, id: trade.id, pnl: trade.pnl, instrumentCode: trade.instrumentCode, openTime: trade.openTime };
    
    const result = await analyzeSingleTrade(parsedTrade);
    return res.json(result);
  } catch (error) {
    console.error('AI 分析失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// AI 问答
app.post('/ai/chat', authRequired, async (req, res) => {
  try {
    const { message, chatHistory } = req.body || {};
    if (!message) {
      return res.status(400).json({ success: false, message: '消息不能为空' });
    }
    
    // 获取用户交易数据用于上下文
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id },
      orderBy: { openTime: 'asc' },
    });
    
    const parsedTrades = trades.map(t => {
      const data = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
      return { ...data, id: t.id, pnl: t.pnl, instrumentCode: t.instrumentCode, openTime: t.openTime };
    });
    
    const result = await chatWithAI(message, parsedTrades, chatHistory || []);
    return res.json(result);
  } catch (error) {
    console.error('AI 问答失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// AI 每日总结
app.post('/ai/daily-summary', authRequired, async (req, res) => {
  try {
    const { date } = req.body || {};
    if (!date) {
      return res.status(400).json({ success: false, message: '日期不能为空' });
    }
    
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id },
      orderBy: { openTime: 'asc' },
    });
    
    const parsedTrades = trades.map(t => {
      const data = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
      return { ...data, id: t.id, pnl: t.pnl, instrumentCode: t.instrumentCode, openTime: t.openTime };
    });
    
    const result = await generateDailySummary(parsedTrades, date);
    return res.json(result);
  } catch (error) {
    console.error('AI 每日总结失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// SPA 路由支持：所有未匹配的路由返回 index.html
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../dist/index.html');
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
