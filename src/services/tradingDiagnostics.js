/**
 * 交易诊断与决策支持系统
 * Trading Diagnostics & Decision Support System
 * 
 * 包含：
 * 1. 策略优化算法 (Strategy Tuning)
 * 2. 交易行为归因 (Behavioral Fingerprinting)
 * 3. 统计学分析 (Advanced Statistics)
 */

// ============================================================================
// 一、基础工具函数
// ============================================================================

/**
 * 获取品种的 tick 价值
 */
const TICK_VALUES = {
  'GC': 10, 'ES': 12.5, 'NQ': 5, 'RTY': 5, 'CL': 10, 'SI': 25, 'YM': 5,
  'ZB': 31.25, 'ZN': 15.625, '6E': 12.5, 'M2K': 0.5, 'MES': 1.25, 'MNQ': 0.5, 'MGC': 1,
};

const getTickValue = (instrumentCode, instruments = []) => {
  const instrument = instruments.find(i => i.code === instrumentCode);
  if (instrument?.tickValue) return instrument.tickValue;
  return TICK_VALUES[instrumentCode] || 5;
};

const ticksToUSD = (ticks, instrumentCode, quantity, instruments = []) => {
  if (ticks === undefined || ticks === null) return null;
  const tickValue = getTickValue(instrumentCode, instruments);
  return ticks * tickValue * Math.abs(quantity || 1);
};

/**
 * 计算两个时间之间的分钟差
 */
const getMinutesDiff = (time1, time2) => {
  const d1 = new Date(time1);
  const d2 = new Date(time2);
  return Math.abs(d1 - d2) / (1000 * 60);
};

// ============================================================================
// 二、策略优化算法 (Strategy Tuning)
// ============================================================================

/**
 * 2.1 最优止损位预测
 * 通过回溯所有历史订单的 MAE 表现，计算不同止损位对总盈亏的影响
 * 
 * 核心逻辑：
 * - 将所有 MAE 和 PnL 标准化到【每手/每张合约】，消除仓位大小的干扰
 * - 如果 MAE/手 >= 止损位，交易会被止损出局
 * - 最终结果再乘以各交易的实际仓位计算总盈亏
 * 
 * @param {Array} trades - 交易数组
 * @param {Array} instruments - 品种配置
 * @param {Array} stopLossLevels - 止损水平数组（美元/手）
 * @returns {Object} 最优止损分析结果
 */
