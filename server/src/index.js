// 环境变量配置完成 v2
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
import fs from 'fs';
import multer from 'multer';
import fetch from 'node-fetch';
import { prisma } from './db.js';
import { DEFAULT_INSTRUMENTS } from './defaults.js';
import { authRequired, adminRequired } from './middleware/auth.js';
import { setupInstallRoutes } from './install.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeEmail, generateToken, generateVerificationCode, sendRegistrationCodeEmail } from './email.js';

// 内存存储注册验证码（生产环境建议使用 Redis）
const registrationCodes = new Map(); // email -> { code, expiresAt, attempts }
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

// 安装向导路由（必须在静态文件之前）
setupInstallRoutes(app);

// 配置图片上传 (multer)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只能上传图片文件'));
    }
  }
});

// 静态文件服务（上传的图片）
app.use('/uploads', express.static(uploadsDir));

// 图片上传接口
app.post('/upload/image', authRequired, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    // 返回图片 URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    
    res.json({ url: imageUrl, filename: req.file.filename });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({ error: '图片上传失败' });
  }
});

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
  source: trade.source || 'atas',
  account: trade.account || null,
  mae: trade.jigsawData?.mae ?? trade.mae ?? null,
  mfe: trade.jigsawData?.mfe ?? trade.mfe ?? null,
  fills: trade.jigsawData?.fills ?? trade.fills ?? null,
  holdingSeconds: trade.holdingSeconds ?? null,
});

const mapTrade = (row) => {
  let data;
  try {
    data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
  } catch (e) {
    data = {};
  }
  return {
    ...data,
    id: row.id,
    recordId: row.recordId,
    instrumentCode: row.instrumentCode,
    openTime: row.openTime,
    pnl: row.pnl,
    source: row.source || 'atas',
    account: row.account,
    // 优先使用数据库列的值，如果为 null 则回退到 data JSON 中的值
    mae: row.mae ?? data?.mae ?? data?.jigsawData?.mae ?? null,
    mfe: row.mfe ?? data?.mfe ?? data?.jigsawData?.mfe ?? null,
    fills: row.fills ?? data?.fills ?? data?.jigsawData?.fills ?? null,
    holdingSeconds: row.holdingSeconds,
  };
};

const refreshRecordStats = async (userId, recordId) => {
  // 获取交易数据（包含品种代码和data字段）
  const trades = await prisma.trade.findMany({
    where: { userId, recordId },
    select: { pnl: true, instrumentCode: true, data: true },
  });
  
  // 获取用户的品种配置（用于计算手续费）
  const instruments = await prisma.instrument.findMany({
    where: { userId },
    select: { code: true, feeRate: true },
  });
  const feeRateMap = {};
  instruments.forEach(i => { feeRateMap[i.code] = i.feeRate || 0; });
  
  // 计算净盈亏（扣除手续费）
  const calcNetPnL = (trade) => {
    const pnl = trade.pnl || 0;
    const feeRate = feeRateMap[trade.instrumentCode] || 0;
    // 从 data JSON 中解析 openQuantity
    let quantity = 1;
    try {
      const data = typeof trade.data === 'string' ? JSON.parse(trade.data) : trade.data;
      quantity = Math.abs(data?.openQuantity || data?.quantity || 1);
    } catch (e) {
      // 解析失败，使用默认值 1
    }
    const fee = feeRate * quantity * 2; // 双边手续费
    return pnl - fee;
  };
  
  const tradeCount = trades.length;
  const totalPnL = trades.reduce((sum, t) => sum + calcNetPnL(t), 0);
  const winCount = trades.filter(t => calcNetPnL(t) > 0).length;
  const winRate = tradeCount > 0 ? Number((winCount / tradeCount * 100).toFixed(1)) : 0;
  
  await prisma.record.update({
    where: { id: recordId },
    data: { tradeCount, totalPnL: Number(totalPnL.toFixed(2)), winRate },
  });
};

// ========== Auth ==========

// 发送注册验证码
app.post('/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: '请输入邮箱' });
    }
    
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: '邮箱格式不正确' });
    }

    // 检查邮箱是否已注册
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ message: '该邮箱已注册，请直接登录' });
    }

    // 检查是否频繁发送（60秒内只能发送一次）
    const existingCode = registrationCodes.get(normalizedEmail);
    if (existingCode && existingCode.sentAt && Date.now() - existingCode.sentAt < 60000) {
      const remainingSeconds = Math.ceil((60000 - (Date.now() - existingCode.sentAt)) / 1000);
      return res.status(429).json({ message: `请 ${remainingSeconds} 秒后再试` });
    }

    // 生成验证码
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10分钟有效
    
    // 存储验证码
    registrationCodes.set(normalizedEmail, {
      code,
      expiresAt,
      sentAt: Date.now(),
      attempts: 0,
    });

    // 发送邮件
    const result = await sendRegistrationCodeEmail(normalizedEmail, code);
    
    if (result.testMode) {
      // 测试模式下返回验证码（仅开发环境）
      console.log(`[测试模式] 验证码: ${code}`);
    }

    return res.json({ 
      message: '验证码已发送，请查收邮件',
      testMode: result.testMode || false,
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    return res.status(500).json({ message: '发送验证码失败，请稍后重试' });
  }
});

// 验证验证码
app.post('/auth/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ message: '邮箱和验证码必填' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const storedData = registrationCodes.get(normalizedEmail);

    if (!storedData) {
      return res.status(400).json({ message: '请先获取验证码' });
    }

    // 检查尝试次数（最多5次）
    if (storedData.attempts >= 5) {
      registrationCodes.delete(normalizedEmail);
      return res.status(400).json({ message: '验证码错误次数过多，请重新获取' });
    }

    // 检查是否过期
    if (Date.now() > storedData.expiresAt) {
      registrationCodes.delete(normalizedEmail);
      return res.status(400).json({ message: '验证码已过期，请重新获取' });
    }

    // 验证码校验
    if (storedData.code !== code) {
      storedData.attempts++;
      return res.status(400).json({ message: '验证码错误' });
    }

    // 验证成功，标记为已验证
    storedData.verified = true;
    
    return res.json({ message: '验证成功', verified: true });
  } catch (error) {
    console.error('验证失败:', error);
    return res.status(500).json({ message: '验证失败' });
  }
});

