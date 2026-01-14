/**
 * AI 复盘分析服务
 * 基于交易数据进行智能分析，提供优化策略建议
 */
import dayjs from 'dayjs';
import StorageService from './storage';

/**
 * 获取持仓时间（秒），兼容旧数据
 */
const getHoldingSeconds = (trade) => {
  if (trade.holdingSeconds !== undefined && trade.holdingSeconds !== null) {
    return trade.holdingSeconds;
  }
  if (trade.holdingMinutes !== undefined && trade.holdingMinutes !== null) {
    return trade.holdingMinutes * 60;
  }
  if (trade.openTime && trade.closeTime) {
    const openTime = new Date(trade.openTime);
    const closeTime = new Date(trade.closeTime);
    if (!isNaN(openTime.getTime()) && !isNaN(closeTime.getTime())) {
      return Math.round((closeTime - openTime) / 1000);
    }
  }
  return 0;
};

/**
 * 格式化持仓时间为易读格式
 */
const formatHoldingTime = (seconds) => {
  if (!seconds || seconds === 0) return '0秒';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);
  return parts.join('');
};

/**
 * 分析持仓时间
 */
const analyzeHoldingTime = (trades) => {
  if (!trades || trades.length === 0) return null;
  
  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
  if (validTrades.length === 0) return null;

  // 为每笔交易添加持仓时间
  const tradesWithHolding = validTrades.map(t => ({
    ...t,
    holdingSeconds: getHoldingSeconds(t),
  }));

  // 基础统计
  const holdingTimes = tradesWithHolding.map(t => t.holdingSeconds).filter(s => s > 0);
  if (holdingTimes.length === 0) {
    return {
      hasData: false,
      message: '没有有效的持仓时间数据',
    };
  }

  const totalSeconds = holdingTimes.reduce((a, b) => a + b, 0);
  const avgSeconds = Math.round(totalSeconds / holdingTimes.length);
  const maxSeconds = Math.max(...holdingTimes);
  const minSeconds = Math.min(...holdingTimes);
  
  // 计算中位数
  const sortedTimes = [...holdingTimes].sort((a, b) => a - b);
  const medianSeconds = sortedTimes[Math.floor(sortedTimes.length / 2)];

  // 持仓时间分布区间
  const timeRanges = [
    { label: '1分钟内', min: 0, max: 60, trades: [], pnl: 0, winCount: 0 },
    { label: '1-5分钟', min: 60, max: 300, trades: [], pnl: 0, winCount: 0 },
    { label: '5-15分钟', min: 300, max: 900, trades: [], pnl: 0, winCount: 0 },
    { label: '15-30分钟', min: 900, max: 1800, trades: [], pnl: 0, winCount: 0 },
    { label: '30-60分钟', min: 1800, max: 3600, trades: [], pnl: 0, winCount: 0 },
    { label: '1-2小时', min: 3600, max: 7200, trades: [], pnl: 0, winCount: 0 },
    { label: '2-4小时', min: 7200, max: 14400, trades: [], pnl: 0, winCount: 0 },
    { label: '4小时以上', min: 14400, max: Infinity, trades: [], pnl: 0, winCount: 0 },
  ];

  tradesWithHolding.forEach(t => {
    const seconds = t.holdingSeconds;
    for (const range of timeRanges) {
      if (seconds >= range.min && seconds < range.max) {
        range.trades.push(t);
        range.pnl += t.pnl || 0;
        if (t.pnl > 0) range.winCount++;
        break;
      }
    }
  });

  const distribution = timeRanges.map(range => ({
    label: range.label,
    count: range.trades.length,
    percentage: ((range.trades.length / tradesWithHolding.length) * 100).toFixed(1),
    totalPnL: Number(range.pnl.toFixed(2)),
    avgPnL: range.trades.length > 0 ? Number((range.pnl / range.trades.length).toFixed(2)) : 0,
    winRate: range.trades.length > 0 ? Number(((range.winCount / range.trades.length) * 100).toFixed(2)) : 0,
  })).filter(d => d.count > 0);

  // 盈利交易 vs 亏损交易的持仓时间对比
  const winningTrades = tradesWithHolding.filter(t => t.pnl > 0);
  const losingTrades = tradesWithHolding.filter(t => t.pnl < 0);

  const avgWinHolding = winningTrades.length > 0
    ? Math.round(winningTrades.reduce((a, t) => a + t.holdingSeconds, 0) / winningTrades.length)
    : 0;
  const avgLossHolding = losingTrades.length > 0
    ? Math.round(losingTrades.reduce((a, t) => a + t.holdingSeconds, 0) / losingTrades.length)
    : 0;

  // 找出最优持仓时间区间
  const bestRange = distribution.reduce((best, current) => {
    if (current.count >= 3 && current.avgPnL > (best?.avgPnL || -Infinity)) {
      return current;
    }
    return best;
  }, null);

  const worstRange = distribution.reduce((worst, current) => {
    if (current.count >= 3 && current.avgPnL < (worst?.avgPnL || Infinity)) {
      return current;
    }
    return worst;
  }, null);

  return {
    hasData: true,
    summary: {
      avgHolding: avgSeconds,
      avgHoldingFormatted: formatHoldingTime(avgSeconds),
      medianHolding: medianSeconds,
      medianHoldingFormatted: formatHoldingTime(medianSeconds),
      maxHolding: maxSeconds,
      maxHoldingFormatted: formatHoldingTime(maxSeconds),
      minHolding: minSeconds,
      minHoldingFormatted: formatHoldingTime(minSeconds),
      totalTrades: tradesWithHolding.length,
    },
    distribution,
    comparison: {
      avgWinHolding,
      avgWinHoldingFormatted: formatHoldingTime(avgWinHolding),
      avgLossHolding,
      avgLossHoldingFormatted: formatHoldingTime(avgLossHolding),
      difference: avgWinHolding - avgLossHolding,
      differenceFormatted: formatHoldingTime(Math.abs(avgWinHolding - avgLossHolding)),
      winningHoldsLonger: avgWinHolding > avgLossHolding,
    },
    optimalRange: bestRange,
    worstRange,
  };
};