export const calculateOptimalStopLoss = (trades, instruments = [], stopLossLevels = null) => {
  // 过滤有效交易（有 MAE 数据的）
  const validTrades = trades.filter(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    return mae !== undefined && mae !== null;
  });

  if (validTrades.length === 0) {
    return { hasData: false, message: '没有足够的 MAE 数据进行分析' };
  }

  // 计算每笔交易的数据（标准化到每手）
  const tradesWithMAE = validTrades.map(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    const quantity = Math.abs(t.openQuantity || 1);
    const tickValue = getTickValue(t.instrumentCode, instruments);
    
    // MAE 和 PnL 标准化到每手
    const maeUSDTotal = Math.abs(mae * tickValue * quantity);  // 总 MAE（美元）
    const maeUSDPerContract = Math.abs(mae * tickValue);       // 每手 MAE（美元）
    const pnlPerContract = (t.pnl || 0) / quantity;            // 每手盈亏
    
    return { 
      ...t, 
      quantity,
      tickValue,
      maeUSDTotal,           // 总 MAE（用于显示）
      maeUSDPerContract,     // 每手 MAE（用于计算）
      pnlPerContract,        // 每手盈亏
      originalPnL: t.pnl || 0 
    };
  });

  // 基于每手 MAE 分布自动生成止损水平
  if (!stopLossLevels) {
    const allMAEsPerContract = tradesWithMAE.map(t => t.maeUSDPerContract).sort((a, b) => a - b);
    const maxMAE = Math.max(...allMAEsPerContract);
    const minMAE = Math.min(...allMAEsPerContract);
    const medianMAE = allMAEsPerContract[Math.floor(allMAEsPerContract.length / 2)] || maxMAE / 2;
    
    // 从很低的水平开始测试，一直到超过最大 MAE
    // 这样才能找到真正的最优止损点
    const step = Math.max(10, Math.round(medianMAE / 5 / 5) * 5);  // 步长：中位数的1/5，最少$10，$5的倍数
    
    // 起点：从 step 或 minMAE 的 30% 开始（取较小值），确保能测试到紧止损的效果
    const startLevel = Math.max(step, Math.round(Math.min(minMAE * 0.3, step) / 5) * 5) || step;
    
    stopLossLevels = [];
    // 测试从紧止损到宽止损的整个范围
    for (let i = startLevel; stopLossLevels.length < 15; i += step) {
      stopLossLevels.push(i);
      // 如果已经超过最大 MAE，再多加 2 个点就停止
      if (i > maxMAE && stopLossLevels.length >= 8) break;
    }
    
    // 确保覆盖关键分位点
    const p50 = allMAEsPerContract[Math.floor(allMAEsPerContract.length * 0.50)] || medianMAE;
    const p75 = allMAEsPerContract[Math.floor(allMAEsPerContract.length * 0.75)] || maxMAE * 0.75;
    const p90 = allMAEsPerContract[Math.floor(allMAEsPerContract.length * 0.90)] || maxMAE * 0.9;
    
    // 添加分位点（如果不在列表中）
    [p50, p75, p90, maxMAE].forEach(val => {
      const rounded = Math.round(val / 5) * 5;
      if (rounded > 0 && !stopLossLevels.includes(rounded)) {
        stopLossLevels.push(rounded);
      }
    });
    
    // 排序并去重
    stopLossLevels = [...new Set(stopLossLevels)].sort((a, b) => a - b);
    
    // 最多保留 15 个
    if (stopLossLevels.length > 15) {
      // 均匀采样
      const indices = Array.from({ length: 15 }, (_, i) => Math.floor(i * (stopLossLevels.length - 1) / 14));
      stopLossLevels = indices.map(i => stopLossLevels[i]);
    }
  }

  // 统计原始数据
  const originalWins = tradesWithMAE.filter(t => t.originalPnL > 0);
  const originalLosses = tradesWithMAE.filter(t => t.originalPnL < 0);
  const originalWinRate = (originalWins.length / tradesWithMAE.length * 100);

  // 对每个止损水平（每手）计算假设盈亏
  const results = stopLossLevels.map(stopLevelPerContract => {
    let totalPnL = 0;
    let stoppedCount = 0;
    let lostWins = 0;           // 因止损而丢失的盈利单
    let savedLosses = 0;        // 因止损而减少亏损的单数
    let savedAmount = 0;        // 止损减少的亏损金额

    tradesWithMAE.forEach(t => {
      // 使用每手 MAE 与每手止损位比较
      if (t.maeUSDPerContract >= stopLevelPerContract) {
        // 每手 MAE 超过止损水平，交易会被止损出局
        // 实际止损金额 = 每手止损 × 仓位
        const stoppedLoss = stopLevelPerContract * t.quantity;
        totalPnL -= stoppedLoss;
        stoppedCount++;
        
        if (t.originalPnL > 0) {
          // 原本是盈利单，被止损变成亏损单
          lostWins++;
        } else if (t.originalPnL < 0) {
          // 原本是亏损单，检查止损是否减少了亏损
          const originalLoss = Math.abs(t.originalPnL);
          if (originalLoss > stoppedLoss) {
            savedLosses++;
            savedAmount += (originalLoss - stoppedLoss);
          }
        }
      } else {
        // 每手 MAE 未达到止损位，交易正常结束
        totalPnL += t.originalPnL;
      }
    });

    // 计算新的胜率（未被止损的盈利单 / 总交易数）
    const remainingWins = originalWins.filter(t => t.maeUSDPerContract < stopLevelPerContract).length;
    const newWinRate = (remainingWins / tradesWithMAE.length * 100);

    return {
      stopLevel: stopLevelPerContract,  // 每手止损（美元）
      totalPnL: Number(totalPnL.toFixed(2)),
      stoppedCount,
      stoppedRate: Number((stoppedCount / tradesWithMAE.length * 100).toFixed(1)),
      lostWins,           // 因止损丢失的盈利单数量
      savedLosses,        // 因止损减少亏损的单数
      savedAmount: Number(savedAmount.toFixed(2)),  // 减少的亏损金额
      newWinRate: Number(newWinRate.toFixed(1)),    // 新胜率
    };
  });

  // 找出最优止损位（总盈亏最高的）
  const optimal = results.reduce((best, curr) => 
    curr.totalPnL > best.totalPnL ? curr : best
  , results[0]);

  // 计算当前实际总盈亏
  const actualTotalPnL = tradesWithMAE.reduce((sum, t) => sum + t.originalPnL, 0);

  // 计算改善幅度
  const improvement = optimal.totalPnL - actualTotalPnL;
  const improvementPercent = actualTotalPnL !== 0 
    ? (improvement / Math.abs(actualTotalPnL) * 100)
    : (improvement > 0 ? 100 : 0);

  // 计算平均仓位
  const avgQuantity = tradesWithMAE.reduce((sum, t) => sum + t.quantity, 0) / tradesWithMAE.length;
  
  // 计算每手 MAE 分布统计（这才是正确的参考值）
  const allMAEsPerContract = tradesWithMAE.map(t => t.maeUSDPerContract).sort((a, b) => a - b);
  const medianMAE = allMAEsPerContract[Math.floor(allMAEsPerContract.length / 2)] || 0;
  const avgMAE = allMAEsPerContract.reduce((a, b) => a + b, 0) / allMAEsPerContract.length;
  const percentile75 = allMAEsPerContract[Math.floor(allMAEsPerContract.length * 0.75)] || 0;
  const percentile90 = allMAEsPerContract[Math.floor(allMAEsPerContract.length * 0.9)] || 0;
  const maxMAE = Math.max(...allMAEsPerContract);

  // 检查最优止损位是否是"不设止损"（stoppedCount === 0）
  const isNoStopOptimal = optimal.stoppedCount === 0;
  
  // 找出有实际止损效果的最优止损位（用于对比）
  const activeResults = results.filter(r => r.stoppedCount > 0);
  const bestActiveStopLoss = activeResults.length > 0 
    ? activeResults.reduce((best, curr) => curr.totalPnL > best.totalPnL ? curr : best, activeResults[0])
    : null;
  
  // 生成建议（更详细易懂）
  let recommendation;
  let recommendationDetail;
  
  if (isNoStopOptimal) {
    // 最优策略是不设固定止损
    recommendation = '当前策略已最优';
    if (bestActiveStopLoss) {
      const diff = actualTotalPnL - bestActiveStopLoss.totalPnL;
      recommendationDetail = `历史回测显示，您现有的止损/离场策略已经是最优的。如果设置每手 $${bestActiveStopLoss.stopLevel} 的固定止损，反而会损失 $${diff.toFixed(0)}。建议继续保持当前灵活的风控策略。`;
    } else {
      recommendationDetail = '历史数据显示，设置固定止损会降低总收益，建议继续保持当前灵活的风控策略。';
    }
  } else if (improvement > 10) {  // 至少改善 $10 才建议调整
    recommendation = `建议每手止损: $${optimal.stopLevel}`;
    recommendationDetail = `基于历史回测，如果每手（每张合约）止损不超过 $${optimal.stopLevel}，总收益可提升 $${improvement.toFixed(0)} (${improvementPercent.toFixed(1)}%)。例如：交易 ${Math.round(avgQuantity)} 手时，最大亏损限额为 $${(optimal.stopLevel * avgQuantity).toFixed(0)}。`;
  } else if (improvement < -10) {
    recommendation = '当前策略在回测中表现更优';
    recommendationDetail = `历史数据显示，设置固定止损反而会降低总收益约 $${Math.abs(improvement).toFixed(0)}，建议根据市场情况灵活止损。`;
  } else {
    recommendation = '当前止损策略已较优';
    recommendationDetail = `回测显示改善空间较小（$${Math.abs(improvement).toFixed(0)}），无需特别调整。可参考 MAE 中位数 $${medianMAE.toFixed(0)} 作为风控参考。`;
  }

  return {
    hasData: true,
    tradeCount: tradesWithMAE.length,
    originalWinCount: originalWins.length,
    originalLossCount: originalLosses.length,
    originalWinRate: Number(originalWinRate.toFixed(1)),
    actualTotalPnL: Number(actualTotalPnL.toFixed(2)),
    // 每手 MAE 分布统计（消除仓位干扰）
    maeStats: {
      avg: Number(avgMAE.toFixed(2)),
      median: Number(medianMAE.toFixed(2)),
      percentile75: Number(percentile75.toFixed(2)),
      percentile90: Number(percentile90.toFixed(2)),
      max: Number(maxMAE.toFixed(2)),
    },
    avgQuantity: Number(avgQuantity.toFixed(1)),
    results,
    optimal: {
      ...optimal,
      // 最优止损位（每手）已经在 stopLevel 中
      // 如果需要多手止损示例
      forAvgPosition: Number((optimal.stopLevel * avgQuantity).toFixed(2)),
    },
    improvement: Number(improvement.toFixed(2)),
    improvementPercent: Number(improvementPercent.toFixed(1)),
    recommendation,
    recommendationDetail,
  };
};