// 注册（需要先验证邮箱）
app.post('/auth/register', async (req, res) => {
  const { email, password, code } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: '邮箱和密码必填' });
  }
  if (!code) {
    return res.status(400).json({ message: '请输入验证码' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: '密码至少 6 位' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }

  // 验证验证码
  const storedData = registrationCodes.get(normalizedEmail);
  if (!storedData) {
    return res.status(400).json({ message: '请先获取验证码' });
  }
  if (Date.now() > storedData.expiresAt) {
    registrationCodes.delete(normalizedEmail);
    return res.status(400).json({ message: '验证码已过期，请重新获取' });
  }
  if (storedData.code !== code) {
    storedData.attempts = (storedData.attempts || 0) + 1;
    if (storedData.attempts >= 5) {
      registrationCodes.delete(normalizedEmail);
      return res.status(400).json({ message: '验证码错误次数过多，请重新获取' });
    }
    return res.status(400).json({ message: '验证码错误' });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ message: '邮箱已存在' });
  }

  const totalUsers = await prisma.user.count();
  const role = totalUsers === 0 ? 'admin' : 'user';
  const passwordHash = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.create({
    data: { 
      email: normalizedEmail, 
      passwordHash, 
      role, 
      status: 'active',
      emailVerified: true, // 邮箱已通过验证码验证
    },
  });

  // 清除验证码
  registrationCodes.delete(normalizedEmail);

  await prisma.instrument.createMany({
    data: DEFAULT_INSTRUMENTS.map(inst => ({ ...inst, userId: user.id })),
  });

  const token = signToken(user);
  return res.json({ 
    token, 
    user: { id: user.id, email: user.email, role: user.role, status: user.status, emailVerified: user.emailVerified },
    message: '注册成功！'
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
  try {
    const instruments = Array.isArray(req.body?.instruments) ? req.body.instruments : [];
    
    // 清理和验证品种数据
    const cleanedInstruments = instruments.map(inst => ({
      code: String(inst.code || '').trim().toUpperCase(),
      name: String(inst.name || '').trim(),
      tickValue: Number(inst.tickValue) || 0,
      feeRate: Number(inst.feeRate) || 0,
      initialCapital: Number(inst.initialCapital) || 0,
      atasPattern: inst.atasPattern ? String(inst.atasPattern).trim() : null,
      userId: req.user.id,
    })).filter(inst => inst.code); // 过滤掉没有代码的品种
    
    await prisma.instrument.deleteMany({ where: { userId: req.user.id } });
    if (cleanedInstruments.length > 0) {
      await prisma.instrument.createMany({
        data: cleanedInstruments,
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('保存品种失败:', error);
    return res.status(500).json({ message: '保存品种失败', error: error.message });
  }
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
  try {
    const { recordId } = req.query;
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, ...(recordId ? { recordId: String(recordId) } : {}) },
      orderBy: { openTime: 'desc' },
    });
    return res.json(trades.map(mapTrade));
  } catch (error) {
    console.error('获取交易列表失败:', error);
    return res.status(500).json({ message: '获取交易列表失败', error: error.message });
  }
});

