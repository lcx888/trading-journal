import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import { DEFAULT_INSTRUMENTS } from './defaults.js';
import { authRequired, adminRequired } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 4000;

// 生产环境允许所有来源，开发环境使用本地地址
app.use(cors({ 
  origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const signToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET || 'dev_secret',
  { expiresIn: '7d' }
);

const normalizeTrade = (trade, userId) => ({
  id: trade.id,
  userId,
  recordId: trade.recordId || null,
  instrumentCode: trade.instrumentCode || null,
  openTime: trade.openTime ? new Date(trade.openTime) : null,
  pnl: trade.pnl ?? null,
  data: trade, // PostgreSQL supports JSON natively
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
  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash, role, status: 'active' },
  });

  await prisma.instrument.createMany({
    data: DEFAULT_INSTRUMENTS.map(inst => ({ ...inst, userId: user.id })),
  });

  const token = signToken(user);
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role, status: user.status } });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
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

  const token = signToken(user);
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role, status: user.status } });
});

app.get('/auth/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ message: '用户不存在' });
  return res.json({ id: user.id, email: user.email, role: user.role, status: user.status });
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
  const result = await prisma.trade.createMany({ data, skipDuplicates: true });
  return res.json({ inserted: result.count });
});

app.put('/trades', authRequired, async (req, res) => {
  const trades = Array.isArray(req.body?.trades) ? req.body.trades : [];
  await prisma.trade.deleteMany({ where: { userId: req.user.id } });
  if (trades.length > 0) {
    await prisma.trade.createMany({
      data: trades.map(t => normalizeTrade(t, req.user.id)),
      skipDuplicates: true,
    });
  }
  return res.json({ success: true });
});

app.patch('/trades/:id', authRequired, async (req, res) => {
  const existing = await prisma.trade.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: '交易不存在' });
  const existingData = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data;
  const merged = { ...existingData, ...(req.body || {}) };
  const updated = await prisma.trade.update({
    where: { id: req.params.id },
    data: {
      data: merged,
      recordId: merged.recordId || null,
      instrumentCode: merged.instrumentCode || null,
      openTime: merged.openTime ? new Date(merged.openTime) : null,
      pnl: merged.pnl ?? null,
    },
  });
  return res.json(mapTrade(updated));
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
  const saved = await prisma.review.upsert({
    where: { userId_date: { userId: req.user.id, date: review.date } },
    update: {
      type: review.type,
      data: data,
    },
    create: {
      id,
      userId: req.user.id,
      date: review.date,
      type: review.type,
      data: data,
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
    await prisma.record.createMany({
      data: records.map(r => ({
        id: r.id,
        userId: req.user.id,
        name: r.name,
        description: r.description || '',
        status: r.status || 'active',
        tradeCount: r.tradeCount || 0,
        totalPnL: r.totalPnL || 0,
        winRate: r.winRate || 0,
      })),
      skipDuplicates: true,
    });
  }

  if (trades.length > 0) {
    await prisma.trade.createMany({
      data: trades.map(t => normalizeTrade(t, req.user.id)),
      skipDuplicates: true,
    });
  }

  if (strategies.length > 0) {
    await prisma.strategy.createMany({
      data: strategies.map(s => ({
        id: s.id,
        userId: req.user.id,
        name: s.name,
        description: s.description || '',
        color: s.color || '#2962ff',
        category: s.category || '通用',
        usageCount: s.usageCount || 0,
      })),
      skipDuplicates: true,
    });
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
      await prisma.review.upsert({
        where: { userId_date: { userId: req.user.id, date: r.date } },
        update: { type: r.type, data: data },
        create: { id: r.id || `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, userId: req.user.id, date: r.date, type: r.type, data: data },
      });
    }
  }

  for (const record of records) {
    await refreshRecordStats(req.user.id, record.id);
  }

  return res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