/**
 * 分析日内小时表现
 */
const analyzeHourlyPerformance = (trades) => {
  if (!trades || trades.length === 0) return null;
  
  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null && t.openTime);
  if (validTrades.length === 0) return null;

  // 按小时分组（0-23）
  const byHour = {};
  for (let h = 0; h < 24; h++) {
    byHour[h] = { trades: [], pnl: 0, winCount: 0 };
  }

  validTrades.forEach(t => {
    const hour = new Date(t.openTime).getHours();
    byHour[hour].trades.push(t);
    byHour[hour].pnl += t.pnl || 0;
    if (t.pnl > 0) byHour[hour].winCount++;
  });

  const hourlyData = Object.entries(byHour)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      hourLabel: `${hour.toString().padStart(2, '0')}:00`,
      count: data.trades.length,
      totalPnL: Number(data.pnl.toFixed(2)),
      avgPnL: data.trades.length > 0 ? Number((data.pnl / data.trades.length).toFixed(2)) : 0,
      winRate: data.trades.length > 0 ? Number(((data.winCount / data.trades.length) * 100).toFixed(2)) : 0,
    }))
    .filter(d => d.count > 0);

  // 找出最佳和最差小时
  const bestHour = hourlyData.reduce((best, current) => {
    if (current.count >= 3 && current.avgPnL > (best?.avgPnL || -Infinity)) {
      return current;
    }
    return best;
  }, null);

  const worstHour = hourlyData.reduce((worst, current) => {
    if (current.count >= 3 && current.avgPnL < (worst?.avgPnL || Infinity)) {
      return current;
    }
    return worst;
  }, null);

  return {
    hourlyData,
    bestHour,
    worstHour,
  };
};

/**
 * 分析连续交易模式
 */
const analyzeStreaks = (trades) => {
  if (!trades || trades.length === 0) return null;
  
  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
  if (validTrades.length === 0) return null;

  // 计算连续盈利/亏损
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let maxWinStreakPnL = 0;
  let maxLossStreakPnL = 0;
  let currentWinStreakPnL = 0;
  let currentLossStreakPnL = 0;

  validTrades.forEach(t => {
    if (t.pnl > 0) {
      currentWinStreak++;
      currentWinStreakPnL += t.pnl;
      if (currentWinStreak > maxWinStreak) {
        maxWinStreak = currentWinStreak;
        maxWinStreakPnL = currentWinStreakPnL;
      }
      currentLossStreak = 0;
      currentLossStreakPnL = 0;
    } else if (t.pnl < 0) {
      currentLossStreak++;
      currentLossStreakPnL += t.pnl;
      if (currentLossStreak > maxLossStreak) {
        maxLossStreak = currentLossStreak;
        maxLossStreakPnL = currentLossStreakPnL;
      }
      currentWinStreak = 0;
      currentWinStreakPnL = 0;
    }
  });

  // 计算连续交易后的表现（亏损后继续交易的表现）
  let afterLossPerformance = { count: 0, wins: 0, pnl: 0 };
  let afterWinPerformance = { count: 0, wins: 0, pnl: 0 };
  
  for (let i = 1; i < validTrades.length; i++) {
    const prevTrade = validTrades[i - 1];
    const currentTrade = validTrades[i];
    
    if (prevTrade.pnl < 0) {
      afterLossPerformance.count++;
      afterLossPerformance.pnl += currentTrade.pnl || 0;
      if (currentTrade.pnl > 0) afterLossPerformance.wins++;
    } else if (prevTrade.pnl > 0) {
      afterWinPerformance.count++;
      afterWinPerformance.pnl += currentTrade.pnl || 0;
      if (currentTrade.pnl > 0) afterWinPerformance.wins++;
    }
  }

  return {
    maxWinStreak,
    maxWinStreakPnL: Number(maxWinStreakPnL.toFixed(2)),
    maxLossStreak,
    maxLossStreakPnL: Number(maxLossStreakPnL.toFixed(2)),
    afterLoss: {
      count: afterLossPerformance.count,
      winRate: afterLossPerformance.count > 0 
        ? Number(((afterLossPerformance.wins / afterLossPerformance.count) * 100).toFixed(2))
        : 0,
      avgPnL: afterLossPerformance.count > 0
        ? Number((afterLossPerformance.pnl / afterLossPerformance.count).toFixed(2))
        : 0,
    },
    afterWin: {
      count: afterWinPerformance.count,
      winRate: afterWinPerformance.count > 0
        ? Number(((afterWinPerformance.wins / afterWinPerformance.count) * 100).toFixed(2))
        : 0,
      avgPnL: afterWinPerformance.count > 0
        ? Number((afterWinPerformance.pnl / afterWinPerformance.count).toFixed(2))
        : 0,
    },
  };
};

/**
 * 分析资金曲线
 */