app.post('/trades/bulk', authRequired, async (req, res) => {
  try {
    const trades = Array.isArray(req.body?.trades) ? req.body.trades : [];
    if (trades.length === 0) return res.json({ inserted: 0 });
    const data = trades.map(t => normalizeTrade(t, req.user.id));
    let inserted = 0;
    // 逐条插入，跳过重复记录，确保稳定性
    for (const trade of data) {
      try {
        await prisma.trade.create({ data: trade });
        inserted++;
      } catch (e) {
        // 忽略重复记录错误，继续下一条
      }
    }
    return res.json({ inserted });
  } catch (error) {
    console.error('批量插入失败:', error);
    return res.status(500).json({ message: '导入失败', error: error.message });
  }
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
    
    // 过滤掉 undefined 值，避免覆盖已有数据
    const updates = req.body || {};
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    
    const merged = { ...existingData, ...filteredUpdates };
    
    // 同步更新数据库列，确保 mae/mfe 等字段不会丢失
    const updated = await prisma.trade.update({
      where: { id: req.params.id },
      data: {
        data: JSON.stringify(merged), // SQLite 需要字符串
        recordId: merged.recordId || null,
        instrumentCode: merged.instrumentCode || null,
        openTime: merged.openTime ? new Date(merged.openTime) : null,
        pnl: merged.pnl ?? null,
        // 同步更新 MAE/MFE 等关键字段到数据库列
        mae: merged.mae ?? merged.jigsawData?.mae ?? existing.mae,
        mfe: merged.mfe ?? merged.jigsawData?.mfe ?? existing.mfe,
        fills: merged.fills ?? merged.jigsawData?.fills ?? existing.fills,
        holdingSeconds: merged.holdingSeconds ?? existing.holdingSeconds,
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

// 批量更新交易时区
app.post('/trades/update-timezone', authRequired, async (req, res) => {
  const { oldTimezone, newTimezone, timezoneType } = req.body || {};
  
  if (!oldTimezone || !newTimezone || !timezoneType) {
    return res.status(400).json({ message: '缺少必要参数' });
  }
  
  try {
    // 获取所有交易
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id },
    });
    
    // 计算时区偏移（小时）
    const timezoneOffsets = {
      'America/New_York': -5,
      'America/Chicago': -6,
      'Europe/London': 0,
      'Europe/Berlin': 1,
      'Asia/Tokyo': 9,
      'Asia/Shanghai': 8,
      'Asia/Hong_Kong': 8,
      'Asia/Singapore': 8,
      'Australia/Sydney': 11,
      'UTC': 0,
    };
    
    const oldOffset = timezoneOffsets[oldTimezone] ?? 0;
    const newOffset = timezoneOffsets[newTimezone] ?? 0;
    const diffHours = newOffset - oldOffset;
    const diffMs = diffHours * 60 * 60 * 1000;
    
    // 计算市场时段的辅助函数
    const getMarketSession = (date) => {
      if (!date) return '未知';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '未知';
      
      const hour = d.getHours();
      const minute = d.getMinutes();
      const timeValue = hour * 60 + minute;
      
      // 检测美国夏令时（简化版：4-10月为夏令时）
      const month = d.getMonth() + 1;
      const isUSDST = month >= 4 && month <= 10;
      
      const ASIA_START = 480;      // 08:00
      const ASIA_END = 960;        // 16:00
      const EURO_START = isUSDST ? 900 : 960;
      const US_OPEN = isUSDST ? 1290 : 1350;
      const US_OPEN_END = US_OPEN + 60;
      const OFF_MARKET_START = isUSDST ? 240 : 300;
      
      if (timeValue >= ASIA_START && timeValue < ASIA_END) return '亚盘';
      if (timeValue >= EURO_START && timeValue < US_OPEN) return '欧盘';
      if (timeValue >= US_OPEN && timeValue < US_OPEN_END) return '美盘开盘';
      if (timeValue >= US_OPEN_END && timeValue < 1440) return '美盘';
      if (timeValue >= 0 && timeValue < OFF_MARKET_START) return '美盘';
      if (timeValue >= OFF_MARKET_START && timeValue < ASIA_START) return '场外';
      return '场外';
    };
    
    // 批量更新
    let updated = 0;
    for (const trade of trades) {
      const data = typeof trade.data === 'string' ? JSON.parse(trade.data) : trade.data;
      
      // 更新时间字段
      const newOpenTime = trade.openTime ? new Date(new Date(trade.openTime).getTime() + diffMs) : null;
      const newCloseTime = data?.closeTime ? new Date(new Date(data.closeTime).getTime() + diffMs) : null;
      
      // 重新计算市场时段
      const newMarketSession = getMarketSession(newOpenTime);
      
      // 更新 data 中的时区信息和时段
      const updatedData = {
        ...data,
        openTime: newOpenTime,
        closeTime: newCloseTime,
        marketSession: newMarketSession,
        [timezoneType === 'display' ? 'displayTimezone' : 'sourceTimezone']: newTimezone,
      };
      
      await prisma.trade.update({
        where: { id: trade.id },
        data: {
          openTime: newOpenTime,
          data: JSON.stringify(updatedData),
        },
      });
      updated++;
    }
    
    return res.json({ success: true, updated });
  } catch (error) {
    console.error('Update timezone error:', error);
    return res.status(500).json({ message: '更新失败', error: error.message });
  }
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
      fileType: record.fileType || 'atas',
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
    // 日期范围在数据库层面过滤（利用 [userId, openTime] 复合索引）
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = new Date(dateRange[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange[1]);
      end.setHours(23, 59, 59, 999);
      where.openTime = { gte: start, lte: end };
    }
    
    const trades = await prisma.trade.findMany({
      where,
      orderBy: { openTime: 'asc' },
    });
    
    // 解析 trade data，包含 Jigsaw 扩展字段
    const filteredTrades = trades.map(t => {
      const data = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
      return { 
        ...data, 
        id: t.id, 
        pnl: t.pnl, 
        instrumentCode: t.instrumentCode, 
        openTime: t.openTime,
        mae: t.mae ?? data?.mae ?? data?.jigsawData?.mae,
        mfe: t.mfe ?? data?.mfe ?? data?.jigsawData?.mfe,
        fills: t.fills ?? data?.fills ?? data?.jigsawData?.fills,
        timeIn: t.timeIn ?? data?.timeIn ?? data?.jigsawData?.timeIn,
        maxQty: t.maxQty ?? data?.maxQty ?? data?.jigsawData?.maxQty,
        account: t.account ?? data?.account ?? data?.jigsawData?.account,
        source: t.source ?? data?.source,
      };
    });
    
    // 如果没有交易数据，返回错误
    if (filteredTrades.length === 0) {
      return res.json({ 
        success: false, 
        message: '所选日期范围内没有交易数据',
        analysis: null 
      });
    }
    
    const result = await analyzeTradesWithAI(filteredTrades);
    
    // 保存分析结果到数据库
    if (result.success && result.analysis) {
      try {
        const instruments = [...new Set(filteredTrades.map(t => t.instrumentCode).filter(Boolean))].join(',');
        const dateRangeStr = dateRange ? `${dateRange[0]} - ${dateRange[1]}` : null;
        const now = new Date();
        
        // 获取账本名称
        let recordName = '全部账本';
        if (recordId && recordId !== 'all') {
          const record = await prisma.record.findUnique({ where: { id: recordId } });
          if (record) recordName = record.name;
        }
        
        const title = `AI分析 ${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        
        // 获取交易时间范围和交易日
        const sortedTrades = [...filteredTrades].sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
        const dataStartTime = sortedTrades.length > 0 ? new Date(sortedTrades[0].openTime) : null;
        const dataEndTime = sortedTrades.length > 0 ? new Date(sortedTrades[sortedTrades.length - 1].openTime) : null;
        
        // 计算交易日数量（去重的日期）
        const tradingDaysSet = new Set();
        filteredTrades.forEach(t => {
          if (t.openTime) {
            const date = new Date(t.openTime).toISOString().split('T')[0];
            tradingDaysSet.add(date);
          }
        });
        const tradingDays = tradingDaysSet.size;
        
        // 生成摘要
        const summary = `${result.tradeData?.summary?.totalTrades || 0}笔交易 | 盈亏$${result.tradeData?.summary?.totalPnL || 0} | 胜率${result.tradeData?.summary?.winRate || 0}%`;
        
        // 计算综合评分（简单逻辑：基于盈亏、胜率、盈亏比）
        let overallScore = 50;
        const pnl = parseFloat(result.tradeData?.summary?.totalPnL) || 0;
        const winRateVal = parseFloat(result.tradeData?.summary?.winRate) || 0;
        const plRatio = parseFloat(result.tradeData?.summary?.profitLossRatio) || 0;
        if (pnl > 0) overallScore += 20;
        if (winRateVal >= 50) overallScore += 15;
        else if (winRateVal >= 40) overallScore += 5;
        if (plRatio >= 1.5) overallScore += 15;
        else if (plRatio >= 1) overallScore += 5;
        overallScore = Math.min(100, Math.max(0, overallScore));
        const overallLevel = overallScore >= 80 ? '优秀' : overallScore >= 60 ? '良好' : overallScore >= 40 ? '一般' : '需改进';
        
        await prisma.aIAnalysis.create({
          data: {
            userId: req.user.id,
            recordId: recordId && recordId !== 'all' ? recordId : null,
            recordName,
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
            dataStartTime,
            dataEndTime,
            tradingDays,
            overallScore,
            overallLevel,
            avgProfit: parseFloat(result.tradeData?.summary?.avgProfit) || 0,
            avgLoss: parseFloat(result.tradeData?.summary?.avgLoss) || 0,
            profitLossRatio: plRatio,
            sessionStats: JSON.stringify(result.tradeData?.bySession || {}),
            instrumentStats: JSON.stringify(result.tradeData?.byInstrument || {}),
            directionStats: JSON.stringify(result.tradeData?.direction || {}),
          },
        });
        
        // 更新用户的 AI 分析使用计数
        await prisma.user.update({
          where: { id: req.user.id },
          data: { aiAnalysisCount: { increment: 1 } },
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
        recordId: true,
        recordName: true,
        title: true,
        summary: true,
        totalTrades: true,
        totalPnL: true,
        winRate: true,
        profitFactor: true,
        maxDrawdown: true,
        instruments: true,
        dataStartTime: true,
        dataEndTime: true,
        tradingDays: true,
        overallScore: true,
        overallLevel: true,
        avgProfit: true,
        avgLoss: true,
        profitLossRatio: true,
        sessionStats: true,
        instrumentStats: true,
        directionStats: true,
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

// 更新 AI 分析记录标题
app.patch('/ai/history/:id', authRequired, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: '标题不能为空' });
    }
    
    const analysis = await prisma.aIAnalysis.findUnique({
      where: { id: req.params.id },
    });
    if (!analysis || analysis.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: '分析记录不存在' });
    }
    
    const updated = await prisma.aIAnalysis.update({
      where: { id: req.params.id },
      data: { title: title.trim() },
    });
    
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新分析记录失败:', error);
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
    const parsedTrade = { 
      ...data, 
      id: trade.id, 
      pnl: trade.pnl, 
      instrumentCode: trade.instrumentCode, 
      openTime: trade.openTime,
      // Jigsaw 扩展字段
      mae: trade.mae ?? data?.mae ?? data?.jigsawData?.mae,
      mfe: trade.mfe ?? data?.mfe ?? data?.jigsawData?.mfe,
      fills: trade.fills ?? data?.fills ?? data?.jigsawData?.fills,
      timeIn: trade.timeIn ?? data?.timeIn ?? data?.jigsawData?.timeIn,
      maxQty: trade.maxQty ?? data?.maxQty ?? data?.jigsawData?.maxQty,
      account: trade.account ?? data?.account ?? data?.jigsawData?.account,
      source: trade.source ?? data?.source,
    };
    
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
      return { 
        ...data, 
        id: t.id, 
        pnl: t.pnl, 
        instrumentCode: t.instrumentCode, 
        openTime: t.openTime,
        // Jigsaw 扩展字段
        mae: t.mae ?? data?.mae ?? data?.jigsawData?.mae,
        mfe: t.mfe ?? data?.mfe ?? data?.jigsawData?.mfe,
        fills: t.fills ?? data?.fills ?? data?.jigsawData?.fills,
        source: t.source ?? data?.source,
      };
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
      return { 
        ...data, 
        id: t.id, 
        pnl: t.pnl, 
        instrumentCode: t.instrumentCode, 
        openTime: t.openTime,
        // Jigsaw 扩展字段
        mae: t.mae ?? data?.mae ?? data?.jigsawData?.mae,
        mfe: t.mfe ?? data?.mfe ?? data?.jigsawData?.mfe,
        fills: t.fills ?? data?.fills ?? data?.jigsawData?.fills,
        source: t.source ?? data?.source,
      };
    });
    
    const result = await generateDailySummary(parsedTrades, date);
    return res.json(result);
  } catch (error) {
    console.error('AI 每日总结失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// AI 复盘知识整理
app.post('/ai/review-summary', authRequired, async (req, res) => {
  try {
    const { reviewData, tradeStats } = req.body || {};
    if (!reviewData) {
      return res.status(400).json({ success: false, message: '复盘数据不能为空' });
    }
    
    const dateStr = reviewData.date || '今日';
    const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, '').trim();
    
    const prompt = `你是一位管理百亿资金的对冲基金交易总监，同时是交易心理学专家。
现在请你根据一位交易员的当日复盘记录和交易数据，撰写一份【交易知识文档】。

这份文档的目的是：成为交易员可以反复翻阅的「个人交易手册」的一页。不是简单的复盘总结，而是从这一天的经历中提炼出可以长期复用的交易智慧。

---
## 📊 当日交易数据
${tradeStats ? `| 指标 | 数值 |
|---|---|
| 交易笔数 | ${tradeStats.totalTrades || 0} |
| 净盈亏 | $${tradeStats.totalPnL?.toFixed(2) || '0'} |
| 胜率 | ${tradeStats.winRate?.toFixed(0) || '0'}% |
| 盈利笔数 | ${tradeStats.winCount || 0} |
| 亏损笔数 | ${tradeStats.lossCount || 0} |` : '（无交易数据）'}

## 📝 交易员复盘原始记录
${reviewData.followedPlan ? `- **计划执行度**：${reviewData.followedPlan === 'yes' ? '完全执行' : reviewData.followedPlan === 'partial' ? '部分执行' : '偏离计划'}` : ''}
${stripHtml(reviewData.marketCondition) ? `- **市场环境描述**：${stripHtml(reviewData.marketCondition)}` : ''}
${stripHtml(reviewData.lessonsLearned) ? `- **自述经验教训**：${stripHtml(reviewData.lessonsLearned)}` : ''}
${stripHtml(reviewData.bestDecision) ? `- **自评最佳决策**：${stripHtml(reviewData.bestDecision)}` : ''}
${stripHtml(reviewData.worstDecision) ? `- **自评最差决策**：${stripHtml(reviewData.worstDecision)}` : ''}
${stripHtml(reviewData.improvementPlan) ? `- **自拟改进计划**：${stripHtml(reviewData.improvementPlan)}` : ''}

---

请输出以下格式的 HTML 文档（直接输出 HTML 标签，不要用 markdown 语法）：

<h2>🧠 今日核心认知</h2>
<blockquote>用一段话（2-3句）深度总结今天最重要的交易认知。不是复述事实，而是提炼出底层原则。这段话要足够精炼，值得被贴在屏幕旁边。</blockquote>

<h2>📈 市场结构分析</h2>
<p>基于交易员的市场环境描述，补充专业视角：今天市场处于什么结构？（趋势/震荡/转折）这种结构下最优策略是什么？交易员的操作是否匹配这个结构？</p>

<h2>🔍 交易行为诊断</h2>
<p>像心理医生一样分析交易员今天的行为模式：</p>
<ul>
<li><strong>做对了什么</strong>：具体哪个决策体现了专业素养，为什么这个行为值得强化</li>
<li><strong>问题根因</strong>：最差决策背后的深层原因是什么（情绪？认知偏差？执行力？）</li>
<li><strong>行为模式</strong>：是否存在反复出现的模式？与之前复盘中描述的问题是否一致？</li>
</ul>

<h2>📐 可复用的交易规则</h2>
<p>从今天的经历中，提炼出可以写入「个人交易规则手册」的具体条款：</p>
<ol>
<li><strong>规则名称</strong>：一句话描述规则。<br/>触发条件 → 执行动作 → 预期效果。</li>
</ol>
<p>（提炼 1-3 条，每条必须是 If-Then 格式，足够具体到可以机械执行）</p>

<h2>🎯 下一个交易日行动计划</h2>
<table>
<tr><th>优先级</th><th>行动项</th><th>验证标准</th></tr>
<tr><td>P0</td><td>最重要的一件事</td><td>如何判断做到了</td></tr>
<tr><td>P1</td><td>第二重要的事</td><td>如何判断做到了</td></tr>
</table>

<h2>💬 教练寄语</h2>
<p>以交易教练的身份，给一段 2-3 句的鼓励或警醒。语气直接但有温度，像一位严格但关心你的导师。</p>

---

写作要求：
1. 这是一份正式的【知识文档】，不是聊天回复。语言专业、结构清晰、有深度
2. 每个论点必须基于交易员提供的真实数据和记录，不要凭空编造场景
3. 「可复用的交易规则」是最核心的部分，必须足够具体，能直接写入交易手册
4. 如果某些复盘字段为空，跳过对应分析，不要编造内容
5. 整体篇幅 800-1200 字，信息密度要高`;

    const messages = [
      { role: 'system', content: '你是专业的交易教练，擅长从交易员的复盘中提炼关键知识要点。输出格式为 HTML。注意：你的回复的第一行必须是纯文本标题（不带任何HTML标签），用一句简短的话概括今天最核心的交易场景（如"MNQ突破4500失败后的均值回归"、"开盘假突破识别与反手操作"），然后空一行再输出HTML内容。' },
      { role: 'user', content: prompt }
    ];

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'AI 服务未配置' });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 错误: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    
    // 分离第一行标题和后续 HTML 正文
    const lines = raw.split('\n');
    let aiTitle = '';
    let content = raw;
    
    // 第一行如果不是 HTML 标签开头，就作为标题
    const firstLine = lines[0]?.trim() || '';
    if (firstLine && !firstLine.startsWith('<')) {
      aiTitle = firstLine.replace(/^#+\s*/, '').replace(/[*_#`]/g, '').trim();
      content = lines.slice(1).join('\n').trim();
    }
    
    return res.json({ success: true, summary: content, title: aiTitle });
  } catch (error) {
    console.error('AI 复盘整理失败:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ========== Knowledge Base ==========
// 获取知识库列表
app.get('/knowledge', authRequired, async (req, res) => {
  try {
    const { category, search } = req.query;
    let where = { userId: req.user.id };
    if (category && category !== 'all') where.category = category;
    
    const entries = await prisma.knowledgeEntry.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, summary: true, category: true, tags: true, sourceDate: true, sourceType: true, isPinned: true, createdAt: true, updatedAt: true },
    });

    let result = entries;
    if (search) {
      const kw = search.toLowerCase();
      result = entries.filter(e => 
        e.title.toLowerCase().includes(kw) || 
        (e.summary || '').toLowerCase().includes(kw) ||
        (e.tags || '').toLowerCase().includes(kw)
      );
    }

    // 获取分类统计
    const allEntries = await prisma.knowledgeEntry.findMany({
      where: { userId: req.user.id },
      select: { category: true },
    });
    const categories = {};
    allEntries.forEach(e => { categories[e.category] = (categories[e.category] || 0) + 1; });

    return res.json({ entries: result, categories, total: allEntries.length });
  } catch (error) {
    console.error('获取知识库失败:', error);
    return res.status(500).json({ message: '获取知识库失败' });
  }
});

// 获取单条知识详情
app.get('/knowledge/:id', authRequired, async (req, res) => {
  try {
    const entry = await prisma.knowledgeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.userId !== req.user.id) {
      return res.status(404).json({ message: '未找到' });
    }
    return res.json(entry);
  } catch (error) {
    return res.status(500).json({ message: '获取失败' });
  }
});

