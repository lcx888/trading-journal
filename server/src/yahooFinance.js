/**
 * Yahoo Finance 服务
 * 用于获取期货历史数据并计算 MAE/MFE/ETD
 */
import yahooFinance from 'yahoo-finance2';

// ATAS 期货代码映射到 Yahoo Finance 代码
const SYMBOL_MAP = {
  // E-mini S&P 500
  'ES': 'ES=F',
  'ESH': 'ES=F',
  'ESM': 'ES=F',
  'ESU': 'ES=F',
  'ESZ': 'ES=F',
  
  // E-mini Nasdaq
  'NQ': 'NQ=F',
  'NQH': 'NQ=F',
  'NQM': 'NQ=F',
  'NQU': 'NQ=F',
  'NQZ': 'NQ=F',
  
  // Mini Dow
  'YM': 'YM=F',
  'YMH': 'YM=F',
  'YMM': 'YM=F',
  'YMU': 'YM=F',
  'YMZ': 'YM=F',
  
  // Crude Oil
  'CL': 'CL=F',
  'CLF': 'CL=F',
  'CLG': 'CL=F',
  'CLH': 'CL=F',
  'CLJ': 'CL=F',
  'CLK': 'CL=F',
  'CLM': 'CL=F',
  'CLN': 'CL=F',
  'CLQ': 'CL=F',
  'CLU': 'CL=F',
  'CLV': 'CL=F',
  'CLX': 'CL=F',
  'CLZ': 'CL=F',
  
  // Gold
  'GC': 'GC=F',
  'GCG': 'GC=F',
  'GCJ': 'GC=F',
  'GCM': 'GC=F',
  'GCQ': 'GC=F',
  'GCV': 'GC=F',
  'GCZ': 'GC=F',
  
  // Silver
  'SI': 'SI=F',
  
  // Natural Gas
  'NG': 'NG=F',
  
  // Euro FX
  '6E': 'EURUSD=X',
  
  // Micro E-mini S&P 500
  'MES': 'ES=F',
  
  // Micro E-mini Nasdaq
  'MNQ': 'NQ=F',
  
  // Micro Gold
  'MGC': 'GC=F',
  
  // Micro Crude Oil
  'MCL': 'CL=F',
};

/**
 * 从 ATAS 代码获取 Yahoo Finance 代码
 */
export function getYahooSymbol(atasCode) {
  if (!atasCode) return null;
  
  // 移除数字后缀 (如 ESH25 -> ESH)
  const baseCode = atasCode.replace(/\d+$/, '').toUpperCase();
  
  // 尝试完整匹配
  if (SYMBOL_MAP[baseCode]) {
    return SYMBOL_MAP[baseCode];
  }
  
  // 尝试只用前两个字母
  const shortCode = baseCode.substring(0, 2);
  if (SYMBOL_MAP[shortCode]) {
    return SYMBOL_MAP[shortCode];
  }
  
  // 返回原始代码加 =F
  return `${shortCode}=F`;
}

/**
 * 获取指定时间范围的历史数据
 * @param {string} symbol - Yahoo Finance 代码
 * @param {Date} startTime - 开始时间
 * @param {Date} endTime - 结束时间
 * @returns {Array} 历史价格数据
 */
export async function getHistoricalData(symbol, startTime, endTime) {
  try {
    // 扩展时间范围确保包含交易时段
    const queryStart = new Date(startTime);
    queryStart.setMinutes(queryStart.getMinutes() - 5);
    
    const queryEnd = new Date(endTime);
    queryEnd.setMinutes(queryEnd.getMinutes() + 5);
    
    const result = await yahooFinance.chart(symbol, {
      period1: queryStart,
      period2: queryEnd,
      interval: '1m', // 1分钟级别
    });
    
    if (!result || !result.quotes || result.quotes.length === 0) {
      console.log(`无法获取 ${symbol} 在 ${startTime} - ${endTime} 的数据`);
      return null;
    }
    
    return result.quotes;
  } catch (error) {
    console.error(`获取 ${symbol} 历史数据失败:`, error.message);
    return null;
  }
}

/**
 * 计算单笔交易的 MAE/MFE/ETD
 * @param {Object} trade - 交易数据
 * @returns {Object} { mae, mfe, etd }
 */