const analyzeEquityCurve = (trades) => {
  if (!trades || trades.length === 0) return null;
  
  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
  if (validTrades.length === 0) return null;

  // 计算累计盈亏曲线
  let cumPnL = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPeak = 0;
  let currentDrawdown = 0;
  let drawdownStartIdx = -1;
  let maxDrawdownDuration = 0;
  let currentDrawdownDuration = 0;
  
  const equityCurve = validTrades.map((t, idx) => {
    cumPnL += t.pnl || 0;
    
    if (cumPnL > peak) {
      peak = cumPnL;
      currentDrawdown = 0;
      currentDrawdownDuration = 0;
      drawdownStartIdx = -1;
    } else {
      currentDrawdown = peak - cumPnL;
      if (drawdownStartIdx === -1) {
        drawdownStartIdx = idx;
      }
      currentDrawdownDuration = idx - drawdownStartIdx;
      
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
        maxDrawdownPeak = peak;
      }
      if (currentDrawdownDuration > maxDrawdownDuration) {
        maxDrawdownDuration = currentDrawdownDuration;
      }
    }
    
    return {
      index: idx,
      pnl: t.pnl,
      cumPnL: Number(cumPnL.toFixed(2)),
      drawdown: Number(currentDrawdown.toFixed(2)),
    };
  });

  // 计算恢复因子
  const totalProfit = validTrades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
  const recoveryFactor = maxDrawdown > 0 ? totalProfit / maxDrawdown : 0;

  // 计算盈利天数和亏损天数
  const byDate = {};
  validTrades.forEach(t => {
    const date = dayjs(t.openTime).format('YYYY-MM-DD');
    if (!byDate[date]) byDate[date] = 0;
    byDate[date] += t.pnl || 0;
  });
  
  const profitDays = Object.values(byDate).filter(v => v > 0).length;
  const lossDays = Object.values(byDate).filter(v => v < 0).length;
  const totalDays = Object.keys(byDate).length;

  return {
    finalPnL: Number(cumPnL.toFixed(2)),
    peak: Number(peak.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: maxDrawdownPeak > 0 ? Number(((maxDrawdown / maxDrawdownPeak) * 100).toFixed(2)) : 0,
    maxDrawdownDuration,
    recoveryFactor: Number(recoveryFactor.toFixed(2)),
    tradingDays: {
      total: totalDays,
      profitable: profitDays,
      losing: lossDays,
      breakeven: totalDays - profitDays - lossDays,
      profitRatio: totalDays > 0 ? Number(((profitDays / totalDays) * 100).toFixed(2)) : 0,
    },
    equityCurve,
  };
};

/**
 * 分析风险指标
 */