/**
 * 2.2 保本损模拟 (Break-even Simulation)
 * 模拟"当盈利触及 MFE 的 X% 时将止损移至成本价"策略的效果
 * 
 * @param {Array} trades - 交易数组
 * @param {Array} instruments - 品种配置
 * @param {number} triggerPercent - 触发保本的 MFE 百分比（默认 50%）
 */
export const simulateBreakEven = (trades, instruments = [], triggerPercent = 50) => {
  const validTrades = trades.filter(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    const mfe = t.mfe ?? t.jigsawData?.mfe;
    return mae !== undefined && mfe !== undefined;
  });

  if (validTrades.length === 0) {
    return { hasData: false, message: '没有足够的 MAE/MFE 数据进行分析' };
  }

  let originalTotalPnL = 0;
  let simulatedTotalPnL = 0;
  let protectedCount = 0; // 被保本保护的交易数
  let missedProfitTotal = 0; // 因保本而错过的利润

  const tradeDetails = validTrades.map(t => {
    const mfe = t.mfe ?? t.jigsawData?.mfe;
    const mfeUSD = ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments) || 0;
    const triggerLevel = mfeUSD * (triggerPercent / 100);

    originalTotalPnL += t.pnl;

    let simulatedPnL = t.pnl;
    let wasProtected = false;
    let missedProfit = 0;

    // 判断是否触发保本
    if (mfeUSD >= triggerLevel && triggerLevel > 0) {
      // 曾经触及保本触发点
      if (t.pnl < 0) {
        // 原本亏损，保本策略会在成本价出局
        simulatedPnL = 0;
        wasProtected = true;
        protectedCount++;
      } else if (t.pnl < triggerLevel) {
        // 盈利但低于触发点，保本策略可能导致在成本价出局
        // 假设在MFE后回撤到触发点以下时保本生效
        simulatedPnL = 0;
        missedProfit = t.pnl;
        missedProfitTotal += t.pnl;
      }
    }

    simulatedTotalPnL += simulatedPnL;

    return {
      id: t.id,
      instrumentCode: t.instrumentCode,
      originalPnL: t.pnl,
      simulatedPnL,
      mfeUSD,
      triggerLevel,
      wasProtected,
      missedProfit,
    };
  });

  const improvement = simulatedTotalPnL - originalTotalPnL;

  return {
    hasData: true,
    triggerPercent,
    tradeCount: validTrades.length,
    originalTotalPnL: Number(originalTotalPnL.toFixed(2)),
    simulatedTotalPnL: Number(simulatedTotalPnL.toFixed(2)),
    improvement: Number(improvement.toFixed(2)),
    improvementPercent: originalTotalPnL !== 0
      ? ((improvement / Math.abs(originalTotalPnL)) * 100).toFixed(1)
      : 0,
    protectedCount,
    protectedRate: ((protectedCount / validTrades.length) * 100).toFixed(1),
    missedProfitTotal: Number(missedProfitTotal.toFixed(2)),
    tradeDetails,
    recommendation: improvement > 0
      ? `保本策略可减少 ${protectedCount} 笔亏损，预计提升 $${improvement.toFixed(0)} 收益`
      : `保本策略可能导致过早离场，预计减少 $${Math.abs(improvement).toFixed(0)} 收益`,
  };
};

/**
 * 2.3 利润留存率分析
 * 计算 (MFE - max(0, PnL)) / MFE，识别"获利回吐"严重的单子
 */