export async function calculateTradeMetrics(trade) {
  const data = typeof trade.data === 'string' ? JSON.parse(trade.data) : trade.data;
  
  // 需要的数据：合约代码、开仓时间、平仓时间、开仓价、平仓价、方向
  const instrumentCode = data.instrumentCode || trade.instrumentCode;
  const openTime = data.openTime ? new Date(data.openTime) : null;
  const closeTime = data.closeTime ? new Date(data.closeTime) : null;
  const entryPrice = parseFloat(data.entryPrice) || 0;
  const exitPrice = parseFloat(data.exitPrice) || 0;
  const direction = data.direction || 'long'; // 'long' 或 'short'
  
  if (!instrumentCode || !openTime || !closeTime || !entryPrice) {
    return { mae: null, mfe: null, etd: null, error: '数据不完整' };
  }
  
  const yahooSymbol = getYahooSymbol(instrumentCode);
  if (!yahooSymbol) {
    return { mae: null, mfe: null, etd: null, error: '无法识别合约代码' };
  }
  
  const quotes = await getHistoricalData(yahooSymbol, openTime, closeTime);
  if (!quotes || quotes.length === 0) {
    return { mae: null, mfe: null, etd: null, error: '无法获取历史数据' };
  }
  
  // 过滤出交易时段内的数据
  const tradeQuotes = quotes.filter(q => {
    const time = new Date(q.date);
    return time >= openTime && time <= closeTime;
  });
  
  if (tradeQuotes.length === 0) {
    return { mae: null, mfe: null, etd: null, error: '交易时段无数据' };
  }
  
  // 计算最高价和最低价
  let highPrice = -Infinity;
  let lowPrice = Infinity;
  
  for (const quote of tradeQuotes) {
    if (quote.high && quote.high > highPrice) highPrice = quote.high;
    if (quote.low && quote.low < lowPrice) lowPrice = quote.low;
  }
  
  let mae, mfe, etd;
  
  if (direction.toLowerCase() === 'long' || direction === '多') {
    // 多头：
    // MAE = 入场价 - 最低价 (最大不利偏移，正值表示亏损幅度)
    // MFE = 最高价 - 入场价 (最大有利偏移，正值表示盈利幅度)
    // ETD = 最高价 - 出场价 (回撤，从最高点到出场的距离)
    mae = entryPrice - lowPrice;
    mfe = highPrice - entryPrice;
    etd = highPrice - exitPrice;
  } else {
    // 空头：
    // MAE = 最高价 - 入场价 (最大不利偏移)
    // MFE = 入场价 - 最低价 (最大有利偏移)
    // ETD = 出场价 - 最低价 (回撤)
    mae = highPrice - entryPrice;
    mfe = entryPrice - lowPrice;
    etd = exitPrice - lowPrice;
  }
  
  // 确保值为正数或0
  mae = Math.max(0, mae);
  mfe = Math.max(0, mfe);
  etd = Math.max(0, etd);
  
  return {
    mae: parseFloat(mae.toFixed(4)),
    mfe: parseFloat(mfe.toFixed(4)),
    etd: parseFloat(etd.toFixed(4)),
    highPrice,
    lowPrice,
    quotes: tradeQuotes.length
  };
}

/**
 * 批量计算多笔交易的 MAE/MFE/ETD
 * @param {Array} trades - 交易数组
 * @returns {Array} 带有 MAE/MFE/ETD 的交易数组
 */
export async function calculateBatchMetrics(trades) {
  const results = [];
  
  for (const trade of trades) {
    try {
      const metrics = await calculateTradeMetrics(trade);
      results.push({
        id: trade.id,
        ...metrics
      });
      
      // 避免请求过快被限制
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`计算交易 ${trade.id} 指标失败:`, error.message);
      results.push({
        id: trade.id,
        mae: null,
        mfe: null,
        etd: null,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * 添加自定义代码映射
 */
export function addSymbolMapping(atasCode, yahooCode) {
  SYMBOL_MAP[atasCode.toUpperCase()] = yahooCode;
}

/**
 * 获取所有支持的代码
 */
export function getSupportedSymbols() {
  return Object.keys(SYMBOL_MAP);
}
