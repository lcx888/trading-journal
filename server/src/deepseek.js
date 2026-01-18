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

/**
 * 准备交易数据摘要
 */
function prepareTradesSummary(trades) {
  if (!trades || trades.length === 0) {
    return { summary: { totalTrades: 0 }, bySession: [], byInstrument: [], direction: {}, recentTrades: [], worstTrades: [] };
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

  // 亏损最大的交易
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
    }));

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
  
  const systemPrompt = `你是一位专业的期货交易分析师，拥有丰富的量化分析和交易心理学经验。
你的任务是分析用户的交易数据，识别问题模式，并提供具体、可执行的改进建议。

分析要求：
1. 客观分析数据，不要过度美化或贬低
2. 识别交易中的关键问题和优势
3. 提供具体的、可执行的改进建议
4. 关注交易心理和风险管理
5. 使用简洁专业的语言

输出格式要求：
请使用 Markdown 格式输出分析报告，包含以下章节：
## 📊 整体评估
## 🎯 核心问题
## ✅ 交易优势
## 💡 改进建议
## ⚠️ 风险提示`;

  const userPrompt = `请分析以下交易数据：

**基础统计：**
- 总交易笔数: ${tradeData.summary.totalTrades}
- 盈利笔数: ${tradeData.summary.winningTrades}
- 亏损笔数: ${tradeData.summary.losingTrades}
- 总盈亏: $${tradeData.summary.totalPnL}
- 胜率: ${tradeData.summary.winRate}
- 平均盈利: $${tradeData.summary.avgProfit}
- 平均亏损: $${tradeData.summary.avgLoss}
- 盈亏比: ${tradeData.summary.profitLossRatio}
- 最大回撤: $${tradeData.summary.maxDrawdown}
- 最长连续亏损: ${tradeData.summary.maxLossStreak} 笔 (共亏损 $${tradeData.summary.maxLossStreakPnL})
- 大额亏损(>$200): ${tradeData.summary.largeLossCount} 笔

**时段表现：**
${tradeData.bySession.map(s => `- ${s.session}: ${s.count}笔, 盈亏$${s.pnl}, 胜率${s.winRate}`).join('\n')}

**品种表现：**
${tradeData.byInstrument.map(i => `- ${i.instrument}: ${i.count}笔, 盈亏$${i.pnl}, 胜率${i.winRate}`).join('\n')}

**多空对比：**
- 多头: ${tradeData.direction.long.count}笔, 盈亏$${tradeData.direction.long.pnl}, 胜率${tradeData.direction.long.winRate}
- 空头: ${tradeData.direction.short.count}笔, 盈亏$${tradeData.direction.short.pnl}, 胜率${tradeData.direction.short.winRate}

**亏损最大的5笔交易：**
${tradeData.worstTrades.map(t => `- ${t.time} ${t.instrument} ${t.direction}: $${t.pnl} (${t.session})`).join('\n')}

请基于以上数据，提供专业的分析报告。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const analysis = await callDeepSeek(messages, options);
  
  return {
    success: true,
    analysis,
    tradeData,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 分析单笔交易
 */
export async function analyzeSingleTrade(trade) {
  const systemPrompt = `你是一位专业的期货交易教练。请分析这笔交易，提供简洁的复盘建议。
回复要求：简洁明了，不超过200字，直接给出核心问题和改进建议。`;

  const tradeInfo = `交易详情：
- 品种: ${trade.instrumentCode}
- 方向: ${trade.direction === 'LONG' ? '多' : '空'}
- 盈亏: $${trade.pnl?.toFixed(2)}
- 时段: ${trade.marketSession || '未知'}
- 开仓时间: ${trade.openTime}
- 平仓时间: ${trade.closeTime}
${trade.ticks ? `- Ticks: ${trade.ticks}` : ''}
${trade.notes ? `- 备注: ${trade.notes}` : ''}

请分析这笔交易的问题和改进建议。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: tradeInfo },
  ];

  const analysis = await callDeepSeek(messages, { maxTokens: 500 });
  
  return { success: true, analysis };
}

/**
 * AI 交易问答
 */
export async function chatWithAI(userMessage, trades = [], chatHistory = []) {
  const tradeData = prepareTradesSummary(trades);
  
  const systemPrompt = `你是一位专业的期货交易顾问，名叫"MetWorth AI"。
你可以回答用户关于交易策略、风险管理、交易心理等问题。

当前用户的交易数据摘要：
- 总交易: ${tradeData.summary.totalTrades} 笔
- 胜率: ${tradeData.summary.winRate}
- 总盈亏: $${tradeData.summary.totalPnL}
- 盈亏比: ${tradeData.summary.profitLossRatio}

请基于用户的实际数据提供个性化建议。回复要简洁专业。`;

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
