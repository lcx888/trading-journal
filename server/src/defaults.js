export const DEFAULT_INSTRUMENTS = [
  // 指数期货
  { code: 'ES', name: '标普500期货', feeRate: 4.36, tickValue: 12.5, initialCapital: 10000, atasPattern: '^ES[A-Z]?\\d*(@CME)?$' },
  { code: 'NQ', name: '纳斯达克期货', feeRate: 4, tickValue: 5, initialCapital: 10000, atasPattern: '^NQ[A-Z]?\\d*(@CME)?$' },
  { code: 'YM', name: '道琼斯期货', feeRate: 4, tickValue: 5, initialCapital: 10000, atasPattern: '^YM[A-Z]?\\d*(@CME)?$' },
  { code: 'RTY', name: '罗素2000期货', feeRate: 4, tickValue: 5, initialCapital: 10000, atasPattern: '^RTY[A-Z]?\\d*(@CME)?$' },
  // 微型期货
  { code: 'MES', name: '微型标普', feeRate: 0.62, tickValue: 1.25, initialCapital: 2000, atasPattern: '^MES[A-Z]?\\d*(@CME)?$' },
  { code: 'MNQ', name: '微型纳指', feeRate: 0.62, tickValue: 0.5, initialCapital: 2000, atasPattern: '^MNQ[A-Z]?\\d*(@CME)?$' },
  { code: 'M2K', name: '微型罗素', feeRate: 0.62, tickValue: 0.5, initialCapital: 2000, atasPattern: '^M2K[A-Z]?\\d*(@CME)?$' },
  // 贵金属
  { code: 'GC', name: '黄金期货', feeRate: 4.44, tickValue: 10, initialCapital: 10000, atasPattern: '^GC[A-Z]?\\d*(@NYMEX)?$' },
  { code: 'SI', name: '白银期货', feeRate: 4, tickValue: 25, initialCapital: 8000, atasPattern: '^SI[A-Z]?\\d*(@NYMEX)?$' },
  { code: 'MGC', name: '微型黄金', feeRate: 1.25, tickValue: 1, initialCapital: 1000, atasPattern: '^MGC[A-Z]?\\d*(@NYMEX)?$' },
  // 能源
  { code: 'CL', name: '原油期货', feeRate: 4, tickValue: 10, initialCapital: 5000, atasPattern: '^CL[A-Z]?\\d*(@NYMEX)?$' },
  { code: 'MCL', name: '微型原油', feeRate: 0.62, tickValue: 1, initialCapital: 500, atasPattern: '^MCL[A-Z]?\\d*(@NYMEX)?$' },
  { code: 'NG', name: '天然气期货', feeRate: 4, tickValue: 10, initialCapital: 3000, atasPattern: '^NG[A-Z]?\\d*(@NYMEX)?$' },
];