// 保存知识条目（从复盘自动归档 或 手动创建）
app.post('/knowledge', authRequired, async (req, res) => {
  try {
    const { title, content, sourceDate, sourceType } = req.body;
    if (!content) return res.status(400).json({ message: '内容不能为空' });

    // AI 自动分类 + 摘要 + 标签
    let category = '未分类', summary = '', tags = '';
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (apiKey) {
      try {
        const plainText = content.replace(/<[^>]*>/g, '').substring(0, 2000);
        const classifyResponse = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是交易知识分类专家。根据内容返回 JSON 格式：{"category":"分类名","summary":"一句话摘要(30字内)","tags":"标签1,标签2,标签3"}。分类必须是以下交易技术类别之一：突破成功,突破失败,假突破,回调做多,回调做空,趋势跟踪,均值回归,区间震荡,缺口交易,动量交易,反转信号,供需区域,关键位测试,开盘策略,尾盘策略,止损管理,仓位管理,情绪控制,过度交易,其他。tags 应该包含具体的品种名、时段、关键价位等细节标签。' },
              { role: 'user', content: plainText }
            ],
            temperature: 0.3,
            max_tokens: 200,
          }),
        });
        if (classifyResponse.ok) {
          const data = await classifyResponse.json();
          const text = data.choices?.[0]?.message?.content || '';
          // 提取 JSON
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            category = parsed.category || '未分类';
            summary = parsed.summary || '';
            tags = parsed.tags || '';
          }
        }
      } catch (aiErr) {
        console.error('AI 分类失败，使用默认分类:', aiErr.message);
      }
    }

    const autoTitle = title || `${sourceDate || new Date().toISOString().split('T')[0]} 交易知识`;
    
    const entry = await prisma.knowledgeEntry.create({
      data: {
        userId: req.user.id,
        title: autoTitle,
        content,
        summary,
        category,
        tags,
        sourceDate: sourceDate || null,
        sourceType: sourceType || 'review',
      },
    });

    return res.json({ success: true, entry });
  } catch (error) {
    console.error('保存知识条目失败:', error);
    return res.status(500).json({ message: '保存失败' });
  }
});

