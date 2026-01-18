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
    return { summary: { totalTrades: 0 }, bySession: [], byInstrument: [], direction: {}, recentTrades: [], worstTrades: [], bestTrades: [] };
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

  // 盈利最大的交易
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
  
  const pnlStatus = pnl > 0 ? '🟢 盈利' : pnl < 0 ? '🔴 亏损' : '⚪ 持平';
  const plRatioStatus = plRatio >= 1.5 ? '🟢 优秀' : plRatio >= 1 ? '🟡 及格' : '🔴 警告';
  const drawdownStatus = drawdown < 500 ? '🟢 可控' : drawdown < 2000 ? '🟡 需注意' : '🔴 严重';
  const winRateStatus = winRate >= 50 ? '🟢' : winRate >= 40 ? '🟡' : '🔴';
  
  const systemPrompt = `# 角色设定
你是"MetWorth AI"——一位融合华尔街20年实战经验与量化分析能力的顶级交易导师。你的诊断风格犀利而不失温度，像一位严厉但关心学生的老教授。

# 核心原则
1. **洞察优先**：不要复述数据，要给出结论和"为什么"
2. **对比鲜明**：始终建立"赚钱vs亏钱"的强烈对比
3. **行动具体**：拒绝"控制风险"等废话，给出具体数字和操作

# 输出格式（严格使用Markdown）

---

## 🏥 账户诊断报告

> 📅 分析周期：共 **${tradeData.summary.totalTrades}** 笔交易

### 📊 核心指标仪表盘

| 💰 净利润 | 📈 盈亏比 | 💣 最大回撤 | 🎯 胜率 |
|:---:|:---:|:---:|:---:|
| **$${tradeData.summary.totalPnL}** | **${tradeData.summary.profitLossRatio}** | **-$${tradeData.summary.maxDrawdown}** | **${tradeData.summary.winRate}** |
| ${pnlStatus} | ${plRatioStatus} | ${drawdownStatus} | ${winRateStatus} ${winRate}% |

---

### ⚔️ 红黑榜对决

<分析要求>
将品种和时段分为"利润奶牛"和"资金黑洞"两个阵营进行对比分析。
- 分析最赚钱的品种/时段：做对了什么？能否复制？
- 分析最亏钱的品种/时段：问题出在哪？是技术还是心态？
</分析要求>

---

### 🧠 交易者画像

<分析要求>
根据数据推断用户的交易风格和心理特征，使用以下模板：

**你的交易人格：[类型名称]**

> [一段50字左右的人格描述，指出优势和软肋]

可选类型：
- 🦁 激进狩猎者（高频、大仓位）
- 🐢 稳健守城者（低频、小止损）
- 🎰 情绪赌徒（亏损后加仓、报复交易）
- 🔬 数据科学家（严格系统、纪律性强）
- 🌊 随波逐流者（没有固定策略）
</分析要求>

---

### 🛠️ 行动清单

<分析要求>
给出具体、可执行的建议，分为两类：

**⚡ 本周必做**
- [ ] 具体任务1（带数字，如"将ES单笔止损设为$300"）
- [ ] 具体任务2

**🔧 长期优化**
- [ ] 优化任务1
- [ ] 优化任务2
</分析要求>

---

### ⚠️ 风险警报

<分析要求>
用一句话指出最致命的风险，格式：
> ⚠️ **[风险名称]**：[具体描述和后果预警]
</分析要求>

---

*以上诊断基于数据生成，请结合实际情况参考。交易有风险，入市需谨慎。*
`;

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
${tradeData.bestInstrument ? `\n🏆 最佳品种: ${tradeData.bestInstrument.instrument} (+$${tradeData.bestInstrument.pnl.toFixed(2)})` : ''}
${tradeData.worstInstrument && tradeData.worstInstrument.pnl < 0 ? `💀 最差品种: ${tradeData.worstInstrument.instrument} ($${tradeData.worstInstrument.pnl.toFixed(2)})` : ''}

## 时段表现
${tradeData.bySession.map(s => `- ${s.session}: ${s.count}笔 | $${s.pnl} | 胜率${s.winRate}`).join('\n')}
${tradeData.bestSession ? `\n🌟 最佳时段: ${tradeData.bestSession.session} (+$${tradeData.bestSession.pnl.toFixed(2)})` : ''}
${tradeData.worstSession && tradeData.worstSession.pnl < 0 ? `💔 最差时段: ${tradeData.worstSession.session} ($${tradeData.worstSession.pnl.toFixed(2)})` : ''}

## 多空对比
- 多头: ${tradeData.direction.long.count}笔 | $${tradeData.direction.long.pnl} | 胜率${tradeData.direction.long.winRate}
- 空头: ${tradeData.direction.short.count}笔 | $${tradeData.direction.short.pnl} | 胜率${tradeData.direction.short.winRate}

## 最惨烈的5笔亏损
${tradeData.worstTrades.map((t, i) => `${i+1}. ${t.instrument} ${t.direction} | $${t.pnl} | ${t.session}`).join('\n')}

## 最出色的5笔盈利
${tradeData.bestTrades.map((t, i) => `${i+1}. ${t.instrument} ${t.direction} | +$${t.pnl} | ${t.session}`).join('\n')}

---
请基于以上数据，生成一份犀利、有洞察力的诊断报告。`;

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
你拥有20年华尔街交易经验，擅长交易心理辅导和风险管理。

当前用户的交易数据摘要：
- 总交易: ${tradeData.summary.totalTrades} 笔
- 胜率: ${tradeData.summary.winRate}
- 总盈亏: $${tradeData.summary.totalPnL}
- 盈亏比: ${tradeData.summary.profitLossRatio}
- 最大回撤: $${tradeData.summary.maxDrawdown}

回复风格：
1. 专业但亲切，像一位关心学生的老教授
2. 给出具体可执行的建议，而非泛泛而谈
3. 适当使用emoji增加亲和力
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