const analyzeRiskMetrics = (trades) => {
  if (!trades || trades.length === 0) return null;
  
  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
  if (validTrades.length === 0) return null;

  const pnls = validTrades.map(t => t.pnl);
  const profits = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0).map(p => Math.abs(p));

  // 基础统计
  const totalPnL = pnls.reduce((a, b) => a + b, 0);
  const avgPnL = totalPnL / pnls.length;
  const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  
  // 计算标准差
  const variance = pnls.reduce((sum, p) => sum + Math.pow(p - avgPnL, 2), 0) / pnls.length;
  const stdDev = Math.sqrt(variance);

  // 盈亏比
  const profitLossRatio = avgLoss > 0 ? avgProfit / avgLoss : 0;

  // 利润系数
  const grossProfit = profits.reduce((a, b) => a + b, 0);
  const grossLoss = losses.reduce((a, b) => a + b, 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  // 期望值 (Expectancy)
  const winRate = profits.length / pnls.length;
  const expectancy = (winRate * avgProfit) - ((1 - winRate) * avgLoss);

  // 计算夏普比率（简化版，假设无风险收益率为0）
  const sharpeRatio = stdDev > 0 ? avgPnL / stdDev : 0;

  // 计算最大单笔盈亏
  const maxProfit = profits.length > 0 ? Math.max(...profits) : 0;
  const maxLoss = losses.length > 0 ? Math.max(...losses) : 0;

  // 计算盈亏占比
  const profitContribution = grossProfit / (grossProfit + grossLoss) * 100;

  return {
    totalTrades: pnls.length,
    winningTrades: profits.length,
    losingTrades: losses.length,
    winRate: Number((winRate * 100).toFixed(2)),
    avgPnL: Number(avgPnL.toFixed(2)),
    avgProfit: Number(avgProfit.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    profitLossRatio: Number(profitLossRatio.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    standardDeviation: Number(stdDev.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    maxProfit: Number(maxProfit.toFixed(2)),
    maxLoss: Number(maxLoss.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    profitContribution: Number(profitContribution.toFixed(2)),
  };
};

/**
 * 分析交易频率
 */
const analyzeTradeFrequency = (trades) => {
  if (!trades || trades.length === 0) return null;
  
  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null && t.openTime);
  if (validTrades.length === 0) return null;

  // 按日期分组
  const byDate = {};
  validTrades.forEach(t => {
    const date = dayjs(t.openTime).format('YYYY-MM-DD');
    if (!byDate[date]) {
      byDate[date] = { trades: [], pnl: 0, winCount: 0 };
    }
    byDate[date].trades.push(t);
    byDate[date].pnl += t.pnl || 0;
    if (t.pnl > 0) byDate[date].winCount++;
  });

  // 按星期几分组
  const byWeekday = {};
  for (let d = 0; d < 7; d++) {
    byWeekday[d] = { trades: [], pnl: 0, winCount: 0 };
  }
  validTrades.forEach(t => {
    const weekday = new Date(t.openTime).getDay();
    byWeekday[weekday].trades.push(t);
    byWeekday[weekday].pnl += t.pnl || 0;
    if (t.pnl > 0) byWeekday[weekday].winCount++;
  });

  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekdayData = Object.entries(byWeekday)
    .map(([day, data]) => ({
      day: parseInt(day),
      dayName: weekdayNames[parseInt(day)],
      count: data.trades.length,
      totalPnL: Number(data.pnl.toFixed(2)),
      avgPnL: data.trades.length > 0 ? Number((data.pnl / data.trades.length).toFixed(2)) : 0,
      winRate: data.trades.length > 0 ? Number(((data.winCount / data.trades.length) * 100).toFixed(2)) : 0,
    }))
    .filter(d => d.count > 0);

  // 日交易统计
  const dailyCounts = Object.values(byDate).map(d => d.trades.length);
  const avgDailyTrades = dailyCounts.length > 0 ? dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length : 0;
  const maxDailyTrades = dailyCounts.length > 0 ? Math.max(...dailyCounts) : 0;
  const minDailyTrades = dailyCounts.length > 0 ? Math.min(...dailyCounts) : 0;

  // 找出最佳和最差日期
  const dailyData = Object.entries(byDate).map(([date, data]) => ({
    date,
    count: data.trades.length,
    pnl: Number(data.pnl.toFixed(2)),
    winRate: data.trades.length > 0 ? Number(((data.winCount / data.trades.length) * 100).toFixed(2)) : 0,
  }));

  const bestDay = dailyData.reduce((best, current) => 
    current.pnl > (best?.pnl || -Infinity) ? current : best, null);
  const worstDay = dailyData.reduce((worst, current) => 
    current.pnl < (worst?.pnl || Infinity) ? current : worst, null);

  // 找出最佳星期几
  const bestWeekday = weekdayData.reduce((best, current) => {
    if (current.count >= 3 && current.avgPnL > (best?.avgPnL || -Infinity)) {
      return current;
    }
    return best;
  }, null);

  return {
    totalDays: Object.keys(byDate).length,
    avgDailyTrades: Number(avgDailyTrades.toFixed(2)),
    maxDailyTrades,
    minDailyTrades,
    weekdayData,
    bestDay,
    worstDay,
    bestWeekday,
  };
};

/**
 * 分析交易模式
 */
const analyzeTradingPatterns = (trades) => {
  if (!trades || trades.length === 0) return null;

  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
  if (validTrades.length === 0) return null;

  // 按市场时段分组
  const bySession = {};
  validTrades.forEach(t => {
    const session = t.marketSession || '未知';
    if (!bySession[session]) {
      bySession[session] = { trades: [], totalPnL: 0, winCount: 0, lossCount: 0 };
    }
    bySession[session].trades.push(t);
    bySession[session].totalPnL += t.pnl || 0;
    if (t.pnl > 0) bySession[session].winCount++;
    else if (t.pnl < 0) bySession[session].lossCount++;
  });

  // 按品种分组
  const byInstrument = {};
  validTrades.forEach(t => {
    const inst = t.instrumentCode || '未知';
    if (!byInstrument[inst]) {
      byInstrument[inst] = { trades: [], totalPnL: 0, winCount: 0, lossCount: 0 };
    }
    byInstrument[inst].trades.push(t);
    byInstrument[inst].totalPnL += t.pnl || 0;
    if (t.pnl > 0) byInstrument[inst].winCount++;
    else if (t.pnl < 0) byInstrument[inst].lossCount++;
  });

  // 按方向分组
  const byDirection = {
    LONG: { trades: [], totalPnL: 0, winCount: 0, lossCount: 0 },
    SHORT: { trades: [], totalPnL: 0, winCount: 0, lossCount: 0 },
  };
  validTrades.forEach(t => {
    const dir = t.direction || 'LONG';
    if (byDirection[dir]) {
      byDirection[dir].trades.push(t);
      byDirection[dir].totalPnL += t.pnl || 0;
      if (t.pnl > 0) byDirection[dir].winCount++;
      else if (t.pnl < 0) byDirection[dir].lossCount++;
    }
  });

  // 计算时段表现
  const sessionPerformance = Object.entries(bySession).map(([session, data]) => ({
    session,
    totalTrades: data.trades.length,
    totalPnL: Number(data.totalPnL.toFixed(2)),
    winRate: data.trades.length > 0 
      ? Number((data.winCount / data.trades.length * 100).toFixed(2)) 
      : 0,
    avgPnL: data.trades.length > 0 
      ? Number((data.totalPnL / data.trades.length).toFixed(2)) 
      : 0,
  }));

  // 计算品种表现
  const instrumentPerformance = Object.entries(byInstrument).map(([inst, data]) => ({
    instrument: inst,
    totalTrades: data.trades.length,
    totalPnL: Number(data.totalPnL.toFixed(2)),
    winRate: data.trades.length > 0 
      ? Number((data.winCount / data.trades.length * 100).toFixed(2)) 
      : 0,
    avgPnL: data.trades.length > 0 
      ? Number((data.totalPnL / data.trades.length).toFixed(2)) 
      : 0,
  }));

  // 计算方向表现
  const directionPerformance = {
    LONG: {
      totalTrades: byDirection.LONG.trades.length,
      totalPnL: Number(byDirection.LONG.totalPnL.toFixed(2)),
      winRate: byDirection.LONG.trades.length > 0
        ? Number((byDirection.LONG.winCount / byDirection.LONG.trades.length * 100).toFixed(2))
        : 0,
    },
    SHORT: {
      totalTrades: byDirection.SHORT.trades.length,
      totalPnL: Number(byDirection.SHORT.totalPnL.toFixed(2)),
      winRate: byDirection.SHORT.trades.length > 0
        ? Number((byDirection.SHORT.winCount / byDirection.SHORT.trades.length * 100).toFixed(2))
        : 0,
    },
  };

  return {
    sessionPerformance,
    instrumentPerformance,
    directionPerformance,
  };
};

/**
 * 识别问题交易
 * 返回问题类型及相关的具体交易记录
 */
const identifyProblemTrades = (trades) => {
  if (!trades || trades.length === 0) return [];

  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
  const problems = [];

  // 1. 连续亏损 - 找出所有连续亏损序列
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  let maxConsecutiveLossesStart = -1;
  let currentStreakStart = -1;
  let consecutiveLossTrades = [];
  let maxConsecutiveLossTrades = [];
  
  validTrades.forEach((trade, index) => {
    if (trade.pnl < 0) {
      consecutiveLosses++;
      consecutiveLossTrades.push(trade);
      if (consecutiveLosses === 1) {
        currentStreakStart = index;
      }
      if (consecutiveLosses > maxConsecutiveLosses) {
        maxConsecutiveLosses = consecutiveLosses;
        maxConsecutiveLossesStart = currentStreakStart;
        maxConsecutiveLossTrades = [...consecutiveLossTrades];
      }
    } else {
      consecutiveLosses = 0;
      consecutiveLossTrades = [];
    }
  });

  if (maxConsecutiveLosses >= 3) {
    const totalLoss = maxConsecutiveLossTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    problems.push({
      type: '连续亏损',
      severity: maxConsecutiveLosses >= 5 ? 'high' : 'medium',
      description: `发现连续 ${maxConsecutiveLosses} 笔亏损交易，共亏损 $${Math.abs(totalLoss).toFixed(2)}`,
      recommendation: '建议暂停交易，重新评估策略。检查是否存在情绪化交易或违反交易规则的情况。',
      trades: maxConsecutiveLossTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        instrumentCode: t.instrumentCode,
        direction: t.direction,
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: t.pnl,
        ticks: t.ticks,
        marketSession: t.marketSession,
        holdingSeconds: getHoldingSeconds(t),
        notes: t.notes || '',
        logicAnalysis: t.logicAnalysis || '',
        expectedTrend: t.expectedTrend || '',
      })),
      totalLoss: Number(totalLoss.toFixed(2)),
    });
  }

  // 2. 大额亏损（单笔亏损 > $200）
  const largeLosses = validTrades.filter(t => t.pnl < -200);
  if (largeLosses.length > 0) {
    const sortedLargeLosses = [...largeLosses].sort((a, b) => a.pnl - b.pnl); // 按亏损从大到小排序
    const totalLargeLoss = sortedLargeLosses.reduce((sum, t) => sum + (t.pnl || 0), 0);
    problems.push({
      type: '大额亏损',
      severity: 'high',
      description: `发现 ${largeLosses.length} 笔大额亏损交易（单笔亏损 > $200），共亏损 $${Math.abs(totalLargeLoss).toFixed(2)}`,
      recommendation: '检查止损设置是否合理。建议设置更严格的止损规则，避免单笔亏损过大。',
      trades: sortedLargeLosses.slice(0, 10).map(t => ({
        id: t.id,
        symbol: t.symbol,
        instrumentCode: t.instrumentCode,
        direction: t.direction,
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: t.pnl,
        ticks: t.ticks,
        marketSession: t.marketSession,
        holdingSeconds: getHoldingSeconds(t),
        notes: t.notes || '',
        logicAnalysis: t.logicAnalysis || '',
        expectedTrend: t.expectedTrend || '',
      })),
      totalLoss: Number(totalLargeLoss.toFixed(2)),
    });
  }

  // 3. 持仓时间过长（超过2小时的亏损交易）
  const longHoldingLossTrades = validTrades.filter(t => {
    if (t.pnl >= 0) return false; // 只关注亏损交易
    let seconds = getHoldingSeconds(t);
    return seconds > 7200; // 2小时 = 7200秒
  });
  if (longHoldingLossTrades.length > 0) {
    const sortedLongHolding = [...longHoldingLossTrades].sort((a, b) => getHoldingSeconds(b) - getHoldingSeconds(a));
    const totalLoss = sortedLongHolding.reduce((sum, t) => sum + (t.pnl || 0), 0);
    problems.push({
      type: '长时间持仓亏损',
      severity: 'medium',
      description: `${longHoldingLossTrades.length} 笔亏损交易持仓超过2小时，共亏损 $${Math.abs(totalLoss).toFixed(2)}`,
      recommendation: '长时间持有亏损头寸会增加风险。建议设置最大持仓时间限制，及时止损。',
      trades: sortedLongHolding.slice(0, 10).map(t => ({
        id: t.id,
        symbol: t.symbol,
        instrumentCode: t.instrumentCode,
        direction: t.direction,
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: t.pnl,
        ticks: t.ticks,
        marketSession: t.marketSession,
        holdingSeconds: getHoldingSeconds(t),
        notes: t.notes || '',
        logicAnalysis: t.logicAnalysis || '',
        expectedTrend: t.expectedTrend || '',
      })),
      totalLoss: Number(totalLoss.toFixed(2)),
    });
  }

  // 4. 快速亏损（持仓时间短但亏损大，可能是追涨杀跌）
  const quickLossTrades = validTrades.filter(t => {
    if (t.pnl >= 0) return false;
    let seconds = getHoldingSeconds(t);
    // 持仓时间小于1分钟但亏损超过$50
    return seconds > 0 && seconds < 60 && t.pnl < -50;
  });
  if (quickLossTrades.length >= 3) {
    const sortedQuickLoss = [...quickLossTrades].sort((a, b) => a.pnl - b.pnl);
    const totalLoss = sortedQuickLoss.reduce((sum, t) => sum + (t.pnl || 0), 0);
    problems.push({
      type: '快速止损频繁',
      severity: 'medium',
      description: `${quickLossTrades.length} 笔交易在1分钟内止损，共亏损 $${Math.abs(totalLoss).toFixed(2)}`,
      recommendation: '频繁快速止损可能表明入场时机不当或追涨杀跌。建议：1) 优化入场时机；2) 等待更好的入场信号；3) 避免在剧烈波动中追单。',
      trades: sortedQuickLoss.slice(0, 10).map(t => ({
        id: t.id,
        symbol: t.symbol,
        instrumentCode: t.instrumentCode,
        direction: t.direction,
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: t.pnl,
        ticks: t.ticks,
        marketSession: t.marketSession,
        holdingSeconds: getHoldingSeconds(t),
        notes: t.notes || '',
        logicAnalysis: t.logicAnalysis || '',
        expectedTrend: t.expectedTrend || '',
      })),
      totalLoss: Number(totalLoss.toFixed(2)),
    });
  }

  // 5. 逆势交易（在特定时段反向操作亏损较多）
  const sessionLosses = {};
  validTrades.forEach(t => {
    if (t.pnl < 0) {
      const session = t.marketSession || '未知';
      if (!sessionLosses[session]) {
        sessionLosses[session] = { trades: [], totalLoss: 0 };
      }
      sessionLosses[session].trades.push(t);
      sessionLosses[session].totalLoss += t.pnl;
    }
  });
  
  // 找出亏损最多的时段
  const worstSession = Object.entries(sessionLosses)
    .filter(([_, data]) => data.trades.length >= 5)
    .sort((a, b) => a[1].totalLoss - b[1].totalLoss)[0];
  
  if (worstSession && worstSession[1].totalLoss < -500) {
    const [sessionName, sessionData] = worstSession;
    const sortedTrades = [...sessionData.trades].sort((a, b) => a.pnl - b.pnl);
    problems.push({
      type: '时段表现不佳',
      severity: 'medium',
      description: `在 ${sessionName} 时段亏损 ${sessionData.trades.length} 笔，共亏损 $${Math.abs(sessionData.totalLoss).toFixed(2)}`,
      recommendation: `建议减少在 ${sessionName} 时段的交易，或调整该时段的交易策略。`,
      trades: sortedTrades.slice(0, 10).map(t => ({
        id: t.id,
        symbol: t.symbol,
        instrumentCode: t.instrumentCode,
        direction: t.direction,
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: t.pnl,
        ticks: t.ticks,
        marketSession: t.marketSession,
        holdingSeconds: getHoldingSeconds(t),
        notes: t.notes || '',
        logicAnalysis: t.logicAnalysis || '',
        expectedTrend: t.expectedTrend || '',
      })),
      totalLoss: Number(sessionData.totalLoss.toFixed(2)),
      session: sessionName,
    });
  }

  // 6. 胜率过低
  const winRate = validTrades.filter(t => t.pnl > 0).length / validTrades.length;
  if (winRate < 0.4 && validTrades.length >= 20) {
    // 找出亏损最多的几笔交易
    const worstTrades = [...validTrades].filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 10);
    problems.push({
      type: '胜率过低',
      severity: 'high',
      description: `当前胜率仅 ${(winRate * 100).toFixed(1)}%，低于40%`,
      recommendation: '胜率过低可能表明入场时机选择不当。建议：1) 优化入场信号；2) 提高入场标准；3) 考虑使用更严格的筛选条件。',
      trades: worstTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        instrumentCode: t.instrumentCode,
        direction: t.direction,
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: t.pnl,
        ticks: t.ticks,
        marketSession: t.marketSession,
        holdingSeconds: getHoldingSeconds(t),
        notes: t.notes || '',
        logicAnalysis: t.logicAnalysis || '',
        expectedTrend: t.expectedTrend || '',
      })),
      winRateValue: Number((winRate * 100).toFixed(1)),
    });
  }

  // 7. 盈亏比失衡
  const profits = validTrades.filter(t => t.pnl > 0).map(t => t.pnl);
  const losses = validTrades.filter(t => t.pnl < 0).map(t => Math.abs(t.pnl));
  const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const profitLossRatio = avgLoss > 0 ? avgProfit / avgLoss : 0;

  if (profitLossRatio < 1.2 && validTrades.length >= 20) {
    // 找出盈亏比最差的交易（盈利很小或亏损很大）
    const poorRatioTrades = validTrades.filter(t => t.pnl < -avgLoss * 1.5).sort((a, b) => a.pnl - b.pnl).slice(0, 10);
    problems.push({
      type: '盈亏比失衡',
      severity: 'medium',
      description: `平均盈亏比 ${profitLossRatio.toFixed(2)}，低于理想值1.5`,
      recommendation: '建议提高止盈目标或降低止损设置，使盈亏比达到1.5以上。同时确保胜率与盈亏比平衡。',
      trades: poorRatioTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        instrumentCode: t.instrumentCode,
        direction: t.direction,
        openTime: t.openTime,
        closeTime: t.closeTime,
        pnl: t.pnl,
        ticks: t.ticks,
        marketSession: t.marketSession,
        holdingSeconds: getHoldingSeconds(t),
        notes: t.notes || '',
        logicAnalysis: t.logicAnalysis || '',
        expectedTrend: t.expectedTrend || '',
      })),
      ratioValue: Number(profitLossRatio.toFixed(2)),
      avgProfit: Number(avgProfit.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
    });
  }

  return problems;
};