// 更新知识条目
app.patch('/knowledge/:id', authRequired, async (req, res) => {
  try {
    const entry = await prisma.knowledgeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.userId !== req.user.id) {
      return res.status(404).json({ message: '未找到' });
    }
    const updated = await prisma.knowledgeEntry.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: '更新失败' });
  }
});

// 删除知识条目
app.delete('/knowledge/:id', authRequired, async (req, res) => {
  try {
    const entry = await prisma.knowledgeEntry.findUnique({ where: { id: req.params.id } });
    if (!entry || entry.userId !== req.user.id) {
      return res.status(404).json({ message: '未找到' });
    }
    await prisma.knowledgeEntry.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: '删除失败' });
  }
});

// ========== Subscription Plans ==========
// 初始化默认订阅计划（心理学定价策略 v2）
// Pro $49/月（主力产品），Elite $149/月（锚点+高端）
async function initSubscriptionPlans() {
  // 检查是否需要更新到新版本的计划
  const existingPlans = await prisma.subscriptionPlan.findMany();
  
  // 如果存在 team 计划，说明是旧版本，需要更新
  const hasTeamPlan = existingPlans.some(p => p.name === 'team');
  const hasElitePlan = existingPlans.some(p => p.name === 'elite');
  
  if (existingPlans.length > 0 && !hasTeamPlan) {
    // 已经是新版本，不需要更新
    return;
  }
  
  if (hasTeamPlan && !hasElitePlan) {
    // 需要从旧版本迁移到新版本
    console.log('Migrating subscription plans from v1 to v2...');
    
    // 删除 team 计划（如果没有用户使用）
    await prisma.subscriptionPlan.deleteMany({ where: { name: 'team' } });
    
    // 更新 pro 计划的价格
    await prisma.subscriptionPlan.updateMany({
      where: { name: 'pro' },
      data: {
        priceMonthly: 49,
        priceYearly: 468,
        description: '专业交易者的完整工具箱，每天仅需 $1.3',
      }
    });
    
    // 更新 free 计划的限制
    await prisma.subscriptionPlan.updateMany({
      where: { name: 'free' },
      data: {
        maxTradesPerMonth: 50,
        maxHistoryDays: 7,
        maxAiAnalysisPerMonth: 2,
        description: '体验核心功能，感受 AI 分析的价值',
      }
    });
    
    // 创建 elite 计划
    await prisma.subscriptionPlan.create({
      data: {
        name: 'elite',
        displayName: 'Elite 精英版',
        description: '为追求卓越的交易者打造，享受 VIP 服务',
        priceMonthly: 149,
        priceYearly: 1188,
        maxRecords: -1,
        maxTradesPerMonth: -1,
        maxHistoryDays: -1,
        maxAiAnalysisPerMonth: -1,
        maxTeamMembers: 1,
        hasSmartDiagnosis: true,
        hasMonteCarlo: true,
        hasOptimalStopLoss: true,
        hasExpectancy: true,
        hasBehaviorTags: true,
        hasExport: true,
        hasApi: true,
        hasPrioritySupport: true,
        sortOrder: 2,
      }
    });
    
    console.log('Subscription plans migrated to v2 successfully');
    return;
  }
  
  if (existingPlans.length > 0) return;

  const defaultPlans = [
    {
      name: 'free',
      displayName: '免费版',
      description: '体验核心功能，感受 AI 分析的价值',
      priceMonthly: 0,
      priceYearly: 0,
      maxRecords: 1,           // 1 个账本
      maxTradesPerMonth: 50,   // 每月 50 笔（制造痛点）
      maxHistoryDays: 7,       // 仅 7 天历史（强烈痛点）
      maxAiAnalysisPerMonth: 2, // 每月 2 次 AI（体验后想要更多）
      maxTeamMembers: 1,
      hasSmartDiagnosis: false,
      hasMonteCarlo: false,
      hasOptimalStopLoss: false,
      hasExpectancy: false,
      hasBehaviorTags: false,
      hasExport: false,
      hasApi: false,
      hasPrioritySupport: false,
      sortOrder: 0,
    },
    {
      name: 'pro',
      displayName: 'Pro 专业版',
      description: '专业交易者的完整工具箱，每天仅需 $1.3',
      priceMonthly: 49,        // $49/月
      priceYearly: 468,        // $39/月 × 12 = $468/年（省$120）
      maxRecords: -1,          // 无限账本
      maxTradesPerMonth: -1,   // 无限交易
      maxHistoryDays: -1,      // 永久历史
      maxAiAnalysisPerMonth: -1, // 无限 AI 分析
      maxTeamMembers: 1,
      hasSmartDiagnosis: true,
      hasMonteCarlo: true,
      hasOptimalStopLoss: true,
      hasExpectancy: true,
      hasBehaviorTags: true,
      hasExport: true,
      hasApi: false,
      hasPrioritySupport: false,
      sortOrder: 1,
    },
    {
      name: 'elite',
      displayName: 'Elite 精英版',
      description: '为追求卓越的交易者打造，享受 VIP 服务',
      priceMonthly: 149,       // $149/月（锚点价格）
      priceYearly: 1188,       // $99/月 × 12 = $1188/年（省$600）
      maxRecords: -1,
      maxTradesPerMonth: -1,
      maxHistoryDays: -1,
      maxAiAnalysisPerMonth: -1,
      maxTeamMembers: 1,
      hasSmartDiagnosis: true,
      hasMonteCarlo: true,
      hasOptimalStopLoss: true,
      hasExpectancy: true,
      hasBehaviorTags: true,
      hasExport: true,
      hasApi: true,            // API 访问
      hasPrioritySupport: true, // 优先支持
      sortOrder: 2,
    },
  ];

  for (const plan of defaultPlans) {
    await prisma.subscriptionPlan.create({ data: plan });
  }
  console.log('Default subscription plans created (Psychology Pricing v2)');
}

