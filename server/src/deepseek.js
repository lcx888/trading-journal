/**
 * DeepSeek AI 服务
 * 使用 DeepSeek API 进行交易数据智能分析
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 环境变量未设置');
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'deepseek-chat',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// 品种 tick 价值映射（美元/tick）
const TICK_VALUES = {
  'GC': 10, 'ES': 12.5, 'NQ': 5, 'RTY': 5, 'CL': 10, 'SI': 25,
  'YM': 5, 'ZB': 31.25, 'ZN': 15.625, '6E': 12.5,
  'M2K': 0.5, 'MES': 1.25, 'MNQ': 0.5, 'MGC': 1,
};

// 获取 tick 价值
const getTickValue = (instrumentCode) => TICK_VALUES[instrumentCode] || 5;

// 将 ticks 转换为美元
const ticksToUSD = (ticks, instrumentCode, quantity) => {
  if (ticks === undefined || ticks === null) return null;
  return ticks * getTickValue(instrumentCode) * Math.abs(quantity || 1);
};

/**
 * 准备交易数据摘要（支持 Jigsaw 扩展字段）
 */
function prepareTradesSummary(trades) {
  if (!trades || trades.length === 0) {
    return { summary: { totalTrades: 0 }, bySession: [], byInstrument: [], direction: {}, recentTrades: [], worstTrades: [], bestTrades: [], jigsawAnalysis: null };
  }

  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades * 100).toFixed(1) : 0;
  
  const avgProfit = winningTrades.length > 0 
    ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0 
    ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length) 
    : 0;
  const profitLossRatio = avgLoss > 0 ? (avgProfit / avgLoss).toFixed(2) : 'N/A';

  // ==================== Jigsaw 扩展分析 ====================
  // 检测是否有 Jigsaw 数据
  const tradesWithMAE = trades.filter(t => t.mae !== undefined && t.mae !== null);
  const tradesWithMFE = trades.filter(t => t.mfe !== undefined && t.mfe !== null);
  const tradesWithFills = trades.filter(t => t.fills !== undefined && t.fills !== null);
  const hasJigsawData = tradesWithMAE.length > 0 || tradesWithMFE.length > 0;

  let jigsawAnalysis = null;
  if (hasJigsawData) {
    // MAE 分析（最大不利偏移 - 衡量入场精度）
    const maeStats = tradesWithMAE.length > 0 ? {
      count: tradesWithMAE.length,
      avgMAE: tradesWithMAE.reduce((sum, t) => sum + (t.mae || 0), 0) / tradesWithMAE.length,
      avgMAEUSD: tradesWithMAE.reduce((sum, t) => sum + ticksToUSD(t.mae, t.instrumentCode, t.openQuantity), 0) / tradesWithMAE.length,
      maxMAE: Math.max(...tradesWithMAE.map(t => t.mae || 0)),
      maxMAEUSD: Math.max(...tradesWithMAE.map(t => ticksToUSD(t.mae, t.instrumentCode, t.openQuantity) || 0)),
    } : null;

    // MFE 分析（最大有利偏移 - 衡量潜在利润捕获）
    const mfeStats = tradesWithMFE.length > 0 ? {
      count: tradesWithMFE.length,
      avgMFE: tradesWithMFE.reduce((sum, t) => sum + (t.mfe || 0), 0) / tradesWithMFE.length,
      avgMFEUSD: tradesWithMFE.reduce((sum, t) => sum + ticksToUSD(t.mfe, t.instrumentCode, t.openQuantity), 0) / tradesWithMFE.length,
      maxMFE: Math.max(...tradesWithMFE.map(t => t.mfe || 0)),
      maxMFEUSD: Math.max(...tradesWithMFE.map(t => ticksToUSD(t.mfe, t.instrumentCode, t.openQuantity) || 0)),
    } : null;

    // 成交次数分析（衡量执行效率）
    const fillsStats = tradesWithFills.length > 0 ? {
      count: tradesWithFills.length,
      totalFills: tradesWithFills.reduce((sum, t) => sum + (t.fills || 0), 0),
      avgFills: tradesWithFills.reduce((sum, t) => sum + (t.fills || 0), 0) / tradesWithFills.length,
      maxFills: Math.max(...tradesWithFills.map(t => t.fills || 0)),
    } : null;

    // 入场精度分析：MAE 越小，入场越精准
    const entryPrecisionTrades = tradesWithMAE.filter(t => t.mae <= 10);
    const poorEntryTrades = tradesWithMAE.filter(t => t.mae > 50);

    // 利润捕获效率：实际盈亏 / MFE
    const profitCaptureTrades = trades.filter(t => t.mfe && t.mfe > 0 && t.pnl !== undefined);
    const avgProfitCapture = profitCaptureTrades.length > 0 
      ? profitCaptureTrades.reduce((sum, t) => {
          const mfeUSD = ticksToUSD(t.mfe, t.instrumentCode, t.openQuantity);
          return sum + (t.pnl / mfeUSD);
        }, 0) / profitCaptureTrades.length * 100
      : null;

    // 风险收益分析：MFE / MAE 比率
    const tradesWithBoth = trades.filter(t => t.mae && t.mfe && t.mae > 0);
    const avgMFEMAERatio = tradesWithBoth.length > 0
      ? tradesWithBoth.reduce((sum, t) => sum + (t.mfe / t.mae), 0) / tradesWithBoth.length
      : null;

    // 盈利交易 vs 亏损交易的 MAE/MFE 对比
    const winningWithMAE = winningTrades.filter(t => t.mae !== undefined);
    const losingWithMAE = losingTrades.filter(t => t.mae !== undefined);
    const winningAvgMAE = winningWithMAE.length > 0
      ? winningWithMAE.reduce((sum, t) => sum + (t.mae || 0), 0) / winningWithMAE.length
      : null;
    const losingAvgMAE = losingWithMAE.length > 0
      ? losingWithMAE.reduce((sum, t) => sum + (t.mae || 0), 0) / losingWithMAE.length
      : null;

    const winningWithMFE = winningTrades.filter(t => t.mfe !== undefined);
    const losingWithMFE = losingTrades.filter(t => t.mfe !== undefined);
    const winningAvgMFE = winningWithMFE.length > 0
      ? winningWithMFE.reduce((sum, t) => sum + (t.mfe || 0), 0) / winningWithMFE.length
      : null;
    const losingAvgMFE = losingWithMFE.length > 0
      ? losingWithMFE.reduce((sum, t) => sum + (t.mfe || 0), 0) / losingWithMFE.length
      : null;

    // MAE 最大的5笔交易（入场最差）
    const worstEntryTrades = [...tradesWithMAE]
      .sort((a, b) => (b.mae || 0) - (a.mae || 0))
      .slice(0, 5)
      .map(t => ({
        time: t.openTime,
        instrument: t.instrumentCode,
        direction: t.direction,
        pnl: t.pnl?.toFixed(2),
        mae: t.mae,
        maeUSD: ticksToUSD(t.mae, t.instrumentCode, t.openQuantity)?.toFixed(0),
        mfe: t.mfe,
      }));

    // MFE 最高但最终亏损的交易（利润回吐）
    const profitGivebackTrades = trades
      .filter(t => t.mfe > 20 && t.pnl < 0)
      .sort((a, b) => (b.mfe || 0) - (a.mfe || 0))
      .slice(0, 5)
      .map(t => ({
        time: t.openTime,
        instrument: t.instrumentCode,
        direction: t.direction,
        pnl: t.pnl?.toFixed(2),
        mfe: t.mfe,
        mfeUSD: ticksToUSD(t.mfe, t.instrumentCode, t.openQuantity)?.toFixed(0),
        lostProfit: ticksToUSD(t.mfe, t.instrumentCode, t.openQuantity) + t.pnl,
      }));

    jigsawAnalysis = {
      hasData: true,
      dataCount: {
        mae: tradesWithMAE.length,
        mfe: tradesWithMFE.length,
        fills: tradesWithFills.length,
      },
      maeStats,
      mfeStats,
      fillsStats,
      entryAnalysis: {
        preciseEntries: entryPrecisionTrades.length,
        poorEntries: poorEntryTrades.length,
        precisionRate: tradesWithMAE.length > 0 
          ? ((entryPrecisionTrades.length / tradesWithMAE.length) * 100).toFixed(1)
          : null,
      },
      profitCapture: {
        avgCaptureRate: avgProfitCapture?.toFixed(1),
        mfeMaeRatio: avgMFEMAERatio?.toFixed(2),
      },
      winVsLoss: {
        winningAvgMAE: winningAvgMAE?.toFixed(1),
        losingAvgMAE: losingAvgMAE?.toFixed(1),
        winningAvgMFE: winningAvgMFE?.toFixed(1),
        losingAvgMFE: losingAvgMFE?.toFixed(1),
      },
      worstEntryTrades,
      profitGivebackTrades,
    };
  }

  // ==================== 原有分析逻辑 ====================
  // 按时段分组
  const bySession = {};
  trades.forEach(t => {
    const session = t.marketSession || '未知';
    if (!bySession[session]) bySession[session] = { count: 0, pnl: 0, wins: 0 };
    bySession[session].count++;
    bySession[session].pnl += t.pnl || 0;
    if (t.pnl > 0) bySession[session].wins++;
  });

  // 按品种分组
  const byInstrument = {};
  trades.forEach(t => {
    const code = t.instrumentCode || '未知';
    if (!byInstrument[code]) byInstrument[code] = { count: 0, pnl: 0, wins: 0 };
    byInstrument[code].count++;
    byInstrument[code].pnl += t.pnl || 0;
    if (t.pnl > 0) byInstrument[code].wins++;
  });

  // 按方向分组
  const longTrades = trades.filter(t => t.direction === 'LONG' || t.direction === '多');
  const shortTrades = trades.filter(t => t.direction === 'SHORT' || t.direction === '空');
  const longPnL = longTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const shortPnL = shortTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const longWinRate = longTrades.length > 0 
    ? (longTrades.filter(t => t.pnl > 0).length / longTrades.length * 100).toFixed(1) 
    : 0;
  const shortWinRate = shortTrades.length > 0 
    ? (shortTrades.filter(t => t.pnl > 0).length / shortTrades.length * 100).toFixed(1) 
    : 0;

  // 连续亏损分析
  let maxLossStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreakPnL = 0;
  let currentStreakPnL = 0;
  trades.forEach(t => {
    if (t.pnl < 0) {
      currentLossStreak++;
      currentStreakPnL += t.pnl;
      if (currentLossStreak > maxLossStreak) {
        maxLossStreak = currentLossStreak;
        maxLossStreakPnL = currentStreakPnL;
      }
    } else {
      currentLossStreak = 0;
      currentStreakPnL = 0;
    }
  });

  // 大额亏损
  const largeLosses = trades.filter(t => t.pnl < -200);
  
  // 计算最大回撤
  let cumPnL = 0;
  let peak = 0;
  let maxDrawdown = 0;
  trades.forEach(t => {
    cumPnL += t.pnl || 0;
    if (cumPnL > peak) peak = cumPnL;
    const drawdown = peak - cumPnL;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  // 亏损最大的交易（包含 MAE/MFE 信息）
  const worstTrades = [...trades]
    .filter(t => t.pnl < 0)
    .sort((a, b) => a.pnl - b.pnl)
    .slice(0, 5)
    .map(t => ({
      time: t.openTime,
      instrument: t.instrumentCode,
      direction: t.direction,
      pnl: t.pnl?.toFixed(2),
      session: t.marketSession,
      mae: t.mae,
      mfe: t.mfe,
      fills: t.fills,
    }));

  // 盈利最大的交易（包含 MAE/MFE 信息）
  const bestTrades = [...trades]
    .filter(t => t.pnl > 0)
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 5)
    .map(t => ({
      time: t.openTime,
      instrument: t.instrumentCode,
      direction: t.direction,
      pnl: t.pnl?.toFixed(2),
      session: t.marketSession,
      mae: t.mae,
      mfe: t.mfe,
      fills: t.fills,
    }));

  // 找出表现最好和最差的品种
  const instrumentStats = Object.entries(byInstrument).map(([code, data]) => ({
    instrument: code,
    count: data.count,
    pnl: data.pnl,
    winRate: ((data.wins / data.count) * 100).toFixed(1),
  })).sort((a, b) => b.pnl - a.pnl);

  const bestInstrument = instrumentStats[0];
  const worstInstrument = instrumentStats[instrumentStats.length - 1];

  // 找出表现最好和最差的时段
  const sessionStats = Object.entries(bySession).map(([session, data]) => ({
    session,
    count: data.count,
    pnl: data.pnl,
    winRate: ((data.wins / data.count) * 100).toFixed(1),
  })).sort((a, b) => b.pnl - a.pnl);

  const bestSession = sessionStats[0];
  const worstSession = sessionStats[sessionStats.length - 1];

  return {
    summary: {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalPnL: totalPnL.toFixed(2),
      winRate: `${winRate}%`,
      avgProfit: avgProfit.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitLossRatio,
      maxDrawdown: maxDrawdown.toFixed(2),
      maxLossStreak,
      maxLossStreakPnL: maxLossStreakPnL.toFixed(2),
      largeLossCount: largeLosses.length,
    },
    bySession: Object.entries(bySession).map(([session, data]) => ({
      session,
      count: data.count,
      pnl: data.pnl.toFixed(2),
      winRate: ((data.wins / data.count) * 100).toFixed(1) + '%',
    })),
    byInstrument: Object.entries(byInstrument).map(([code, data]) => ({
      instrument: code,
      count: data.count,
      pnl: data.pnl.toFixed(2),
      winRate: ((data.wins / data.count) * 100).toFixed(1) + '%',
    })),
    direction: {
      long: { count: longTrades.length, pnl: longPnL.toFixed(2), winRate: `${longWinRate}%` },
      short: { count: shortTrades.length, pnl: shortPnL.toFixed(2), winRate: `${shortWinRate}%` },
    },
    worstTrades,
    bestTrades,
    bestInstrument,
    worstInstrument,
    bestSession,
    worstSession,
    jigsawAnalysis, // 新增：Jigsaw 扩展分析
  };
}