export const analyzeProfitRetention = (trades, instruments = []) => {
  const validTrades = trades.filter(t => {
    const mfe = t.mfe ?? t.jigsawData?.mfe;
    return mfe !== undefined && mfe > 0;
  });

  if (validTrades.length === 0) {
    return { hasData: false, message: '没有足够的 MFE 数据进行分析' };
  }

  const analysis = validTrades.map(t => {
    const mfe = t.mfe ?? t.jigsawData?.mfe;
    const mfeUSD = ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments) || 0;
    const retentionRate = mfeUSD > 0 ? ((mfeUSD - Math.max(0, t.pnl)) / mfeUSD) * 100 : 0;
    const lostProfit = mfeUSD - Math.max(0, t.pnl);

    return {
      id: t.id,
      instrumentCode: t.instrumentCode,
      openTime: t.openTime,
      direction: t.direction,
      pnl: t.pnl,
      mfeUSD,
      retentionRate: Number(retentionRate.toFixed(1)),
      lostProfit: Number(lostProfit.toFixed(2)),
      severity: retentionRate > 80 ? 'critical' : retentionRate > 50 ? 'warning' : 'normal',
    };
  });

  // 按留存率排序，找出最严重的
  const sorted = [...analysis].sort((a, b) => b.retentionRate - a.retentionRate);
  const avgRetention = analysis.reduce((sum, a) => sum + a.retentionRate, 0) / analysis.length;
  const totalLostProfit = analysis.reduce((sum, a) => sum + a.lostProfit, 0);
  const criticalCount = analysis.filter(a => a.severity === 'critical').length;
  const warningCount = analysis.filter(a => a.severity === 'warning').length;

  return {
    hasData: true,
    tradeCount: validTrades.length,
    avgRetentionRate: Number(avgRetention.toFixed(1)),
    totalLostProfit: Number(totalLostProfit.toFixed(2)),
    criticalCount,
    warningCount,
    worstTrades: sorted.slice(0, 10),
    allTrades: analysis,
    recommendation: avgRetention > 50
      ? `平均留存率 ${avgRetention.toFixed(0)}%，建议优化止盈策略，考虑分批止盈或移动止盈`
      : `止盈执行良好，平均留存率 ${avgRetention.toFixed(0)}%`,
  };
};

// ============================================================================
// 三、交易行为归因 (Behavioral Fingerprinting)
// ============================================================================

/**
 * 3.1 报复性交易检测
 * 若与上一笔亏损单间隔 < 5 分钟，标记为"报复性交易"
 */
export const detectRevengeTrades = (trades, thresholdMinutes = 5) => {
  // 按时间排序
  const sorted = [...trades].sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
  const results = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const minutesDiff = getMinutesDiff(prev.closeTime || prev.openTime, curr.openTime);

    if (prev.pnl < 0 && minutesDiff < thresholdMinutes) {
      results.push({
        trade: curr,
        prevTrade: prev,
        minutesAfterLoss: Number(minutesDiff.toFixed(1)),
        prevLoss: prev.pnl,
        isRevenge: true,
      });
    }
  }

  const revengeTradesTotal = results.length;
  const revengeTradePnL = results.reduce((sum, r) => sum + r.trade.pnl, 0);
  const revengeWinRate = results.length > 0
    ? (results.filter(r => r.trade.pnl > 0).length / results.length * 100)
    : 0;

  return {
    hasData: trades.length > 1,
    totalTrades: trades.length,
    revengeTrades: results,
    revengeCount: revengeTradesTotal,
    revengeRate: ((revengeTradesTotal / trades.length) * 100).toFixed(1),
    revengeTradePnL: Number(revengeTradePnL.toFixed(2)),
    revengeWinRate: Number(revengeWinRate.toFixed(1)),
    recommendation: revengeTradesTotal > 0
      ? `检测到 ${revengeTradesTotal} 笔报复性交易，胜率仅 ${revengeWinRate.toFixed(0)}%，建议亏损后等待至少 5 分钟再入场`
      : '未检测到报复性交易，情绪管理良好',
  };
};

/**
 * 3.2 止损极点检测
 * 若 MAE 接近或等于实际亏损，说明割肉在最低点
 */
export const detectBadStopLoss = (trades, instruments = [], threshold = 0.1) => {
  const lossTrades = trades.filter(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    return t.pnl < 0 && mae !== undefined;
  });

  if (lossTrades.length === 0) {
    return { hasData: false, message: '没有足够的亏损交易数据' };
  }

  const results = lossTrades.map(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    const maeUSD = Math.abs(ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) || 0);
    const actualLoss = Math.abs(t.pnl);
    const diff = maeUSD - actualLoss;
    const diffRatio = actualLoss > 0 ? diff / actualLoss : 0;
    const isAtBottom = diffRatio <= threshold;

    return {
      trade: t,
      maeUSD,
      actualLoss,
      diff: Number(diff.toFixed(2)),
      diffRatio: Number(diffRatio.toFixed(2)),
      isAtBottom,
    };
  });

  const atBottomTrades = results.filter(r => r.isAtBottom);
  const atBottomRate = (atBottomTrades.length / lossTrades.length) * 100;

  return {
    hasData: true,
    totalLossTrades: lossTrades.length,
    atBottomTrades,
    atBottomCount: atBottomTrades.length,
    atBottomRate: Number(atBottomRate.toFixed(1)),
    recommendation: atBottomRate > 30
      ? `${atBottomRate.toFixed(0)}% 的亏损单在极点附近止损，建议设置更合理的止损位，避免被洗出`
      : '止损位置合理，较少在极点割肉',
  };
};

/**
 * 3.3 执行焦虑检测
 * 若 Fills 次数 > Quantity * 2，标记为"执行犹豫"
 */