// 初始化订阅计划（启动时执行）
initSubscriptionPlans().catch(console.error);

// 获取所有订阅计划
app.get('/subscription/plans', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return res.json(plans);
  } catch (error) {
    console.error('获取订阅计划失败:', error);
    return res.status(500).json({ message: '获取订阅计划失败' });
  }
});

// 辅助函数：计算当月实际用量
async function calculateMonthlyUsage(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 计算当月交易数量
  const tradesCount = await prisma.trade.count({
    where: {
      userId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  // 获取用户信息中的 AI 分析次数
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiAnalysisCount: true, aiAnalysisResetAt: true },
  });

  // 检查是否需要重置 AI 分析次数（新月份）
  let aiAnalysisCount = user?.aiAnalysisCount || 0;
  if (user?.aiAnalysisResetAt) {
    const resetDate = new Date(user.aiAnalysisResetAt);
    if (resetDate.getFullYear() !== now.getFullYear() || resetDate.getMonth() !== now.getMonth()) {
      // 新的月份，重置计数
      aiAnalysisCount = 0;
      await prisma.user.update({
        where: { id: userId },
        data: { aiAnalysisCount: 0, aiAnalysisResetAt: now },
      });
    }
  }

  return {
    tradesUsedThisMonth: tradesCount,
    aiAnalysisUsedThisMonth: aiAnalysisCount,
  };
}

// 获取当前用户订阅状态
app.get('/subscription/current', authRequired, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
      include: { plan: true },
    });

    // 实时计算用量
    const usage = await calculateMonthlyUsage(req.user.id);

    if (!subscription) {
      // 未订阅，返回免费计划权限
      const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'free' },
      });
      return res.json({
        hasSubscription: false,
        plan: freePlan,
        status: 'free',
        usage,
      });
    }

    // 检查订阅是否过期
    const now = new Date();
    const isExpired = subscription.currentPeriodEnd < now;
    const isActive = subscription.status === 'active' && !isExpired;

    return res.json({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        status: isActive ? 'active' : (isExpired ? 'expired' : subscription.status),
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
      },
      plan: subscription.plan,
      usage,
    });
  } catch (error) {
    console.error('获取订阅状态失败:', error);
    return res.status(500).json({ message: '获取订阅状态失败' });
  }
});