/**
 * 生成优化策略建议
 */
const generateOptimizationStrategies = (trades, patterns) => {
  if (!trades || trades.length === 0 || !patterns) return [];

  const validTrades = trades.filter(t => t.pnl !== undefined && t.pnl !== null);
  const strategies = [];

  // 1. 时段优化建议
  const bestSession = patterns.sessionPerformance
    .sort((a, b) => b.totalPnL - a.totalPnL)[0];
  const worstSession = patterns.sessionPerformance
    .sort((a, b) => a.totalPnL - b.totalPnL)[0];

  if (bestSession && worstSession && bestSession.totalPnL > 0) {
    strategies.push({
      category: '时段优化',
      priority: 'high',
      title: `重点关注 ${bestSession.session} 时段`,
      description: `您在 ${bestSession.session} 时段表现最佳，胜率 ${bestSession.winRate}%，总盈亏 $${bestSession.totalPnL}`,
      action: `建议在 ${bestSession.session} 时段增加交易频率，在 ${worstSession.session} 时段减少或避免交易。`,
      expectedImprovement: `预计可提升整体胜率 ${((bestSession.winRate - worstSession.winRate) / 2).toFixed(1)}%`,
    });
  }

  // 2. 品种优化建议
  const bestInstrument = patterns.instrumentPerformance
    .sort((a, b) => b.totalPnL - a.totalPnL)[0];
  const worstInstrument = patterns.instrumentPerformance
    .sort((a, b) => a.totalPnL - b.totalPnL)[0];

  if (bestInstrument && worstInstrument && patterns.instrumentPerformance.length > 1) {
    if (bestInstrument.totalPnL > worstInstrument.totalPnL * 2) {
      strategies.push({
        category: '品种优化',
        priority: 'medium',
        title: `专注优势品种 ${bestInstrument.instrument}`,
        description: `${bestInstrument.instrument} 表现明显优于其他品种，胜率 ${bestInstrument.winRate}%`,
        action: `建议将更多精力投入到 ${bestInstrument.instrument} 的交易中，减少在 ${worstInstrument.instrument} 上的交易。`,
        expectedImprovement: '预计可提升整体盈利能力',
      });
    }
  }

  // 3. 方向优化建议
  const longPerf = patterns.directionPerformance.LONG;
  const shortPerf = patterns.directionPerformance.SHORT;

  if (longPerf.totalTrades > 10 && shortPerf.totalTrades > 10) {
    const longWinRate = longPerf.winRate;
    const shortWinRate = shortPerf.winRate;
    const diff = Math.abs(longWinRate - shortWinRate);

    if (diff > 10) {
      const better = longWinRate > shortWinRate ? '多头' : '空头';
      strategies.push({
        category: '方向优化',
        priority: 'medium',
        title: `${better}交易表现更优`,
        description: `${better}交易胜率 ${Math.max(longWinRate, shortWinRate).toFixed(1)}%，明显高于${longWinRate > shortWinRate ? '空头' : '多头'}的 ${Math.min(longWinRate, shortWinRate).toFixed(1)}%`,
        action: `建议在策略中增加${better}交易的权重，或专注于${better}交易。`,
        expectedImprovement: `预计可提升整体胜率 ${(diff / 2).toFixed(1)}%`,
      });
    }
  }

  // 4. 风险管理建议
  const stats = validTrades.reduce((acc, t) => {
    acc.totalPnL += t.pnl || 0;
    if (t.pnl > 0) acc.wins++;
    if (t.pnl < 0) acc.losses++;
    if (t.pnl > acc.maxProfit) acc.maxProfit = t.pnl;
    if (t.pnl < acc.maxLoss) acc.maxLoss = t.pnl;
    return acc;
  }, { totalPnL: 0, wins: 0, losses: 0, maxProfit: 0, maxLoss: 0 });

  const maxLossRatio = Math.abs(stats.maxLoss) / Math.abs(stats.totalPnL);
  if (maxLossRatio > 0.3 && validTrades.length >= 20) {
    strategies.push({
      category: '风险管理',
      priority: 'high',
      title: '优化止损设置',
      description: `单笔最大亏损占总盈亏的 ${(maxLossRatio * 100).toFixed(1)}%，风险过大`,
      action: '建议设置更严格的止损规则，单笔亏损不应超过账户资金的2-3%。',
      expectedImprovement: '可有效控制回撤，保护账户资金',
    });
  }

  // 5. 交易频率建议
  const avgDailyTrades = validTrades.length / 30; // 假设30天
  if (avgDailyTrades > 10) {
    strategies.push({
      category: '交易频率',
      priority: 'low',
      title: '控制交易频率',
      description: `平均每日交易 ${avgDailyTrades.toFixed(1)} 笔，可能过于频繁`,
      action: '建议提高交易标准，只选择高质量的交易机会，避免过度交易。',
      expectedImprovement: '可提高单笔交易质量，减少交易成本',
    });
  } else if (avgDailyTrades < 2 && validTrades.length >= 20) {
    strategies.push({
      category: '交易频率',
      priority: 'low',
      title: '适当增加交易频率',
      description: `平均每日交易 ${avgDailyTrades.toFixed(1)} 笔，可能过于保守`,
      action: '在保持交易质量的前提下，可以适当增加交易频率，提高资金利用率。',
      expectedImprovement: '可提高整体收益潜力',
    });
  }

  return strategies;
};