export const detectExecutionAnxiety = (trades, multiplier = 2) => {
  const validTrades = trades.filter(t => {
    const fills = t.fills ?? t.jigsawData?.fills;
    return fills !== undefined && t.openQuantity;
  });

  if (validTrades.length === 0) {
    return { hasData: false, message: '没有足够的成交数据' };
  }

  const results = validTrades.map(t => {
    const fills = t.fills ?? t.jigsawData?.fills;
    const quantity = Math.abs(t.openQuantity || 1);
    const fillsRatio = fills / quantity;
    const isAnxious = fillsRatio > multiplier;

    return {
      trade: t,
      fills,
      quantity,
      fillsRatio: Number(fillsRatio.toFixed(2)),
      isAnxious,
    };
  });

  const anxiousTrades = results.filter(r => r.isAnxious);
  const anxiousRate = (anxiousTrades.length / validTrades.length) * 100;
  const anxiousPnL = anxiousTrades.reduce((sum, r) => sum + r.trade.pnl, 0);

  return {
    hasData: true,
    totalTrades: validTrades.length,
    anxiousTrades,
    anxiousCount: anxiousTrades.length,
    anxiousRate: Number(anxiousRate.toFixed(1)),
    anxiousPnL: Number(anxiousPnL.toFixed(2)),
    avgFillsRatio: Number((results.reduce((sum, r) => sum + r.fillsRatio, 0) / results.length).toFixed(2)),
    recommendation: anxiousRate > 20
      ? `${anxiousRate.toFixed(0)}% 的交易存在执行犹豫，这类交易净亏损 $${Math.abs(anxiousPnL).toFixed(0)}，建议提高入场信心`
      : '执行较为果断，继续保持',
  };
};

/**
 * 3.4 处置效应诊断
 * 统计并对比盈利单与亏损单的平均持仓时长
 */
