/**
 * 交易计算工具函数（统一复用）
 * 
 * 之前这些函数在 7+ 个文件中被重复定义。
 * 现在统一在此处维护，所有页面共享同一份代码。
 */

/**
 * 计算单笔交易手续费（双边：开仓 + 平仓）
 * @param {Object} trade - 交易对象
 * @param {Array} instruments - 品种配置列表
 * @returns {number} 手续费金额
 */
export const calculateTradeFee = (trade, instruments) => {
  const tradeCode = trade.instrumentCode || trade.instrument || trade.symbol;
  const instrument = instruments?.find(i =>
    i.code === tradeCode ||
    i.code?.toUpperCase() === tradeCode?.toUpperCase()
  );
  const feeRate = instrument?.feeRate || 0;
  const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
  return feeRate * quantity * 2;
};

/**
 * 计算单笔交易净盈亏（毛盈亏 - 手续费）
 * @param {Object} trade - 交易对象
 * @param {Array} instruments - 品种配置列表
 * @returns {number} 净盈亏
 */
export const getNetPnL = (trade, instruments) => {
  return (trade.pnl || 0) - calculateTradeFee(trade, instruments);
};

/**
 * TICK 值查询表（默认值，用户可在品种设置中覆盖）
 */
export const TICK_VALUES = {
  'MNQ': 0.5, 'NQ': 5, 'MES': 1.25, 'ES': 12.5,
  'YM': 5, 'MYM': 0.5, 'RTY': 5, 'M2K': 0.5,
  'GC': 10, 'MGC': 1, 'SI': 25, 'SIL': 5,
  'CL': 10, 'MCL': 1, 'NG': 10, 'HG': 12.5,
  'ZB': 31.25, 'ZN': 15.625, '6E': 12.5, '6J': 12.5,
};

/**
 * 获取品种的 tick value
 */
export const getTickValue = (instrumentCode, instruments) => {
  const instrument = instruments?.find(i => i.code === instrumentCode);
  if (instrument?.tickValue) return instrument.tickValue;
  return TICK_VALUES[instrumentCode] || 5;
};

/**
 * 将 tick 数转换为 USD
 */
export const ticksToUSD = (ticks, instrumentCode, quantity, instruments) => {
  if (ticks === undefined || ticks === null) return 0;
  const tickValue = getTickValue(instrumentCode, instruments);
  return ticks * tickValue * Math.abs(quantity || 1);
};