// 创建订阅（管理员手动或用户支付后调用）
app.post('/subscription/create', authRequired, async (req, res) => {
  try {
    const { planName, billingCycle = 'monthly', userId } = req.body;
    const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.id;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    });

    if (!plan) {
      return res.status(400).json({ message: '订阅计划不存在' });
    }

    // 检查是否已有订阅
    const existing = await prisma.subscription.findUnique({
      where: { userId: targetUserId },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    if (existing) {
      // 更新现有订阅
      const updated = await prisma.subscription.update({
        where: { userId: targetUserId },
        data: {
          planId: plan.id,
          billingCycle,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
          tradesUsedThisMonth: 0,
          aiAnalysisUsedThisMonth: 0,
        },
        include: { plan: true },
      });

      // 记录历史
      await prisma.subscriptionHistory.create({
        data: {
          userId: targetUserId,
          planId: plan.id,
          action: 'upgraded',
          fromPlan: existing.planId,
          toPlan: plan.id,
          amount: billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly,
        },
      });

      return res.json({ success: true, subscription: updated });
    }

    // 创建新订阅
    const subscription = await prisma.subscription.create({
      data: {
        userId: targetUserId,
        planId: plan.id,
        billingCycle,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });

    // 记录历史
    await prisma.subscriptionHistory.create({
      data: {
        userId: targetUserId,
        planId: plan.id,
        action: 'created',
        toPlan: plan.id,
        amount: billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly,
      },
    });

    return res.json({ success: true, subscription });
  } catch (error) {
    console.error('创建订阅失败:', error);
    return res.status(500).json({ message: '创建订阅失败' });
  }
});

// 取消订阅
app.post('/subscription/cancel', authRequired, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (!subscription) {
      return res.status(400).json({ message: '未找到订阅' });
    }

    await prisma.subscription.update({
      where: { userId: req.user.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    // 记录历史
    await prisma.subscriptionHistory.create({
      data: {
        userId: req.user.id,
        planId: subscription.planId,
        action: 'cancelled',
      },
    });

    return res.json({ success: true, message: '订阅已取消，将在当前周期结束后失效' });
  } catch (error) {
    console.error('取消订阅失败:', error);
    return res.status(500).json({ message: '取消订阅失败' });
  }
});

// 更新使用量（内部调用）
app.post('/subscription/usage', authRequired, async (req, res) => {
  try {
    const { type } = req.body; // 'trade' 或 'aiAnalysis'
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (!subscription) {
      return res.json({ success: true }); // 免费用户不记录
    }

    const updateData = {};
    if (type === 'trade') {
      updateData.tradesUsedThisMonth = subscription.tradesUsedThisMonth + 1;
    } else if (type === 'aiAnalysis') {
      updateData.aiAnalysisUsedThisMonth = subscription.aiAnalysisUsedThisMonth + 1;
    }

    await prisma.subscription.update({
      where: { userId: req.user.id },
      data: updateData,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('更新使用量失败:', error);
    return res.status(500).json({ message: '更新使用量失败' });
  }
});

// ========== Admin Subscription Management ==========
// 管理员获取所有订阅
app.get('/admin/subscriptions', authRequired, adminRequired, async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, email: true, role: true } },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(subscriptions);
  } catch (error) {
    console.error('获取订阅列表失败:', error);
    return res.status(500).json({ message: '获取订阅列表失败' });
  }
});

// 管理员修改用户订阅
app.patch('/admin/subscriptions/:userId', authRequired, adminRequired, async (req, res) => {
  try {
    const { planName, status, billingCycle, extendDays } = req.body;
    const { userId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return res.status(404).json({ message: '订阅不存在' });
    }

    const updateData = {};

    if (planName) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { name: planName } });
      if (plan) updateData.planId = plan.id;
    }

    if (status) updateData.status = status;
    if (billingCycle) updateData.billingCycle = billingCycle;

    if (extendDays) {
      const newEnd = new Date(subscription.currentPeriodEnd);
      newEnd.setDate(newEnd.getDate() + parseInt(extendDays));
      updateData.currentPeriodEnd = newEnd;
    }

    const updated = await prisma.subscription.update({
      where: { userId },
      data: updateData,
      include: { plan: true, user: { select: { id: true, email: true } } },
    });

    return res.json(updated);
  } catch (error) {
    console.error('修改订阅失败:', error);
    return res.status(500).json({ message: '修改订阅失败' });
  }
});

// 管理员删除订阅
app.delete('/admin/subscriptions/:userId', authRequired, adminRequired, async (req, res) => {
  try {
    await prisma.subscription.delete({
      where: { userId: req.params.userId },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('删除订阅失败:', error);
    return res.status(500).json({ message: '删除订阅失败' });
  }
});

// 管理员获取订阅历史
app.get('/admin/subscription-history', authRequired, adminRequired, async (req, res) => {
  try {
    const { userId } = req.query;
    const where = userId ? { userId: String(userId) } : {};
    const history = await prisma.subscriptionHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json(history);
  } catch (error) {
    console.error('获取订阅历史失败:', error);
    return res.status(500).json({ message: '获取订阅历史失败' });
  }
});

// 管理员管理订阅计划
app.get('/admin/plans', authRequired, adminRequired, async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return res.json(plans);
  } catch (error) {
    console.error('获取订阅计划失败:', error);
    return res.status(500).json({ message: '获取订阅计划失败' });
  }
});

app.patch('/admin/plans/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const updated = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return res.json(updated);
  } catch (error) {
    console.error('更新订阅计划失败:', error);
    return res.status(500).json({ message: '更新订阅计划失败' });
  }
});

// ========== Redemption Code Management ==========
// 生成随机兑换码
function generateRedemptionCode(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // 每4个字符添加一个横杠，方便阅读
  return code.match(/.{1,4}/g).join('-');
}

// 管理员批量生成兑换码
app.post('/admin/redemption-codes/generate', authRequired, adminRequired, async (req, res) => {
  try {
    const { planName, durationDays, count = 1, maxUses = 1, expiresAt, note } = req.body;

    if (!planName || !durationDays) {
      return res.status(400).json({ message: '请填写订阅计划和时长' });
    }

    // 验证计划是否存在
    const plan = await prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) {
      return res.status(400).json({ message: '订阅计划不存在' });
    }

    const codes = [];
    const generateCount = Math.min(parseInt(count) || 1, 100); // 最多一次生成100个

    for (let i = 0; i < generateCount; i++) {
      let code;
      let attempts = 0;
      // 确保生成唯一的兑换码
      while (attempts < 10) {
        code = generateRedemptionCode();
        const existing = await prisma.redemptionCode.findUnique({ where: { code } });
        if (!existing) break;
        attempts++;
      }

      if (attempts >= 10) {
        return res.status(500).json({ message: '生成兑换码失败，请重试' });
      }

      const created = await prisma.redemptionCode.create({
        data: {
          code,
          planName,
          durationDays: parseInt(durationDays),
          maxUses: parseInt(maxUses) || 1,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          note: note || null,
          createdBy: req.user.id,
        },
      });
      codes.push(created);
    }

    return res.json({ success: true, codes, count: codes.length });
  } catch (error) {
    console.error('生成兑换码失败:', error);
    return res.status(500).json({ message: '生成兑换码失败' });
  }
});