/**
 * 生成交易分析
 */
export async function analyzeTradesWithAI(trades, options = {}) {
  const tradeData = prepareTradesSummary(trades);
  
  if (tradeData.summary.totalTrades === 0) {
    return { success: false, message: '无交易数据可分析' };
  }

  // 判断账户健康状态
  const pnl = parseFloat(tradeData.summary.totalPnL);
  const winRate = parseFloat(tradeData.summary.winRate);
  const plRatio = parseFloat(tradeData.summary.profitLossRatio) || 0;
  const drawdown = parseFloat(tradeData.summary.maxDrawdown);
  
  const pnlStatus = pnl > 0 ? '盈利' : pnl < 0 ? '亏损' : '持平';
  const plRatioStatus = plRatio >= 1.5 ? '优秀' : plRatio >= 1 ? '及格' : '警告';
  const drawdownStatus = drawdown < 500 ? '可控' : drawdown < 2000 ? '注意' : '严重';
  const winRateStatus = winRate >= 50 ? '正常' : winRate >= 40 ? '偏低' : '危险';
  
  // 检测是否有 Jigsaw 数据
  const hasJigsawData = tradeData.jigsawAnalysis?.hasData;
  
  // Jigsaw 执行质量分析部分（仅当有数据时显示）
  const jigsawReportSection = hasJigsawData ? `

## 九、执行质量深度分析（基于 MAE/MFE 数据）

### 9.1 入场精度诊断
基于 MAE（Maximum Adverse Excursion 最大不利偏移）分析入场时机：
- MAE 代表入场后价格向不利方向的最大波动
- MAE 越小说明入场点位越精准
- 分析精准入场率和糟糕入场的原因

### 9.2 利润捕获效率
基于 MFE（Maximum Favorable Excursion 最大有利偏移）分析出场时机：
- MFE 代表交易过程中最大浮盈
- 利润捕获率 = 实际盈亏 / MFE
- 分析是否存在过早止盈或利润回吐问题

### 9.3 盈亏单对比分析
- 对比盈利单和亏损单的 MAE/MFE 差异
- 找出亏损的根本原因（入场问题 or 出场问题）

### 9.4 执行改进建议
- 针对入场精度问题的具体建议
- 针对利润捕获问题的具体建议
- 止盈止损位置优化建议

---` : '';

  const systemPrompt = `# 角色设定
你是 MetWorth AI，一位拥有20年华尔街实战经验的资深交易导师。你的诊断风格专业严谨，措辞犀利但不失温度。

# 核心原则
1. 洞察优先：不要复述数据，直接给出结论和原因
2. 对比鲜明：建立"盈利品种 vs 亏损品种"的强烈对比
3. 行动具体：拒绝"控制风险"等模糊表述，给出具体数字和操作
4. 策略导向：每个问题都要有对应的解决方案
${hasJigsawData ? '5. 深度执行分析：基于 MAE/MFE 数据深入分析入场精度和利润捕获效率' : ''}

# 重要格式要求
- 不要使用任何 Emoji 表情符号
- 不要使用 Markdown 表格语法（| 和 --- 那种）
- 使用清晰的标题层级和列表格式
- 用加粗 **文字** 强调重点
- 保持专业、简洁的商务风格

# MAE/MFE 专业术语说明（如果数据中包含）
- **MAE（Maximum Adverse Excursion）**：最大不利偏移，入场后价格向不利方向的最大波动。MAE 越小说明入场时机越好。
- **MFE（Maximum Favorable Excursion）**：最大有利偏移，交易过程中的最大浮盈。对比实际盈亏和 MFE 可以评估利润捕获效率。
- **利润捕获率**：实际盈亏 / MFE × 100%，反映出场时机的把握能力。
- **MFE/MAE 比率**：越高说明入场后价格向有利方向发展越多，交易质量越高。

# 输出结构

---

## 一、账户诊断概览

分析周期：共 ${tradeData.summary.totalTrades} 笔交易

**核心指标**

- 净利润：$${tradeData.summary.totalPnL}（${pnlStatus}）
- 盈亏比：${tradeData.summary.profitLossRatio}（${plRatioStatus}）
- 最大回撤：-$${tradeData.summary.maxDrawdown}（${drawdownStatus}）
- 胜率：${tradeData.summary.winRate}（${winRateStatus}）
${hasJigsawData ? `- 平均 MAE：${tradeData.jigsawAnalysis.maeStats?.avgMAE?.toFixed(1) || 'N/A'} ticks（入场精度）
- 平均 MFE：${tradeData.jigsawAnalysis.mfeStats?.avgMFE?.toFixed(1) || 'N/A'} ticks（潜在利润）
- 精准入场率：${tradeData.jigsawAnalysis.entryAnalysis?.precisionRate || 'N/A'}%` : ''}

**核心洞察**：用2-3句话概括账户的核心问题和亮点。${hasJigsawData ? '特别关注入场精度和利润捕获效率。' : ''}

---

## 二、品种分析

### 盈利品种
分析表现最好的品种，说明做对了什么，能否复制。

### 亏损品种
分析表现最差的品种，指出问题根源（技术 or 心态 or 时机）。

---

## 三、策略诊断

### 3.1 趋势跟踪能力
- 多空表现对比分析
- 存在的问题
- 改进建议

### 3.2 时机把握
- 最佳交易时段
- 最差交易时段
- 时段优化策略

### 3.3 仓位管理
- 当前仓位评估
- 大额亏损分析
- 具体仓位建议（可包含凯利公式参考值）

### 3.4 风控执行
- 止损执行评估
- 是否存在抗单、移动止损等问题
- 具体风控建议

---

## 四、策略优化方案

针对诊断发现的问题，给出3-5条具体的优化策略：

**问题1：[具体问题]**
- 策略方案：[具体操作建议]
- 预期效果：[量化预期]

**问题2：[具体问题]**
- 策略方案：[具体操作建议]
- 预期效果：[量化预期]

（以此类推）

---

## 五、交易者画像

**交易人格类型**：[类型名称]

[一段50字左右的人格描述，指出优势和软肋]

**心理弱点**：
- [分析连续亏损后的行为模式]
- [是否存在报复性交易]
- [情绪管理建议]

---

## 六、行动清单

### 立即执行
- [ ] [今天必须完成的紧急任务]

### 本周必做
- [ ] [具体任务1，带数字]
- [ ] [具体任务2]
- [ ] [具体任务3]

### 长期优化
- [ ] [1-4周内完成的策略优化]
- [ ] [习惯养成任务]

---

## 七、学习建议

**推荐学习方向**：[主题]

[一句话说明为什么需要学习这个方向]

---

## 八、风险警报

**[风险名称]**：[具体描述和后果预警]
${jigsawReportSection}
---

*以上诊断基于数据生成，请结合实际情况参考。*
`;

  // 构建 Jigsaw 数据部分（如果有）
  const jigsawSection = tradeData.jigsawAnalysis?.hasData ? `

## 【高级数据分析 - Jigsaw 执行质量】

### MAE 入场精度分析（Maximum Adverse Excursion - 最大不利偏移）
- 数据样本: ${tradeData.jigsawAnalysis.dataCount.mae} 笔交易
- 平均 MAE: ${tradeData.jigsawAnalysis.maeStats?.avgMAE?.toFixed(1)} ticks（约 $${tradeData.jigsawAnalysis.maeStats?.avgMAEUSD?.toFixed(0)}）
- 最大 MAE: ${tradeData.jigsawAnalysis.maeStats?.maxMAE} ticks（约 $${tradeData.jigsawAnalysis.maeStats?.maxMAEUSD?.toFixed(0)}）
- 精准入场率（MAE≤10 ticks）: ${tradeData.jigsawAnalysis.entryAnalysis.precisionRate}%（${tradeData.jigsawAnalysis.entryAnalysis.preciseEntries} 笔）
- 糟糕入场（MAE>50 ticks）: ${tradeData.jigsawAnalysis.entryAnalysis.poorEntries} 笔
${tradeData.jigsawAnalysis.winVsLoss.winningAvgMAE ? `- 盈利单平均 MAE: ${tradeData.jigsawAnalysis.winVsLoss.winningAvgMAE} ticks` : ''}
${tradeData.jigsawAnalysis.winVsLoss.losingAvgMAE ? `- 亏损单平均 MAE: ${tradeData.jigsawAnalysis.winVsLoss.losingAvgMAE} ticks` : ''}

### MFE 利润捕获分析（Maximum Favorable Excursion - 最大有利偏移）
- 数据样本: ${tradeData.jigsawAnalysis.dataCount.mfe} 笔交易
- 平均 MFE: ${tradeData.jigsawAnalysis.mfeStats?.avgMFE?.toFixed(1)} ticks（约 $${tradeData.jigsawAnalysis.mfeStats?.avgMFEUSD?.toFixed(0)}）
- 最大 MFE: ${tradeData.jigsawAnalysis.mfeStats?.maxMFE} ticks（约 $${tradeData.jigsawAnalysis.mfeStats?.maxMFEUSD?.toFixed(0)}）
${tradeData.jigsawAnalysis.profitCapture.avgCaptureRate ? `- 利润捕获率: ${tradeData.jigsawAnalysis.profitCapture.avgCaptureRate}%（实际盈亏/最大可能利润）` : ''}
${tradeData.jigsawAnalysis.profitCapture.mfeMaeRatio ? `- MFE/MAE 比率: ${tradeData.jigsawAnalysis.profitCapture.mfeMaeRatio}（越高说明入场后价格向有利方向发展越多）` : ''}
${tradeData.jigsawAnalysis.winVsLoss.winningAvgMFE ? `- 盈利单平均 MFE: ${tradeData.jigsawAnalysis.winVsLoss.winningAvgMFE} ticks` : ''}
${tradeData.jigsawAnalysis.winVsLoss.losingAvgMFE ? `- 亏损单平均 MFE: ${tradeData.jigsawAnalysis.winVsLoss.losingAvgMFE} ticks` : ''}

### 执行效率分析
${tradeData.jigsawAnalysis.fillsStats ? `- 总成交次数: ${tradeData.jigsawAnalysis.fillsStats.totalFills} 次
- 平均每笔成交: ${tradeData.jigsawAnalysis.fillsStats.avgFills?.toFixed(1)} 次
- 单笔最多成交: ${tradeData.jigsawAnalysis.fillsStats.maxFills} 次` : '- 无成交次数数据'}

### 入场最差的5笔交易（MAE最高）
${tradeData.jigsawAnalysis.worstEntryTrades?.map((t, i) => 
  `${i+1}. ${t.instrument} ${t.direction} | 盈亏 $${t.pnl} | MAE ${t.mae} ticks (-$${t.maeUSD}) | MFE ${t.mfe || 'N/A'} ticks`
).join('\n') || '无数据'}

### 利润回吐最严重的交易（MFE高但最终亏损）
${tradeData.jigsawAnalysis.profitGivebackTrades?.length > 0 
  ? tradeData.jigsawAnalysis.profitGivebackTrades.map((t, i) => 
      `${i+1}. ${t.instrument} ${t.direction} | 最终 $${t.pnl} | 曾赚 +$${t.mfeUSD} | 回吐 $${t.lostProfit?.toFixed(0)}`
    ).join('\n')
  : '无显著利润回吐交易'}
` : '';

  const userPrompt = `# 交易数据

## 基础指标
- 总交易: ${tradeData.summary.totalTrades} 笔
- 盈利: ${tradeData.summary.winningTrades} 笔 | 亏损: ${tradeData.summary.losingTrades} 笔
- 净盈亏: $${tradeData.summary.totalPnL}
- 胜率: ${tradeData.summary.winRate}
- 平均盈利: $${tradeData.summary.avgProfit} | 平均亏损: $${tradeData.summary.avgLoss}
- 盈亏比: ${tradeData.summary.profitLossRatio}
- 最大回撤: $${tradeData.summary.maxDrawdown}
- 最长连亏: ${tradeData.summary.maxLossStreak} 笔 (亏损 $${tradeData.summary.maxLossStreakPnL})
- 大额亏损(>$200): ${tradeData.summary.largeLossCount} 笔

## 品种表现（按盈亏排序）
${tradeData.byInstrument.map(i => `- ${i.instrument}: ${i.count}笔 | $${i.pnl} | 胜率${i.winRate}`).join('\n')}
${tradeData.bestInstrument ? `\n最佳品种: ${tradeData.bestInstrument.instrument} (+$${tradeData.bestInstrument.pnl.toFixed(2)})` : ''}
${tradeData.worstInstrument && tradeData.worstInstrument.pnl < 0 ? `最差品种: ${tradeData.worstInstrument.instrument} ($${tradeData.worstInstrument.pnl.toFixed(2)})` : ''}

## 时段表现
${tradeData.bySession.map(s => `- ${s.session}: ${s.count}笔 | $${s.pnl} | 胜率${s.winRate}`).join('\n')}
${tradeData.bestSession ? `\n最佳时段: ${tradeData.bestSession.session} (+$${tradeData.bestSession.pnl.toFixed(2)})` : ''}
${tradeData.worstSession && tradeData.worstSession.pnl < 0 ? `最差时段: ${tradeData.worstSession.session} ($${tradeData.worstSession.pnl.toFixed(2)})` : ''}

## 多空对比
- 多头: ${tradeData.direction.long.count}笔 | $${tradeData.direction.long.pnl} | 胜率${tradeData.direction.long.winRate}
- 空头: ${tradeData.direction.short.count}笔 | $${tradeData.direction.short.pnl} | 胜率${tradeData.direction.short.winRate}

## 最惨烈的5笔亏损
${tradeData.worstTrades.map((t, i) => `${i+1}. ${t.instrument} ${t.direction} | $${t.pnl} | ${t.session}${t.mae ? ` | MAE ${t.mae}` : ''}${t.mfe ? ` | MFE ${t.mfe}` : ''}`).join('\n')}

## 最出色的5笔盈利
${tradeData.bestTrades.map((t, i) => `${i+1}. ${t.instrument} ${t.direction} | +$${t.pnl} | ${t.session}${t.mae ? ` | MAE ${t.mae}` : ''}${t.mfe ? ` | MFE ${t.mfe}` : ''}`).join('\n')}
${jigsawSection}
---
请基于以上数据，生成一份犀利、有洞察力的诊断报告。${tradeData.jigsawAnalysis?.hasData ? '特别注意分析 MAE/MFE 数据揭示的入场精度和利润捕获问题。' : ''}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const analysis = await callDeepSeek(messages, { ...options, maxTokens: 6000 });
  
  return {
    success: true,
    analysis,
    tradeData,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 分析单笔交易（支持 Jigsaw 扩展数据）
 */
export async function analyzeSingleTrade(trade) {
  // 检测是否有 Jigsaw 数据
  const hasJigsawData = trade.mae !== undefined || trade.mfe !== undefined || trade.fills !== undefined;
  
  const systemPrompt = `你是一位专业的期货交易教练。请分析这笔交易，提供简洁的复盘建议。
回复要求：简洁明了，不超过250字，直接给出核心问题和改进建议。
${hasJigsawData ? `
重点关注：
- MAE（最大不利偏移）反映入场精度，数值越小入场越好
- MFE（最大有利偏移）反映潜在利润，对比实际盈亏评估出场时机
- 如果 MFE 很高但最终亏损，说明存在利润回吐问题
- 如果 MAE 很高，说明入场时机需要优化` : ''}`;

  // 计算 Jigsaw 相关金额
  const maeUSD = trade.mae ? ticksToUSD(trade.mae, trade.instrumentCode, trade.openQuantity) : null;
  const mfeUSD = trade.mfe ? ticksToUSD(trade.mfe, trade.instrumentCode, trade.openQuantity) : null;
  
  const jigsawInfo = hasJigsawData ? `
执行质量数据：
${trade.mae !== undefined ? `- MAE: ${trade.mae} ticks（最大浮亏 -$${maeUSD?.toFixed(0)}）` : ''}
${trade.mfe !== undefined ? `- MFE: ${trade.mfe} ticks（最大浮盈 +$${mfeUSD?.toFixed(0)}）` : ''}
${trade.fills !== undefined ? `- 成交次数: ${trade.fills} 次` : ''}
${trade.mfe && trade.pnl !== undefined ? `- 利润捕获率: ${((trade.pnl / mfeUSD) * 100).toFixed(1)}%` : ''}
${trade.mae && trade.mfe && trade.mae > 0 ? `- MFE/MAE 比率: ${(trade.mfe / trade.mae).toFixed(2)}` : ''}` : '';

  const tradeInfo = `交易详情：
- 品种: ${trade.instrumentCode}
- 方向: ${trade.direction === 'LONG' ? '多' : '空'}
- 数量: ${Math.abs(trade.openQuantity || 1)} 手
- 盈亏: $${trade.pnl?.toFixed(2)}
- 时段: ${trade.marketSession || '未知'}
- 开仓时间: ${trade.openTime}
- 平仓时间: ${trade.closeTime}
- 持仓时长: ${trade.holdingSeconds ? Math.floor(trade.holdingSeconds / 60) + '分' + (trade.holdingSeconds % 60) + '秒' : '未知'}
${trade.ticks ? `- Ticks: ${trade.ticks}` : ''}
${trade.notes ? `- 备注: ${trade.notes}` : ''}
${jigsawInfo}

请分析这笔交易的问题和改进建议。${hasJigsawData ? '特别关注 MAE/MFE 数据揭示的入场和出场问题。' : ''}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: tradeInfo },
  ];

  const analysis = await callDeepSeek(messages, { maxTokens: 600 });
  
  return { success: true, analysis };
}

