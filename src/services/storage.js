import { apiRequest } from './api';
import { getMarketSession } from '../utils/timezone';

// 本地存储 key
const USER_SETTINGS_KEY = 'tradewhy_user_settings';

// 默认用户设置
const DEFAULT_USER_SETTINGS = {
  timezone: 'Asia/Shanghai', // 用户所在时区（用于显示）
  dataSourceTimezone: 'Asia/Shanghai', // 数据源时区（交易软件使用的时区）
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
    return await apiRequest('/trades');
  },

  async saveTrades(trades) {
    await apiRequest('/trades', { method: 'PUT', body: { trades } });
  },

  async addTrades(newTrades) {
    await apiRequest('/trades/bulk', { method: 'POST', body: { trades: newTrades } });
    return await this.getAllTrades();
  },

  async getTradesByInstrument(instrumentCode) {
    const all = await this.getAllTrades();
    return all.filter(t => t.instrumentCode === instrumentCode);
  },

  async updateTrade(tradeId, updates) {
    await apiRequest(`/trades/${tradeId}`, { method: 'PATCH', body: updates });
    return await this.getAllTrades();
  },

  async deleteTrade(tradeId) {
    await apiRequest(`/trades/${tradeId}`, { method: 'DELETE' });
    return await this.getAllTrades();
  },

  async clearAllTrades() {
    await apiRequest('/trades', { method: 'DELETE' });
  },

  // ========== 品种配置 ==========
  async getInstruments() {
    return await apiRequest('/instruments');
  },

  async saveInstruments(instruments) {
    await apiRequest('/instruments', { method: 'PUT', body: { instruments } });
  },

  async getInstrumentByCode(code) {
    const instruments = await this.getInstruments();
    return instruments.find(i => i.code === code);
  },

  // ========== 导入记录 ==========
  async getImportHistory() {
    return await apiRequest('/imports');
  },

  async addImportRecord(record) {
    await apiRequest('/imports', { method: 'POST', body: record });
  },

  // ========== 交易记录本管理 ==========
  async getAllRecords() {
    return await apiRequest('/records');
  },

  async createRecord(record) {
    return await apiRequest('/records', { method: 'POST', body: record });
  },

  async updateRecord(recordId, updates) {
    return await apiRequest(`/records/${recordId}`, { method: 'PATCH', body: updates });
  },

  async deleteRecord(recordId) {
    await apiRequest(`/records/${recordId}`, { method: 'DELETE' });
    return await this.getAllRecords();
  },

  async getRecordById(recordId) {
    const records = await this.getAllRecords();
    return records.find(r => r.id === recordId);
  },

  async refreshRecordStats(recordId) {
    await apiRequest(`/records/${recordId}/refresh-stats`, { method: 'POST' });
  },

  async getTradesByRecord(recordId) {
    return await apiRequest(`/trades?recordId=${encodeURIComponent(recordId)}`);
  },

  // ========== 交易策略管理 ==========
  async getAllStrategies() {
    return await apiRequest('/strategies');
  },

  async createStrategy(strategy) {
    return await apiRequest('/strategies', { method: 'POST', body: strategy });
  },

  async updateStrategy(strategyId, updates) {
    return await apiRequest(`/strategies/${strategyId}`, { method: 'PATCH', body: updates });
  },

  async deleteStrategy(strategyId) {
    await apiRequest(`/strategies/${strategyId}`, { method: 'DELETE' });
    return await this.getAllStrategies();
  },

  async getStrategyById(strategyId) {
    const strategies = await this.getAllStrategies();
    return strategies.find(s => s.id === strategyId);
  },

  async refreshStrategyUsageCounts() {
    return await apiRequest('/strategies/refresh-usage', { method: 'POST' });
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
    return await apiRequest('/reviews');
  },

  async getReviewByDate(date) {
    const reviews = await this.getAllReviews();
    return reviews.find(r => r.date === date);
  },

  async saveReview(review) {
    return await apiRequest('/reviews', { method: 'POST', body: review });
  },

  async deleteReview(date) {
    await apiRequest(`/reviews/${date}`, { method: 'DELETE' });
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