// 管理员获取所有兑换码
app.get('/admin/redemption-codes', authRequired, adminRequired, async (req, res) => {
  try {
    const codes = await prisma.redemptionCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        redemptions: {
          select: {
            id: true,
            userId: true,
            redeemedAt: true,
          },
        },
      },
    });
    return res.json(codes);
  } catch (error) {
    console.error('获取兑换码列表失败:', error);
    return res.status(500).json({ message: '获取兑换码列表失败' });
  }
});

// 管理员删除兑换码
app.delete('/admin/redemption-codes/:id', authRequired, adminRequired, async (req, res) => {
  try {
    // 先删除相关的兑换记录
    await prisma.redemptionRecord.deleteMany({
      where: { codeId: req.params.id },
    });
    // 再删除兑换码
    await prisma.redemptionCode.delete({
      where: { id: req.params.id },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('删除兑换码失败:', error);
    return res.status(500).json({ message: '删除兑换码失败' });
  }
});

// 管理员更新兑换码状态
app.patch('/admin/redemption-codes/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { isActive, note, maxUses, expiresAt } = req.body;
    const updateData = {};
    
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (note !== undefined) updateData.note = note;
    if (maxUses !== undefined) updateData.maxUses = parseInt(maxUses);
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const updated = await prisma.redemptionCode.update({
      where: { id: req.params.id },
      data: updateData,
    });
    return res.json(updated);
  } catch (error) {
    console.error('更新兑换码失败:', error);
    return res.status(500).json({ message: '更新兑换码失败' });
  }
});

// 用户兑换码兑换
app.post('/subscription/redeem', authRequired, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: '请输入兑换码' });
    }

    // 标准化兑换码（去除空格，转大写）
    const normalizedCode = code.replace(/[\s-]/g, '').toUpperCase();
    // 添加横杠格式
    const formattedCode = normalizedCode.match(/.{1,4}/g)?.join('-') || normalizedCode;

    // 查找兑换码
    const redemptionCode = await prisma.redemptionCode.findFirst({
      where: {
        OR: [
          { code: formattedCode },
          { code: normalizedCode },
        ],
      },
    });

    if (!redemptionCode) {
      return res.status(400).json({ message: '兑换码不存在' });
    }

    // 检查兑换码状态
    if (!redemptionCode.isActive) {
      return res.status(400).json({ message: '兑换码已失效' });
    }

    // 检查是否过期
    if (redemptionCode.expiresAt && new Date() > new Date(redemptionCode.expiresAt)) {
      return res.status(400).json({ message: '兑换码已过期' });
    }

    // 检查使用次数
    if (redemptionCode.usedCount >= redemptionCode.maxUses) {
      return res.status(400).json({ message: '兑换码已被使用完' });
    }

    // 检查用户是否已使用过此兑换码
    const existingRedemption = await prisma.redemptionRecord.findFirst({
      where: {
        codeId: redemptionCode.id,
        userId: req.user.id,
      },
    });

    if (existingRedemption) {
      return res.status(400).json({ message: '您已使用过此兑换码' });
    }

    // 验证计划是否存在
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { name: redemptionCode.planName },
    });

    if (!plan) {
      return res.status(400).json({ message: '订阅计划不存在' });
    }

    // 开始兑换 - 使用事务
    const now = new Date();
    
    // 获取用户现有订阅
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    let periodEnd;
    if (existingSubscription && existingSubscription.status === 'active' && existingSubscription.currentPeriodEnd > now) {
      // 如果有活跃订阅，在现有结束时间基础上延长
      periodEnd = new Date(existingSubscription.currentPeriodEnd);
      periodEnd.setDate(periodEnd.getDate() + redemptionCode.durationDays);
    } else {
      // 否则从现在开始计算
      periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + redemptionCode.durationDays);
    }

    if (existingSubscription) {
      // 更新现有订阅
      await prisma.subscription.update({
        where: { userId: req.user.id },
        data: {
          planId: plan.id,
          status: 'active',
          currentPeriodStart: existingSubscription.status === 'active' ? existingSubscription.currentPeriodStart : now,
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
          tradesUsedThisMonth: 0,
          aiAnalysisUsedThisMonth: 0,
        },
      });
    } else {
      // 创建新订阅
      await prisma.subscription.create({
        data: {
          userId: req.user.id,
          planId: plan.id,
          billingCycle: 'monthly',
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    // 更新兑换码使用次数
    await prisma.redemptionCode.update({
      where: { id: redemptionCode.id },
      data: {
        usedCount: redemptionCode.usedCount + 1,
      },
    });

    // 记录兑换
    await prisma.redemptionRecord.create({
      data: {
        codeId: redemptionCode.id,
        userId: req.user.id,
      },
    });

    // 记录订阅历史
    await prisma.subscriptionHistory.create({
      data: {
        userId: req.user.id,
        planId: plan.id,
        action: 'redeemed',
        toPlan: plan.id,
        amount: 0,
        note: `兑换码: ${redemptionCode.code}`,
      },
    });

    return res.json({
      success: true,
      message: `兑换成功！已获得 ${plan.displayName} ${redemptionCode.durationDays} 天订阅`,
      plan: plan.displayName,
      durationDays: redemptionCode.durationDays,
      expiresAt: periodEnd,
    });
  } catch (error) {
    console.error('兑换失败:', error);
    return res.status(500).json({ message: '兑换失败，请稍后重试' });
  }
});

// ========== 错误报告 API ==========
app.post('/api/error-report', async (req, res) => {
  try {
    const errorData = req.body;
    
    // 记录到控制台
    console.error('🚨 前端错误报告:', JSON.stringify(errorData, null, 2));
    
    // 发送邮件通知
    const { sendErrorReportEmail } = await import('./email.js');
    if (sendErrorReportEmail) {
      await sendErrorReportEmail({
        to: '631402323@qq.com',
        subject: `[交易日志] 前端错误报告 - ${errorData.type}`,
        errorData,
      });
    }
    
    res.json({ success: true, message: '错误报告已接收' });
  } catch (error) {
    console.error('处理错误报告失败:', error);
    // 即使发送邮件失败也返回成功，避免前端重试
    res.json({ success: true, message: '错误报告已接收' });
  }
});

// ========== 静态文件 & SPA 支持（必须在所有 API 路由之后）==========
const distPath = path.join(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  // 静态文件服务
  app.use(express.static(distPath));
  
  // SPA 路由支持：所有未匹配的路由返回 index.html
  app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: 'Not found' });
    }
  });
} else {
  // 开发模式下没有 dist 目录
  app.get('*', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found. Frontend should be served separately in development.' });
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