export const analyzeDispositionEffect = (trades) => {
  const winTrades = trades.filter(t => t.pnl > 0 && t.holdingSeconds > 0);
  const lossTrades = trades.filter(t => t.pnl < 0 && t.holdingSeconds > 0);

  if (winTrades.length === 0 || lossTrades.length === 0) {
    return { hasData: false, message: '需要同时有盈利和亏损交易' };
  }

  const avgWinHolding = winTrades.reduce((sum, t) => sum + t.holdingSeconds, 0) / winTrades.length;
  const avgLossHolding = lossTrades.reduce((sum, t) => sum + t.holdingSeconds, 0) / lossTrades.length;
  const ratio = avgLossHolding / avgWinHolding;
  const hasDispositionEffect = ratio > 1.2; // 亏损持仓时间比盈利长 20% 以上

  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}秒`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
    return `${(seconds / 3600).toFixed(1)}小时`;
  };

  return {
    hasData: true,
    winTradeCount: winTrades.length,
    lossTradeCount: lossTrades.length,
    avgWinHoldingSeconds: Math.round(avgWinHolding),
    avgLossHoldingSeconds: Math.round(avgLossHolding),
    avgWinHoldingFormatted: formatTime(avgWinHolding),
    avgLossHoldingFormatted: formatTime(avgLossHolding),
    ratio: Number(ratio.toFixed(2)),
    hasDispositionEffect,
    severity: ratio > 2 ? 'critical' : ratio > 1.5 ? 'warning' : 'normal',
    recommendation: hasDispositionEffect
      ? `存在处置效应：亏损单平均持有 ${formatTime(avgLossHolding)}，盈利单仅 ${formatTime(avgWinHolding)}。建议设置固定止损，让利润奔跑`
      : '持仓时间分布合理，未发现明显处置效应',
  };
};

// ============================================================================
// 四、统计学看板 (Advanced Statistics)
// ============================================================================

/**
 * 4.1 期望值分布
 * 按"时段"和"方向"计算期望值
 * 期望值 = 胜率 × 平均盈利 - 败率 × 平均亏损
 */
export const calculateExpectancy = (trades) => {
  if (trades.length === 0) {
    return { hasData: false, message: '没有交易数据' };
  }

  // 按时段分组
  const bySession = {};
  // 按方向分组
  const byDirection = { LONG: [], SHORT: [] };
  // 按品种分组
  const byInstrument = {};

  trades.forEach(t => {
    const session = t.marketSession || '其他';
    if (!bySession[session]) bySession[session] = [];
    bySession[session].push(t);

    if (t.direction) {
      byDirection[t.direction].push(t);
    }

    if (!byInstrument[t.instrumentCode]) byInstrument[t.instrumentCode] = [];
    byInstrument[t.instrumentCode].push(t);
  });

  // 计算期望值的辅助函数
  const calcExpectancyForGroup = (groupTrades) => {
    if (groupTrades.length === 0) return null;
    
    const wins = groupTrades.filter(t => t.pnl > 0);
    const losses = groupTrades.filter(t => t.pnl < 0);
    const winRate = wins.length / groupTrades.length;
    const lossRate = losses.length / groupTrades.length;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const expectancy = winRate * avgWin - lossRate * avgLoss;
    const totalPnL = groupTrades.reduce((s, t) => s + t.pnl, 0);

    return {
      count: groupTrades.length,
      winRate: Number((winRate * 100).toFixed(1)),
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      expectancy: Number(expectancy.toFixed(2)),
      totalPnL: Number(totalPnL.toFixed(2)),
      riskRewardRatio: avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0,
    };
  };

  // 计算各分组的期望值
  const sessionExpectancy = {};
  Object.keys(bySession).forEach(session => {
    sessionExpectancy[session] = calcExpectancyForGroup(bySession[session]);
  });

  const directionExpectancy = {
    LONG: calcExpectancyForGroup(byDirection.LONG),
    SHORT: calcExpectancyForGroup(byDirection.SHORT),
  };

  const instrumentExpectancy = {};
  Object.keys(byInstrument).forEach(inst => {
    instrumentExpectancy[inst] = calcExpectancyForGroup(byInstrument[inst]);
  });

  // 找出最佳和最差时段
  const sessionRanked = Object.entries(sessionExpectancy)
    .filter(([, v]) => v !== null)
    .sort((a, b) => b[1].expectancy - a[1].expectancy);

  const bestSession = sessionRanked[0];
  const worstSession = sessionRanked[sessionRanked.length - 1];

  // 找出最佳品种
  const instrumentRanked = Object.entries(instrumentExpectancy)
    .filter(([, v]) => v !== null && v.count >= 5)
    .sort((a, b) => b[1].expectancy - a[1].expectancy);

  return {
    hasData: true,
    sessionExpectancy,
    directionExpectancy,
    instrumentExpectancy,
    bestSession: bestSession ? { name: bestSession[0], ...bestSession[1] } : null,
    worstSession: worstSession ? { name: worstSession[0], ...worstSession[1] } : null,
    bestInstruments: instrumentRanked.slice(0, 3).map(([name, data]) => ({ name, ...data })),
    worstInstruments: instrumentRanked.slice(-3).reverse().map(([name, data]) => ({ name, ...data })),
    recommendation: bestSession && worstSession && bestSession[1].expectancy > 0
      ? `"${bestSession[0]}"是您的提款机时段（期望值 $${bestSession[1].expectancy.toFixed(0)}），建议重点交易；"${worstSession[0]}"表现较差，建议减少操作`
      : '建议积累更多交易数据以获得更准确的时段分析',
  };
};

/**
 * 4.2 蒙特卡洛模拟
 * 根据当前胜率和赔率，预测未来交易的最大回撤概率
 */
export const monteCarloSimulation = (trades, simulations = 1000, futureTradesCount = 100) => {
  if (trades.length < 10) {
    return { hasData: false, message: '需要至少 10 笔交易进行模拟' };
  }

  // 计算当前统计数据
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const winRate = wins.length / trades.length;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;

  // 蒙特卡洛模拟
  const simulationResults = [];
  const maxDrawdowns = [];
  const finalEquities = [];

  for (let sim = 0; sim < simulations; sim++) {
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve = [0];

    for (let i = 0; i < futureTradesCount; i++) {
      // 随机决定胜负
      const isWin = Math.random() < winRate;
      // 添加一些随机性到盈亏金额（正态分布模拟）
      const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 - 1.3
      const pnl = isWin ? avgWin * randomFactor : -avgLoss * randomFactor;
      
      equity += pnl;
      equityCurve.push(equity);

      if (equity > peak) {
        peak = equity;
      }
      const drawdown = peak - equity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    maxDrawdowns.push(maxDrawdown);
    finalEquities.push(equity);
    simulationResults.push({ equityCurve, maxDrawdown, finalEquity: equity });
  }

  // 计算统计结果
  const sortedDrawdowns = [...maxDrawdowns].sort((a, b) => a - b);
  const sortedEquities = [...finalEquities].sort((a, b) => a - b);

  const percentile = (arr, p) => {
    const index = Math.ceil(arr.length * p / 100) - 1;
    return arr[Math.max(0, index)];
  };

  const avgMaxDrawdown = maxDrawdowns.reduce((s, d) => s + d, 0) / simulations;
  const avgFinalEquity = finalEquities.reduce((s, e) => s + e, 0) / simulations;
  const profitProbability = (finalEquities.filter(e => e > 0).length / simulations) * 100;
  const ruinProbability = (finalEquities.filter(e => e < -avgMaxDrawdown * 2).length / simulations) * 100;

  return {
    hasData: true,
    parameters: {
      winRate: Number((winRate * 100).toFixed(1)),
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      simulations,
      futureTradesCount,
    },
    results: {
      avgMaxDrawdown: Number(avgMaxDrawdown.toFixed(2)),
      maxDrawdown95: Number(percentile(sortedDrawdowns, 95).toFixed(2)),
      maxDrawdown99: Number(percentile(sortedDrawdowns, 99).toFixed(2)),
      avgFinalEquity: Number(avgFinalEquity.toFixed(2)),
      medianFinalEquity: Number(percentile(sortedEquities, 50).toFixed(2)),
      finalEquity5: Number(percentile(sortedEquities, 5).toFixed(2)),
      finalEquity95: Number(percentile(sortedEquities, 95).toFixed(2)),
      profitProbability: Number(profitProbability.toFixed(1)),
      ruinProbability: Number(ruinProbability.toFixed(1)),
    },
    // 用于可视化的采样数据
    sampleCurves: simulationResults.slice(0, 20).map(r => r.equityCurve),
    recommendation: profitProbability > 70
      ? `基于当前表现，未来 ${futureTradesCount} 笔交易有 ${profitProbability.toFixed(0)}% 概率盈利，95%情况下最大回撤不超过 $${percentile(sortedDrawdowns, 95).toFixed(0)}`
      : `当前策略风险较高，${ruinProbability.toFixed(0)}% 概率出现严重亏损，建议优化策略后再继续`,
  };
};

/**
 * 4.3 压力系数评分
 * 基于 MAE 的深度和持仓时长，给每笔单子打出 1-5 星的压力分
 */
export const calculateStressScores = (trades, instruments = []) => {
  const validTrades = trades.filter(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    return mae !== undefined && t.holdingSeconds > 0;
  });

  if (validTrades.length === 0) {
    return { hasData: false, message: '没有足够的 MAE 数据' };
  }

  const scores = validTrades.map(t => {
    const mae = t.mae ?? t.jigsawData?.mae;
    const maeUSD = Math.abs(ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) || 0);
    const absPnL = Math.abs(t.pnl) || 1;
    
    // MAE 占 PnL 的比例
    const maeRatio = maeUSD / absPnL;
    
    // 持仓时间因子（超过10分钟开始累加压力）
    const holdingMinutes = t.holdingSeconds / 60;
    const timeFactor = holdingMinutes > 10 ? Math.min((holdingMinutes - 10) / 30, 1) : 0;
    
    // 浮亏绝对值因子
    const maeAbsFactor = Math.min(maeUSD / 500, 1); // 假设 $500 是较大浮亏
    
    // 综合计算压力分
    let baseScore = 1;
    if (maeRatio > 3) baseScore = 5;
    else if (maeRatio > 2) baseScore = 4;
    else if (maeRatio > 1.5) baseScore = 3;
    else if (maeRatio > 1) baseScore = 2;
    
    // 时间和绝对值加成
    const finalScore = Math.min(5, baseScore + timeFactor * 0.5 + maeAbsFactor * 0.5);
    
    return {
      trade: t,
      maeUSD,
      maeRatio: Number(maeRatio.toFixed(2)),
      holdingMinutes: Number(holdingMinutes.toFixed(1)),
      stressScore: Number(finalScore.toFixed(1)),
      stressLevel: finalScore >= 4.5 ? 'extreme' : 
                   finalScore >= 3.5 ? 'high' : 
                   finalScore >= 2.5 ? 'medium' : 
                   finalScore >= 1.5 ? 'low' : 'minimal',
    };
  });

  const avgStress = scores.reduce((s, sc) => s + sc.stressScore, 0) / scores.length;
  const highStressCount = scores.filter(s => s.stressScore >= 3.5).length;
  const extremeStressCount = scores.filter(s => s.stressScore >= 4.5).length;

  // 按压力分排序
  const sortedByStress = [...scores].sort((a, b) => b.stressScore - a.stressScore);

  return {
    hasData: true,
    tradeCount: validTrades.length,
    avgStressScore: Number(avgStress.toFixed(2)),
    highStressCount,
    highStressRate: Number(((highStressCount / validTrades.length) * 100).toFixed(1)),
    extremeStressCount,
    stressDistribution: {
      minimal: scores.filter(s => s.stressLevel === 'minimal').length,
      low: scores.filter(s => s.stressLevel === 'low').length,
      medium: scores.filter(s => s.stressLevel === 'medium').length,
      high: scores.filter(s => s.stressLevel === 'high').length,
      extreme: scores.filter(s => s.stressLevel === 'extreme').length,
    },
    topStressTrades: sortedByStress.slice(0, 10),
    allScores: scores,
    recommendation: avgStress > 3
      ? `平均压力分 ${avgStress.toFixed(1)}/5，交易过程承压较大，建议减小仓位或优化止损策略`
      : `平均压力分 ${avgStress.toFixed(1)}/5，交易过程较为从容`,
  };
};

// ============================================================================
// 五、综合诊断报告
// ============================================================================

/**
 * 生成综合诊断报告和行动建议
 */
export const generateDiagnosticReport = (trades, instruments = []) => {
  const stopLossAnalysis = calculateOptimalStopLoss(trades, instruments);
  const breakEvenSim = simulateBreakEven(trades, instruments);
  const profitRetention = analyzeProfitRetention(trades, instruments);
  const revengeTrades = detectRevengeTrades(trades);
  const badStopLoss = detectBadStopLoss(trades, instruments);
  const executionAnxiety = detectExecutionAnxiety(trades);
  const dispositionEffect = analyzeDispositionEffect(trades);
  const expectancy = calculateExpectancy(trades);
  const monteCarlo = monteCarloSimulation(trades);
  const stressScores = calculateStressScores(trades, instruments);

  // 生成行动建议优先级
  const actionItems = [];

  // 1. 检查报复性交易
  if (revengeTrades.hasData && revengeTrades.revengeCount > 0) {
    actionItems.push({
      priority: 'high',
      category: '情绪管理',
      icon: '🔥',
      title: '减少报复性交易',
      description: revengeTrades.recommendation,
      impact: `预计可避免 $${Math.abs(revengeTrades.revengeTradePnL).toFixed(0)} 亏损`,
    });
  }

  // 2. 检查处置效应
  if (dispositionEffect.hasData && dispositionEffect.hasDispositionEffect) {
    actionItems.push({
      priority: dispositionEffect.severity === 'critical' ? 'high' : 'medium',
      category: '持仓管理',
      icon: '⏱️',
      title: '改善处置效应',
      description: dispositionEffect.recommendation,
      impact: '让利润奔跑，及时止损',
    });
  }

  // 3. 利润留存问题
  if (profitRetention.hasData && profitRetention.avgRetentionRate > 50) {
    actionItems.push({
      priority: profitRetention.avgRetentionRate > 70 ? 'high' : 'medium',
      category: '止盈策略',
      icon: '💰',
      title: '优化止盈策略',
      description: profitRetention.recommendation,
      impact: `可能挽回 $${profitRetention.totalLostProfit.toFixed(0)} 利润`,
    });
  }

  // 4. 止损位优化
  if (stopLossAnalysis.hasData && stopLossAnalysis.improvement > 0) {
    actionItems.push({
      priority: stopLossAnalysis.improvement > 500 ? 'high' : 'medium',
      category: '风险管理',
      icon: '🛡️',
      title: '优化止损位',
      description: stopLossAnalysis.recommendation,
      impact: `预计提升 $${stopLossAnalysis.improvement.toFixed(0)} 收益`,
    });
  }

  // 5. 执行焦虑
  if (executionAnxiety.hasData && executionAnxiety.anxiousRate > 20) {
    actionItems.push({
      priority: 'medium',
      category: '执行纪律',
      icon: '⏳',
      title: '提高执行果断性',
      description: executionAnxiety.recommendation,
      impact: '减少滑点和心理消耗',
    });
  }

  // 6. 时段选择
  if (expectancy.hasData && expectancy.worstSession && expectancy.worstSession.expectancy < 0) {
    actionItems.push({
      priority: 'low',
      category: '时段选择',
      icon: '🕐',
      title: '优化交易时段',
      description: expectancy.recommendation,
      impact: `避开"${expectancy.worstSession.name}"可减少亏损`,
    });
  }

  // 生成综合建议
  let overallRecommendation = '';
  if (actionItems.filter(a => a.priority === 'high').length >= 2) {
    overallRecommendation = '多看少动 - 当前交易存在较多问题，建议暂停实盘，专注复盘改进';
  } else if (actionItems.filter(a => a.priority === 'high').length === 1) {
    overallRecommendation = '减仓观察 - 解决主要问题后再恢复正常仓位';
  } else if (profitRetention.hasData && profitRetention.avgRetentionRate > 40) {
    overallRecommendation = '早出策略 - 考虑更积极的止盈策略，锁定利润';
  } else {
    overallRecommendation = '继续执行 - 当前策略表现稳定，保持纪律';
  }

  return {
    summary: {
      totalTrades: trades.length,
      overallRecommendation,
      actionItemCount: actionItems.length,
      highPriorityCount: actionItems.filter(a => a.priority === 'high').length,
    },
    actionItems: actionItems.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    analyses: {
      stopLossAnalysis,
      breakEvenSim,
      profitRetention,
      revengeTrades,
      badStopLoss,
      executionAnxiety,
      dispositionEffect,
      expectancy,
      monteCarlo,
      stressScores,
    },
  };
};

/**
 * 为单笔交易生成行为标签
 */
export const generateTradeLabels = (trade, prevTrade, instruments = []) => {
  const labels = [];
  const mae = trade.mae ?? trade.jigsawData?.mae;
  const mfe = trade.mfe ?? trade.jigsawData?.mfe;
  const fills = trade.fills ?? trade.jigsawData?.fills;

  // 计算 USD 值
  const maeUSD = mae !== undefined ? Math.abs(ticksToUSD(mae, trade.instrumentCode, trade.openQuantity, instruments) || 0) : null;
  const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, trade.instrumentCode, trade.openQuantity, instruments) : null;

  // 1. 报复性交易检测
  if (prevTrade && prevTrade.pnl < 0) {
    const minutesDiff = getMinutesDiff(prevTrade.closeTime || prevTrade.openTime, trade.openTime);
    if (minutesDiff < 5) {
      labels.push({
        type: 'revenge',
        icon: '🔥',
        label: '报复性交易',
        color: '#ef4444',
        description: `上笔亏损后 ${minutesDiff.toFixed(0)} 分钟内入场`,
      });
    }
  }

  // 2. 止损极点检测
  if (trade.pnl < 0 && maeUSD !== null) {
    const actualLoss = Math.abs(trade.pnl);
    const diff = maeUSD - actualLoss;
    if (diff / actualLoss <= 0.1) {
      labels.push({
        type: 'bottomStop',
        icon: '🎯',
        label: '割肉在极点',
        color: '#f97316',
        description: '止损位置接近最大浮亏',
      });
    }
  }

  // 3. 执行焦虑检测
  if (fills && trade.openQuantity) {
    const quantity = Math.abs(trade.openQuantity);
    if (fills > quantity * 2) {
      labels.push({
        type: 'anxiety',
        icon: '⏳',
        label: '执行犹豫',
        color: '#8b5cf6',
        description: `成交 ${fills} 次，仓位 ${quantity} 手`,
      });
    }
  }

  // 4. 获利回吐检测
  if (mfeUSD && mfeUSD > 0) {
    const retentionRate = ((mfeUSD - Math.max(0, trade.pnl)) / mfeUSD) * 100;
    if (retentionRate > 70) {
      labels.push({
        type: 'profitGiveBack',
        icon: '📉',
        label: '严重回吐',
        color: '#f59e0b',
        description: `MFE $${mfeUSD.toFixed(0)} → 实际 $${trade.pnl.toFixed(0)}`,
      });
    }
  }

  // 5. 完美止盈
  if (trade.pnl > 0 && mfeUSD && trade.pnl >= mfeUSD * 0.8) {
    labels.push({
      type: 'perfectExit',
      icon: '⭐',
      label: '完美止盈',
      color: '#10b981',
      description: '在接近最高点离场',
    });
  }

  // 6. 承压过重
  if (maeUSD && trade.pnl > 0 && maeUSD > trade.pnl * 2) {
    labels.push({
      type: 'highPressure',
      icon: '💪',
      label: '承压过重',
      color: '#f97316',
      description: `浮亏 $${maeUSD.toFixed(0)} 后盈利 $${trade.pnl.toFixed(0)}`,
    });
  }

  return labels;
};

export default {
  calculateOptimalStopLoss,
  simulateBreakEven,
  analyzeProfitRetention,
  detectRevengeTrades,
  detectBadStopLoss,
  detectExecutionAnxiety,
  analyzeDispositionEffect,
  calculateExpectancy,
  monteCarloSimulation,
  calculateStressScores,
  generateDiagnosticReport,
  generateTradeLabels,
};
