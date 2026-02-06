import { apiRequest } from './api';
import { getMarketSession } from '../utils/timezone';

// ========== 智能缓存层 ==========
// 对高频 GET 请求进行内存缓存，避免重复网络请求
const _cache = new Map();
const CACHE_TTL = 30_000; // 30秒过期

const cachedRequest = async (key, fetcher) => {
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }
  const data = await fetcher();
  _cache.set(key, { data, ts: Date.now() });
  return data;
};

// 使指定缓存失效
const invalidateCache = (...keys) => {
  if (keys.length === 0) {
    _cache.clear(); // 清除全部
  } else {
    keys.forEach(k => _cache.delete(k));
  }
};

// 本地存储 key
const USER_SETTINGS_KEY = 'tradewhy_user_settings';

// 默认用户设置
const DEFAULT_USER_SETTINGS = {
  timezone: 'Asia/Shanghai', // 用户所在时区（用于显示）
  dataSourceTimezone: 'Europe/London', // 数据源时区（UTC+0，与 ATAS 导出的 UTC 时间一致）
  traderName: '', // 交易员名称
};

export const StorageService = {
  // ========== 用户设置（本地存储）==========
  getUserSettings() {
    try {
      const stored = localStorage.getItem(USER_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load user settings:', e);
    }
    return { ...DEFAULT_USER_SETTINGS };
  },

  saveUserSettings(settings) {
    try {
      const current = this.getUserSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to save user settings:', e);
      return this.getUserSettings();
    }
  },

  getUserTimezone() {
    return this.getUserSettings().timezone;
  },

  setUserTimezone(timezone) {
    return this.saveUserSettings({ timezone });
  },

  getDataSourceTimezone() {
    return this.getUserSettings().dataSourceTimezone;
  },

  setDataSourceTimezone(dataSourceTimezone) {
    return this.saveUserSettings({ dataSourceTimezone });
  },

  getTraderName() {
    return this.getUserSettings().traderName || '';
  },

  setTraderName(traderName) {
    return this.saveUserSettings({ traderName });
  },

  // ========== 交易记录 ==========
  async getAllTrades() {
    return await cachedRequest('trades', () => apiRequest('/trades'));
  },

  async saveTrades(trades) {
    await apiRequest('/trades', { method: 'PUT', body: { trades } });
    invalidateCache('trades');
  },

  async addTrades(newTrades) {
    await apiRequest('/trades/bulk', { method: 'POST', body: { trades: newTrades } });
    invalidateCache('trades');
    return await this.getAllTrades();
  },

  async getTradesByInstrument(instrumentCode) {
    const all = await this.getAllTrades();
    return all.filter(t => t.instrumentCode === instrumentCode);
  },

  async updateTrade(tradeId, updates) {
    await apiRequest(`/trades/${tradeId}`, { method: 'PATCH', body: updates });
    invalidateCache('trades');
    return await this.getAllTrades();
  },

  async deleteTrade(tradeId) {
    await apiRequest(`/trades/${tradeId}`, { method: 'DELETE' });
    invalidateCache('trades');
    return await this.getAllTrades();
  },

  async clearAllTrades() {
    await apiRequest('/trades', { method: 'DELETE' });
    invalidateCache('trades');
  },

  // ========== 品种配置 ==========
  async getInstruments() {
    return await cachedRequest('instruments', () => apiRequest('/instruments'));
  },

  async saveInstruments(instruments) {
    await apiRequest('/instruments', { method: 'PUT', body: { instruments } });
    invalidateCache('instruments');
  },

  async getInstrumentByCode(code) {
    const instruments = await this.getInstruments();
    return instruments.find(i => i.code === code);
  },

  async addInstrument(instrument) {
    const instruments = await this.getInstruments();
    // 检查是否已存在
    if (instruments.find(i => i.code === instrument.code)) {
      throw new Error('品种代码已存在');
    }
    instruments.push(instrument);
    await this.saveInstruments(instruments);
  },

  async updateInstrument(code, updates) {
    const instruments = await this.getInstruments();
    const index = instruments.findIndex(i => i.code === code);
    if (index === -1) {
      throw new Error('品种不存在');
    }
    instruments[index] = { ...instruments[index], ...updates };
    await this.saveInstruments(instruments);
  },

  async deleteInstrument(code) {
    const instruments = await this.getInstruments();
    const filtered = instruments.filter(i => i.code !== code);
    await this.saveInstruments(filtered);
  },

  // ========== 时区批量更新 ==========
  async updateTradesTimezone(oldTimezone, newTimezone, timezoneType) {
    const result = await apiRequest('/trades/update-timezone', {
      method: 'POST',
      body: { oldTimezone, newTimezone, timezoneType },
    });
    invalidateCache('trades');
    return result;
  },

  // ========== 导入记录 ==========
  async getImportHistory() {
    return await cachedRequest('imports', () => apiRequest('/imports'));
  },

  async addImportRecord(record) {
    await apiRequest('/imports', { method: 'POST', body: record });
    invalidateCache('imports');
  },

  // ========== 交易记录本管理 ==========
  async getAllRecords() {
    return await cachedRequest('records', () => apiRequest('/records'));
  },

  async createRecord(record) {
    const result = await apiRequest('/records', { method: 'POST', body: record });
    invalidateCache('records');
    return result;
  },

  async updateRecord(recordId, updates) {
    const result = await apiRequest(`/records/${recordId}`, { method: 'PATCH', body: updates });
    invalidateCache('records');
    return result;
  },

  async deleteRecord(recordId) {
    await apiRequest(`/records/${recordId}`, { method: 'DELETE' });
    invalidateCache('records', 'trades');
    return await this.getAllRecords();
  },

  async getRecordById(recordId) {
    const records = await this.getAllRecords();
    return records.find(r => r.id === recordId);
  },

  async refreshRecordStats(recordId) {
    await apiRequest(`/records/${recordId}/refresh-stats`, { method: 'POST' });
    invalidateCache('records');
  },

  async getTradesByRecord(recordId) {
    return await apiRequest(`/trades?recordId=${encodeURIComponent(recordId)}`);
  },

  // ========== 交易策略管理 ==========
  async getAllStrategies() {
    return await cachedRequest('strategies', () => apiRequest('/strategies'));
  },

  async createStrategy(strategy) {
    const result = await apiRequest('/strategies', { method: 'POST', body: strategy });
    invalidateCache('strategies');
    return result;
  },

  async updateStrategy(strategyId, updates) {
    const result = await apiRequest(`/strategies/${strategyId}`, { method: 'PATCH', body: updates });
    invalidateCache('strategies');
    return result;
  },

  async deleteStrategy(strategyId) {
    await apiRequest(`/strategies/${strategyId}`, { method: 'DELETE' });
    invalidateCache('strategies');
    return await this.getAllStrategies();
  },

  async getStrategyById(strategyId) {
    const strategies = await this.getAllStrategies();
    return strategies.find(s => s.id === strategyId);
  },

  async refreshStrategyUsageCounts() {
    const result = await apiRequest('/strategies/refresh-usage', { method: 'POST' });
    invalidateCache('strategies');
    return result;
  },

  async addStrategyToTrade(tradeId, strategyId) {
    const trades = await this.getAllTrades();
    const trade = trades.find(t => t.id === tradeId);
    const strategyIds = trade?.strategyIds || [];
    if (!strategyIds.includes(strategyId)) {
      await apiRequest(`/trades/${tradeId}`, { method: 'PATCH', body: { strategyIds: [...strategyIds, strategyId] } });
    }
    return await this.getAllTrades();
  },

  async removeStrategyFromTrade(tradeId, strategyId) {
    const trades = await this.getAllTrades();
    const trade = trades.find(t => t.id === tradeId);
    const strategyIds = (trade?.strategyIds || []).filter(id => id !== strategyId);
    await apiRequest(`/trades/${tradeId}`, { method: 'PATCH', body: { strategyIds } });
    return await this.getAllTrades();
  },

  // ========== 复盘记录管理 ==========
  async getAllReviews() {
    return await cachedRequest('reviews', () => apiRequest('/reviews'));
  },

  async getReviewByDate(date) {
    const reviews = await this.getAllReviews();
    return reviews.find(r => r.date === date);
  },

  async saveReview(review) {
    const result = await apiRequest('/reviews', { method: 'POST', body: review });
    invalidateCache('reviews');
    return result;
  },

  async deleteReview(date) {
    await apiRequest(`/reviews/${date}`, { method: 'DELETE' });
    invalidateCache('reviews');
    return await this.getAllReviews();
  },

  async hasReview(date) {
    const review = await this.getReviewByDate(date);
    return !!review;
  },

  // ========== 统计计算 ==========
  async calculateStats(trades) {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        totalPnL: 0,
        avgPnL: 0,
        winRate: 0,
        winCount: 0,
        lossCount: 0,
        maxDrawdown: 0,
        profitFactor: 0,
        totalProfit: 0,
        totalLoss: 0,
        avgProfitPerWinningTrade: 0,
        avgLossPerLosingTrade: 0,
        riskRewardRatio: 0,
        maxWin: 0,
        maxLoss: 0,
        avgHoldingTime: '-',
        longStats: { count: 0, pnl: 0 },
        shortStats: { count: 0, pnl: 0 },
      };
    }

    const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
    const winTrades = validTrades.filter(t => t.pnl > 0);
    const lossTrades = validTrades.filter(t => t.pnl < 0);

    const totalPnL = validTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalProfit = winTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0));

    // 平均盈利/亏损
    const avgProfitPerWinningTrade = winTrades.length > 0 ? totalProfit / winTrades.length : 0;
    const avgLossPerLosingTrade = lossTrades.length > 0 ? totalLoss / lossTrades.length : 0;

    // 盈亏比
    const riskRewardRatio = avgLossPerLosingTrade > 0 ? avgProfitPerWinningTrade / avgLossPerLosingTrade : 0;

    // 最大单笔盈亏
    const maxWin = winTrades.length > 0 ? Math.max(...winTrades.map(t => t.pnl)) : 0;
    const maxLoss = lossTrades.length > 0 ? Math.min(...lossTrades.map(t => t.pnl)) : 0;

    // 平均持仓时间
    const tradesWithHoldingTime = validTrades.filter(t => t.holdingSeconds && t.holdingSeconds > 0);
    let avgHoldingTime = '-';
    if (tradesWithHoldingTime.length > 0) {
      const avgSeconds = tradesWithHoldingTime.reduce((sum, t) => sum + t.holdingSeconds, 0) / tradesWithHoldingTime.length;
      const hours = Math.floor(avgSeconds / 3600);
      const minutes = Math.floor((avgSeconds % 3600) / 60);
      const secs = Math.floor(avgSeconds % 60);
      if (hours > 0) {
        avgHoldingTime = `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        avgHoldingTime = `${minutes}m ${secs}s`;
      } else {
        avgHoldingTime = `${secs}s`;
      }
    }

    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;
    validTrades.forEach(t => {
      cumulative += t.pnl || 0;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    const longTrades = validTrades.filter(t => t.direction === 'LONG' || t.openQuantity > 0);
    const shortTrades = validTrades.filter(t => t.direction === 'SHORT' || t.openQuantity < 0);

    return {
      totalTrades: validTrades.length,
      totalPnL: Number(totalPnL.toFixed(2)),
      avgPnL: validTrades.length > 0 ? Number((totalPnL / validTrades.length).toFixed(2)) : 0,
      winRate: validTrades.length > 0 ? Number((winTrades.length / validTrades.length * 100).toFixed(2)) : 0,
      winCount: winTrades.length,
      lossCount: lossTrades.length,
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      profitFactor: totalLoss > 0 ? Number((totalProfit / totalLoss).toFixed(2)) : totalProfit > 0 ? Infinity : 0,
      totalProfit: Number(totalProfit.toFixed(2)),
      totalLoss: Number(totalLoss.toFixed(2)),
      avgProfitPerWinningTrade: Number(avgProfitPerWinningTrade.toFixed(2)),
      avgLossPerLosingTrade: Number(avgLossPerLosingTrade.toFixed(2)),
      riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
      maxWin: Number(maxWin.toFixed(2)),
      maxLoss: Number(maxLoss.toFixed(2)),
      avgHoldingTime,
      longStats: {
        count: longTrades.length,
        pnl: Number(longTrades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)),
      },
      shortStats: {
        count: shortTrades.length,
        pnl: Number(shortTrades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2)),
      },
    };
  },

  // ========== 数据迁移 ==========
  async migrateMarketSessions() {
    const trades = await this.getAllTrades();
    if (trades.length === 0) return { updated: 0, total: 0 };
    const updatedTrades = trades.map(trade => {
      if (trade.openTime) {
        const openDate = new Date(trade.openTime);
        const newSession = getMarketSession(openDate);
        if (trade.marketSession !== newSession) {
          return { ...trade, marketSession: newSession };
        }
      }
      return trade;
    });
    await this.saveTrades(updatedTrades);
    return { updated: updatedTrades.length, total: trades.length };
  },
};

export default StorageService;