/**
 * 生成持仓分析报告
 */
const generateHoldingReport = (holdingAnalysis, streaks, riskMetrics) => {
  if (!holdingAnalysis?.hasData) return null;

  const report = {
    title: '持仓分析报告',
    sections: [],
  };

  // 持仓时间概览
  report.sections.push({
    title: '持仓时间概览',
    type: 'summary',
    data: {
      '平均持仓时间': holdingAnalysis.summary.avgHoldingFormatted,
      '中位持仓时间': holdingAnalysis.summary.medianHoldingFormatted,
      '最长持仓时间': holdingAnalysis.summary.maxHoldingFormatted,
      '最短持仓时间': holdingAnalysis.summary.minHoldingFormatted,
    },
  });

  // 盈亏持仓对比
  const comparison = holdingAnalysis.comparison;
  report.sections.push({
    title: '盈利与亏损交易持仓对比',
    type: 'comparison',
    data: {
      '盈利交易平均持仓': comparison.avgWinHoldingFormatted,
      '亏损交易平均持仓': comparison.avgLossHoldingFormatted,
      '差异': `${comparison.winningHoldsLonger ? '盈利交易' : '亏损交易'}持仓时间更长 (${comparison.differenceFormatted})`,
    },
    insight: comparison.winningHoldsLonger 
      ? '您的盈利交易持仓时间较长，说明您善于让盈利奔跑。' 
      : '您的亏损交易持仓时间较长，建议设置更严格的止损规则，避免持有亏损头寸过久。',
  });

  // 最优持仓区间
  if (holdingAnalysis.optimalRange) {
    report.sections.push({
      title: '最优持仓时间区间',
      type: 'highlight',
      data: {
        '最佳区间': holdingAnalysis.optimalRange.label,
        '交易笔数': `${holdingAnalysis.optimalRange.count} 笔`,
        '平均盈亏': `$${holdingAnalysis.optimalRange.avgPnL}`,
        '胜率': `${holdingAnalysis.optimalRange.winRate}%`,
      },
      recommendation: `建议将持仓时间控制在 ${holdingAnalysis.optimalRange.label} 范围内，这是您表现最佳的持仓区间。`,
    });
  }

  // 持仓时间分布
  report.sections.push({
    title: '持仓时间分布',
    type: 'distribution',
    data: holdingAnalysis.distribution,
  });

  // 连续交易分析
  if (streaks) {
    report.sections.push({
      title: '连续交易分析',
      type: 'streaks',
      data: {
        '最长连续盈利': `${streaks.maxWinStreak} 笔，共盈利 $${streaks.maxWinStreakPnL}`,
        '最长连续亏损': `${streaks.maxLossStreak} 笔，共亏损 $${Math.abs(streaks.maxLossStreakPnL)}`,
        '亏损后交易胜率': `${streaks.afterLoss.winRate}% (${streaks.afterLoss.count} 笔)`,
        '盈利后交易胜率': `${streaks.afterWin.winRate}% (${streaks.afterWin.count} 笔)`,
      },
      insight: streaks.afterLoss.winRate < streaks.afterWin.winRate
        ? '亏损后继续交易的胜率较低，建议在连续亏损后暂停交易，调整心态后再继续。'
        : '您在亏损后的交易表现较好，说明心态调整能力较强。',
    });
  }

  // 风险指标
  if (riskMetrics) {
    report.sections.push({
      title: '风险收益指标',
      type: 'metrics',
      data: {
        '期望值': `$${riskMetrics.expectancy}`,
        '盈亏比': riskMetrics.profitLossRatio.toFixed(2),
        '利润系数': riskMetrics.profitFactor.toFixed(2),
        '夏普比率': riskMetrics.sharpeRatio.toFixed(2),
        '波动率(标准差)': `$${riskMetrics.standardDeviation}`,
      },
    });
  }

  return report;
};