/**
 * AI 交易问答（支持 Jigsaw 扩展数据）
 */
export async function chatWithAI(userMessage, trades = [], chatHistory = []) {
  const tradeData = prepareTradesSummary(trades);
  const hasJigsawData = tradeData.jigsawAnalysis?.hasData;
  
  const jigsawSummary = hasJigsawData ? `

执行质量数据（Jigsaw）：
- 平均 MAE: ${tradeData.jigsawAnalysis.maeStats?.avgMAE?.toFixed(1) || 'N/A'} ticks（入场精度）
- 平均 MFE: ${tradeData.jigsawAnalysis.mfeStats?.avgMFE?.toFixed(1) || 'N/A'} ticks（潜在利润）
- 精准入场率: ${tradeData.jigsawAnalysis.entryAnalysis?.precisionRate || 'N/A'}%
- MFE/MAE 比率: ${tradeData.jigsawAnalysis.profitCapture?.mfeMaeRatio || 'N/A'}` : '';

  const systemPrompt = `你是一位专业的期货交易顾问，名叫"MetWorth AI"。
你拥有20年华尔街交易经验，擅长交易心理辅导和风险管理。

当前用户的交易数据摘要：
- 总交易: ${tradeData.summary.totalTrades} 笔
- 胜率: ${tradeData.summary.winRate}
- 总盈亏: $${tradeData.summary.totalPnL}
- 盈亏比: ${tradeData.summary.profitLossRatio}
- 最大回撤: $${tradeData.summary.maxDrawdown}
${jigsawSummary}
${hasJigsawData ? `
MAE/MFE 术语说明：
- MAE = 最大不利偏移（入场后最大浮亏），越小入场越精准
- MFE = 最大有利偏移（交易中最大浮盈），对比实际盈亏可评估出场效率` : ''}

回复风格：
1. 专业严谨，措辞简洁
2. 给出具体可执行的建议，带数字
3. 不使用 emoji 表情
4. 控制在200字以内`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10),
    { role: 'user', content: userMessage },
  ];

  const response = await callDeepSeek(messages, { maxTokens: 1000 });
  
  return { success: true, response };
}

