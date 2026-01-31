/**
 * 交易合并服务
 * 
 * 功能：自动检测和合并加减仓交易
 * 原理：同品种 + 同方向 + 时间重叠 = 同一笔交易的加减仓
 */

/**
 * 判断两笔交易是否有时间重叠
 */
const hasTimeOverlap = (tradeA, tradeB) => {
  const aOpen = new Date(tradeA.openTime).getTime();
  const aClose = new Date(tradeA.closeTime).getTime();
  const bOpen = new Date(tradeB.openTime).getTime();
  const bClose = new Date(tradeB.closeTime).getTime();
  
  // A的开仓在B的持仓期间内，或B的开仓在A的持仓期间内
  return (aOpen >= bOpen && aOpen <= bClose) || (bOpen >= aOpen && bOpen <= aClose);
};

/**
 * 并查集 (Union-Find) 实现
 * 用于高效地将重叠的交易归为同一组
 */
class UnionFind {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = Array(size).fill(0);
  }
  
  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // 路径压缩
    }
    return this.parent[x];
  }
  
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;
    
    // 按秩合并
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }
}

/**
 * 检测并分组重叠的交易
 * @param {Array} trades - 交易列表
 * @returns {Array} 合并组列表，每组包含多笔交易
 */
export const detectMergeGroups = (trades) => {
  if (!trades || trades.length === 0) return [];
  
  // 1. 按 品种+方向 分组
  const grouped = {};
  trades.forEach((trade, idx) => {
    const key = `${trade.instrumentCode}_${trade.direction}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ trade, idx });
  });
  
  // 2. 在每组内检测时间重叠
  const mergeGroups = [];
  
  Object.values(grouped).forEach(group => {
    if (group.length < 2) {
      // 单笔交易，不需要合并
      return;
    }
    
    // 使用并查集检测重叠
    const uf = new UnionFind(group.length);
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (hasTimeOverlap(group[i].trade, group[j].trade)) {
          uf.union(i, j);
        }
      }
    }
    
    // 收集合并组
    const groupMap = {};
    for (let i = 0; i < group.length; i++) {
      const root = uf.find(i);
      if (!groupMap[root]) groupMap[root] = [];
      groupMap[root].push(group[i].trade);
    }
    
    // 只保留有多笔交易的组（需要合并的）
    Object.values(groupMap).forEach(trades => {
      if (trades.length > 1) {
        mergeGroups.push(trades);
      }
    });
  });
  
  return mergeGroups;
};

/**
 * 计算合并交易组的统计数据
 * @param {Array} trades - 同一组的交易列表
 * @param {Array} instruments - 品种配置列表
 * @returns {Object} 合并后的统计数据
 */
export const calculateMergedStats = (trades, instruments = []) => {
  if (!trades || trades.length === 0) return null;
  
  // 按开仓时间排序
  const sorted = [...trades].sort((a, b) => 
    new Date(a.openTime) - new Date(b.openTime)
  );
  
  const firstTrade = sorted[0];
  const lastTrade = sorted[sorted.length - 1];
  
  // 找到最早开仓和最晚平仓时间
  const firstOpenTime = Math.min(...trades.map(t => new Date(t.openTime).getTime()));
  const lastCloseTime = Math.max(...trades.map(t => new Date(t.closeTime).getTime()));
  
  // 计算总手数
  const totalQuantity = trades.reduce((sum, t) => sum + Math.abs(t.openQuantity || 1), 0);
  
  // 计算加权平均开仓价
  const weightedOpenPrice = trades.reduce((sum, t) => {
    const qty = Math.abs(t.openQuantity || 1);
    return sum + (t.openPrice * qty);
  }, 0) / totalQuantity;
  
  // 计算加权平均平仓价
  const weightedClosePrice = trades.reduce((sum, t) => {
    const qty = Math.abs(t.openQuantity || 1);
    return sum + (t.closePrice * qty);
  }, 0) / totalQuantity;
  
  // 计算总盈亏
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  
  // 计算总持仓时长（秒）
  const totalDuration = Math.floor((lastCloseTime - firstOpenTime) / 1000);
  
  // 获取品种 tick 值
  const getTickValue = (code) => {
    const TICK_VALUES = {
      'GC': 10, 'ES': 12.5, 'NQ': 5, 'RTY': 5, 'CL': 10, 'SI': 25, 'YM': 5,
      'ZB': 31.25, 'ZN': 15.625, '6E': 12.5, 'M2K': 0.5, 'MES': 1.25, 'MNQ': 0.5, 'MGC': 1,
    };
    const inst = instruments.find(i => i.code === code);
    return inst?.tickValue || TICK_VALUES[code] || 5;
  };
  
  // 估算合并后的 MAE/MFE
  // 注意：这是估算值，真实值需要逐tick数据
  let estimatedMAE = 0;
  let estimatedMFE = 0;
  
  trades.forEach(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    const mfe = t.mfe ?? t.jigsawData?.mfe;
    const tickValue = getTickValue(t.instrumentCode);
    const qty = Math.abs(t.openQuantity || 1);
    
    if (mae !== undefined && mae !== null) {
      estimatedMAE += Math.abs(mae) * tickValue * qty;
    }
    if (mfe !== undefined && mfe !== null) {
      estimatedMFE += Math.abs(mfe) * tickValue * qty;
    }
  });
  
  // 计算最大同时持仓量（简化计算：假设所有重叠的都是同时持有）
  // 更精确的计算需要按时间点逐一分析
  const maxConcurrentQty = calculateMaxConcurrentPosition(trades);
  
  // 加仓分析：比较加权平均价与第一笔开仓价
  const firstEntryPrice = firstTrade.openPrice;
  const entryImprovement = firstTrade.direction === 'LONG' 
    ? firstEntryPrice - weightedOpenPrice  // 多头：加权价更低=改善
    : weightedOpenPrice - firstEntryPrice; // 空头：加权价更高=改善
  
  // 平仓分析：比较加权平均价与最后一笔平仓价
  const lastExitPrice = lastTrade.closePrice;
  const exitImprovement = firstTrade.direction === 'LONG'
    ? weightedClosePrice - lastExitPrice   // 多头：加权价更高=分批止盈有效
    : lastExitPrice - weightedClosePrice;  // 空头：加权价更低=分批止盈有效
  
  return {
    // 基础信息
    instrumentCode: firstTrade.instrumentCode,
    direction: firstTrade.direction,
    tradeCount: trades.length,
    trades: sorted,
    
    // 时间
    firstOpenTime: new Date(firstOpenTime),
    lastCloseTime: new Date(lastCloseTime),
    totalDuration,
    
    // 仓位
    totalQuantity,
    maxConcurrentQty,
    avgQuantity: totalQuantity / trades.length,
    
    // 价格
    weightedOpenPrice,
    weightedClosePrice,
    firstEntryPrice,
    lastExitPrice,
    
    // 盈亏
    totalPnL,
    avgPnL: totalPnL / trades.length,
    
    // 风险（估算）
    estimatedMAE,
    estimatedMFE,
    riskRewardRatio: estimatedMAE > 0 ? totalPnL / estimatedMAE : null,
    profitCaptureRate: estimatedMFE > 0 ? (Math.max(0, totalPnL) / estimatedMFE) * 100 : null,
    
    // 加减仓分析
    entryImprovement,
    entryStrategy: entryImprovement > 0 ? 'improved' : entryImprovement < 0 ? 'worsened' : 'neutral',
    exitImprovement,
    exitStrategy: exitImprovement > 0 ? 'improved' : exitImprovement < 0 ? 'worsened' : 'neutral',
  };
};

/**
 * 计算最大同时持仓量
 */
const calculateMaxConcurrentPosition = (trades) => {
  // 创建时间点事件列表
  const events = [];
  trades.forEach(t => {
    const qty = Math.abs(t.openQuantity || 1);
    events.push({ time: new Date(t.openTime).getTime(), delta: qty });
    events.push({ time: new Date(t.closeTime).getTime(), delta: -qty });
  });
  
  // 按时间排序
  events.sort((a, b) => a.time - b.time);
  
  // 遍历计算最大值
  let current = 0;
  let max = 0;
  events.forEach(e => {
    current += e.delta;
    if (current > max) max = current;
  });
  
  return max;
};

/**
 * 将交易列表转换为包含合并组的显示数据
 * @param {Array} trades - 原始交易列表
 * @param {Array} instruments - 品种配置
 * @returns {Array} 包含合并信息的交易列表
 */
export const processTradesWithMerge = (trades, instruments = []) => {
  if (!trades || trades.length === 0) return [];
  
  // 检测合并组
  const mergeGroups = detectMergeGroups(trades);
  
  // 创建交易ID到合并组的映射
  const tradeToGroup = new Map();
  const groupStats = new Map();
  
  mergeGroups.forEach((group, groupIdx) => {
    const groupId = `merge_${groupIdx}`;
    const stats = calculateMergedStats(group, instruments);
    groupStats.set(groupId, stats);
    
    group.forEach(trade => {
      tradeToGroup.set(trade.id, groupId);
    });
  });
  
  // 构建显示列表
  const result = [];
  const processedGroups = new Set();
  
  // 按时间排序
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(b.openTime) - new Date(a.openTime)
  );
  
  sortedTrades.forEach(trade => {
    const groupId = tradeToGroup.get(trade.id);
    
    if (groupId) {
      // 这笔交易属于某个合并组
      if (!processedGroups.has(groupId)) {
        // 第一次遇到这个组，添加合并后的汇总行
        processedGroups.add(groupId);
        const stats = groupStats.get(groupId);
        result.push({
          id: groupId,
          isMergedGroup: true,
          mergeStats: stats,
          childTrades: stats.trades,
          // 用于排序和显示的字段
          openTime: stats.firstOpenTime,
          closeTime: stats.lastCloseTime,
          instrumentCode: stats.instrumentCode,
          direction: stats.direction,
          openQuantity: stats.totalQuantity,
          pnl: stats.totalPnL,
          holdingSeconds: stats.totalDuration,
        });
      }
      // 不单独添加子交易（它们会在展开时显示）
    } else {
      // 独立交易，直接添加
      result.push({
        ...trade,
        isMergedGroup: false,
      });
    }
  });
  
  // 重新按时间排序
  result.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
  
  return result;
};

/**
 * 格式化持仓时间
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

export default {
  detectMergeGroups,
  calculateMergedStats,
  processTradesWithMerge,
  formatDuration,
};