/**
 * 生成AI分析报告
 */
export const generateAIAnalysis = async (filters = {}) => {
  try {
    let allTrades = await StorageService.getAllTrades();
    
    // 按交易记录筛选
    if (filters.activeRecordId && filters.activeRecordId !== 'all') {
      allTrades = allTrades.filter(t => t.recordId === filters.activeRecordId);
    }
    
    // 应用筛选
    if (filters.instrument && filters.instrument !== 'ALL') {
      allTrades = allTrades.filter(t => t.instrumentCode === filters.instrument);
    }
    
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const start = filters.dateRange[0].startOf('day').toDate();
      const end = filters.dateRange[1].endOf('day').toDate();
      allTrades = allTrades.filter(t => {
        const tradeDate = new Date(t.openTime);
        return tradeDate >= start && tradeDate <= end;
      });
    }

    // 按时间排序
    allTrades.sort((a, b) => new Date(a.openTime) - new Date(b.openTime));

    if (allTrades.length === 0) {
      return {
        success: false,
        message: '没有可分析的交易数据',
      };
    }

    // 计算基础统计
    const stats = await StorageService.calculateStats(allTrades);

    // 分析交易模式
    const patterns = analyzeTradingPatterns(allTrades);

    // 识别问题
    const problems = identifyProblemTrades(allTrades);

    // 生成优化策略
    const strategies = generateOptimizationStrategies(allTrades, patterns);

    // === 新增多维度分析 ===
    
    // 持仓时间分析
    const holdingAnalysis = analyzeHoldingTime(allTrades);
    
    // 日内小时分析
    const hourlyAnalysis = analyzeHourlyPerformance(allTrades);
    
    // 连续交易分析
    const streaksAnalysis = analyzeStreaks(allTrades);
    
    // 资金曲线分析
    const equityAnalysis = analyzeEquityCurve(allTrades);
    
    // 风险指标分析
    const riskAnalysis = analyzeRiskMetrics(allTrades);
    
    // 交易频率分析
    const frequencyAnalysis = analyzeTradeFrequency(allTrades);

    // 生成持仓报告
    const holdingReport = generateHoldingReport(holdingAnalysis, streaksAnalysis, riskAnalysis);

    // 生成总结
    const summary = {
      totalTrades: stats.totalTrades,
      totalPnL: stats.totalPnL,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor,
      maxDrawdown: stats.maxDrawdown,
      overallRating: calculateOverallRating(stats, problems),
    };

    return {
      success: true,
      summary,
      patterns,
      problems,
      strategies,
      // 新增分析维度
      holdingAnalysis,
      hourlyAnalysis,
      streaksAnalysis,
      equityAnalysis,
      riskAnalysis,
      frequencyAnalysis,
      holdingReport,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('AI分析失败:', error);
    return {
      success: false,
      message: `分析失败: ${error.message}`,
    };
  }
};