/**
 * 生成每日交易总结
 */
export async function generateDailySummary(trades, date) {
  const dayTrades = trades.filter(t => {
    const tradeDate = new Date(t.openTime).toDateString();
    return tradeDate === new Date(date).toDateString();
  });

  if (dayTrades.length === 0) {
    return { success: false, message: '当日无交易记录' };
  }

  const totalPnL = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = dayTrades.filter(t => t.pnl > 0).length;
  const losses = dayTrades.filter(t => t.pnl < 0).length;

  const systemPrompt = `你是交易日记助手。请用简洁的语言总结今日交易，包含：
1. 整体表现评价（一句话）
2. 今日亮点
3. 需改进之处
4. 明日注意事项

保持简洁，总共不超过150字。`;

  const userPrompt = `今日交易总结（${date}）：
- 交易笔数: ${dayTrades.length}
- 盈利: ${wins} 笔, 亏损: ${losses} 笔
- 总盈亏: $${totalPnL.toFixed(2)}
- 交易详情:
${dayTrades.map(t => `  ${t.instrumentCode} ${t.direction}: $${t.pnl?.toFixed(2)}`).join('\n')}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const summary = await callDeepSeek(messages, { maxTokens: 300 });
  
  return {
    success: true,
    date,
    stats: { totalTrades: dayTrades.length, wins, losses, totalPnL },
    summary,
  };
}

export default {
  analyzeTradesWithAI,
  analyzeSingleTrade,
  chatWithAI,
  generateDailySummary,
};