/**
 * 计算整体评级
 */
const calculateOverallRating = (stats, problems) => {
  let score = 100;

  // 胜率评分 (30分)
  if (stats.winRate >= 60) score += 30;
  else if (stats.winRate >= 50) score += 20;
  else if (stats.winRate >= 40) score += 10;
  else score -= 20;

  // 利润系数评分 (30分)
  if (stats.profitFactor >= 2) score += 30;
  else if (stats.profitFactor >= 1.5) score += 20;
  else if (stats.profitFactor >= 1.2) score += 10;
  else score -= 10;

  // 总盈亏评分 (20分)
  if (stats.totalPnL > 0) {
    score += 20;
  } else {
    score -= 30;
  }

  // 问题扣分 (20分)
  const highSeverityProblems = problems.filter(p => p.severity === 'high').length;
  const mediumSeverityProblems = problems.filter(p => p.severity === 'medium').length;
  score -= highSeverityProblems * 10;
  score -= mediumSeverityProblems * 5;

  // 确定等级
  if (score >= 90) return { level: '优秀', score, color: 'green' };
  if (score >= 75) return { level: '良好', score, color: 'blue' };
  if (score >= 60) return { level: '一般', score, color: 'orange' };
  if (score >= 40) return { level: '需改进', score, color: 'red' };
  return { level: '风险较高', score, color: 'red' };
};

export default {
  generateAIAnalysis,
  analyzeTradingPatterns,
  identifyProblemTrades,
  generateOptimizationStrategies,
  analyzeHoldingTime,
  analyzeHourlyPerformance,
  analyzeStreaks,
  analyzeEquityCurve,
  analyzeRiskMetrics,
  analyzeTradeFrequency,
};

