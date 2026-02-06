/**
 * ATAS 文件解析服务
 * 解析 ATAS_statistics_realtime_*.xlsx 文件
 */
// XLSX 动态导入 - 仅在解析文件时按需加载 (~400KB)
let XLSX = null;
const ensureXLSX = async () => {
  if (!XLSX) XLSX = await import('xlsx');
  return XLSX;
};
import { StorageService } from './storage';
import { getMarketSession } from '../utils/timezone';

// 时区偏移量（分钟）映射表
const TIMEZONE_OFFSETS = {
  'Asia/Shanghai': 480,      // UTC+8
  'Asia/Hong_Kong': 480,     // UTC+8
  'Asia/Singapore': 480,     // UTC+8
  'Asia/Tokyo': 540,         // UTC+9
  'Asia/Seoul': 540,         // UTC+9
  'Asia/Dubai': 240,         // UTC+4
  'Europe/London': 0,        // UTC+0 (冬令时)
  'Europe/Paris': 60,        // UTC+1 (冬令时)
  'Europe/Berlin': 60,       // UTC+1 (冬令时)
  'America/New_York': -300,  // UTC-5 (冬令时)
  'America/Chicago': -360,   // UTC-6 (冬令时)
  'America/Los_Angeles': -480, // UTC-8 (冬令时)
  'America/Toronto': -300,   // UTC-5 (冬令时)
  'Australia/Sydney': 600,   // UTC+10 (冬令时)
  'Pacific/Auckland': 720,   // UTC+12 (冬令时)
};

/**
 * 获取时区偏移量（分钟）
 * 考虑夏令时
 */
const getTimezoneOffset = (timezone, date) => {
  // 简化处理：使用基础偏移量
  // 完整实现需要考虑夏令时，这里用 Intl API 来获取精确偏移
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart) {
      // 解析 "GMT+8" 或 "GMT-5" 格式
      const match = tzPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3] || '0', 10);
        return sign * (hours * 60 + minutes);
      }
    }
  } catch (e) {
    // fallback to static offset
  }
  return TIMEZONE_OFFSETS[timezone] || 0;
};

/**
 * 将日期从源时区转换为 UTC 时间
 * 
 * 重要说明：
 * - XLSX 库使用 cellDates: true 时，把 Excel 日期数值解析为 UTC 时间戳
 * - 但 Excel 中的时间实际上代表的是 fromTimezone（数据源时区）的本地时间
 * - 我们需要修正：把"被误解为 UTC"的时间，转换为真正的 UTC 时间
 * 
 * 例如：Excel 中 20:01:29，dataSourceTimezone = UTC+0 (伦敦)
 * - XLSX 解析后 getUTCHours() = 20
 * - fromOffset = 0
 * - 真正的 UTC = 20:01:29 - 0 = 20:01:29 ✓
 * 
 * 例如：Excel 中 12:00:00，dataSourceTimezone = UTC-6 (芝加哥)
 * - XLSX 解析后 getUTCHours() = 12
 * - fromOffset = -360 (分钟)
 * - 真正的 UTC = 12:00 - (-6小时) = 18:00 ✓
 */
const convertTimezone = (date, fromTimezone, toTimezone) => {
  if (!date) return date;
  
  // 获取数据源时区的偏移量（分钟）
  // 例如：UTC+8 返回 480，UTC-6 返回 -360
  const fromOffset = getTimezoneOffset(fromTimezone, date);
  
  // XLSX 把 Excel 时间当作 UTC 解析，但实际上这是 fromTimezone 的本地时间
  // 要得到真正的 UTC 时间，需要减去 fromTimezone 的偏移量
  // 公式：真正的UTC = 被误解的UTC - fromOffset
  // 
  // 举例：Excel 显示 20:01:29，fromTimezone = UTC+0
  // - XLSX 解析为 UTC 20:01:29（getUTCHours=20）
  // - fromOffset = 0
  // - 真正的 UTC = 20:01:29 - 0 = 20:01:29 ✓
  //
  // 举例：Excel 显示 12:00:00，fromTimezone = UTC-6
  // - XLSX 解析为 UTC 12:00:00（getUTCHours=12）
  // - fromOffset = -360 分钟 = -6 小时
  // - 真正的 UTC = 12:00 - (-6小时) = 18:00 ✓
  const realUTCTime = date.getTime() - fromOffset * 60 * 1000;
  
  return new Date(realUTCTime);
};

// 品种代码映射 - 支持更多品种和格式
// 注：正则需要支持各种交易所后缀，如 @CME, @CME_Ind, @NYMEX, @COMEX, @NYMEX_Com 等
// 重要：更长的前缀必须放在更短的前缀之前（如 MES 在 ES 之前），否则会被短前缀错误匹配
const INSTRUMENT_PATTERNS = {
  // 微型合约（放在标准合约之前以优先匹配）
  'MES': /MES[A-Z]?\d*@?CME/i,                     // 微型标普
  'MNQ': /MNQ[A-Z]?\d*@?CME/i,                     // 微型纳指
  'M2K': /M2K[A-Z]?\d*@?CME/i,                     // 微型罗素
  'MYM': /MYM[A-Z]?\d*@?CME/i,                     // 微型道指
  'MGC': /MGC[A-Z]?\d*@?(NYMEX|COMEX)/i,          // 微型黄金
  'MCL': /MCL[A-Z]?\d*@?(NYMEX|COMEX)/i,          // 微型原油
  // 标准合约
  'ES': /ES[A-Z]?\d*@?CME/i,                       // 标普期货
  'NQ': /NQ[A-Z]?\d*@?CME/i,                       // 纳指期货
  'RTY': /RTY[A-Z]?\d*@?CME/i,                     // 罗素期货
  'YM': /YM[A-Z]?\d*@?CME/i,                       // 道指期货
  'GC': /GC[A-Z]?\d*@?(NYMEX|COMEX)/i,            // 黄金期货
  'CL': /CL[A-Z]?\d*@?(NYMEX|COMEX)/i,            // 原油期货
  'SI': /SI[A-Z]?\d*@?(NYMEX|COMEX)/i,            // 白银期货
  'HG': /HG[A-Z]?\d*@?(NYMEX|COMEX)/i,            // 铜期货
  'NG': /NG[A-Z]?\d*@?(NYMEX|COMEX)/i,            // 天然气
  // 国债期货
  'ZB': /ZB[A-Z]?\d*@?(CME|CBOT)/i,               // 国债期货
  'ZN': /ZN[A-Z]?\d*@?(CME|CBOT)/i,               // 10年期国债
  // 外汇期货
  '6E': /6E[A-Z]?\d*@?CME/i,                       // 欧元期货
  '6J': /6J[A-Z]?\d*@?CME/i,                       // 日元期货
  '6A': /6A[A-Z]?\d*@?CME/i,                       // 澳元期货
  '6B': /6B[A-Z]?\d*@?CME/i,                       // 英镑期货
  '6C': /6C[A-Z]?\d*@?CME/i,                       // 加元期货
  // 加密货币期货
  'BTC': /BTC(USD|USDT)?@/i,                       // 比特币期货
  'ETH': /ETH(USD|USDT)?@/i,                       // 以太坊期货
};

// 从 ATAS 品种字符串推导代码
const deriveInstrumentCode = (atasSymbol) => {
  if (!atasSymbol) return null;
  const symbolStr = String(atasSymbol).trim();
  
  // 先尝试提取 @ 前面的部分
  const base = symbolStr.split('@')[0] || symbolStr;
  if (!base) return null;
  
  const upper = base.toUpperCase();
  
  // 尝试移除月份后缀（如 NQH26 -> NQ, ESH2026 -> ES）
  // 支持 XXYZ99 或 XXY9999 格式
  const withoutSuffix = upper.replace(/[A-Z]\d{2,4}$/i, '');
  
  // 提取基础品种代码
  const match = (withoutSuffix || upper).match(/^([A-Z0-9]{1,4})/);
  return match ? match[1] : null;
};

const buildDefaultInstrument = (code) => ({
  code,
  name: `${code}（自动识别）`,
  feeRate: 0,
  tickValue: 0,
  initialCapital: 0,
  atasPattern: `${code}.*@`,
});

// 解析品种代码
// 注意：先使用内置的精确模式匹配（已按长度排序），再用用户自定义模式
// 这样可以确保 MES 不会被 ES 的 pattern 错误匹配
const parseInstrumentCode = (atasSymbol, instruments = []) => {
  // 1. 首先尝试用户配置的精确匹配（必须从字符串开头匹配）
  for (const inst of instruments) {
    if (!inst?.atasPattern) continue;
    try {
      // 确保从字符串开头匹配，避免 ES 匹配到 MES
      const pattern = inst.atasPattern.startsWith('^') ? inst.atasPattern : `^${inst.atasPattern}`;
      const regex = new RegExp(pattern, 'i');
      if (regex.test(atasSymbol)) return inst.code;
    } catch (e) {
      // ignore invalid regex and continue
    }
  }

  // 2. 使用内置的精确模式（微型合约优先）
  for (const [code, pattern] of Object.entries(INSTRUMENT_PATTERNS)) {
    if (pattern.test(atasSymbol)) {
      return code;
    }
  }

  // 3. 尝试推导品种代码
  return deriveInstrumentCode(atasSymbol) || 'OTHER';
};

// 解析Excel日期
// 重要：Excel 日期数值不包含时区信息，我们把它解析为"原始时间"
// 然后由 convertTimezone 函数根据 dataSourceTimezone 设置进行正确的时区转换
const parseExcelDate = (excelDate) => {
  if (!excelDate) return null;
  
  let date = null;
  
  if (excelDate instanceof Date) {
    // XLSX 库使用 cellDates: true 时返回 Date 对象
    // 这个 Date 对象是 XLSX 把 Excel 数值当作 UTC 时间戳解析的结果
    // 我们需要"还原"出 Excel 中显示的原始时间值
    // 方法：取 UTC 时间部分，作为"原始时间"
    date = excelDate;
  } else if (typeof excelDate === 'string') {
    // 字符串格式，直接解析
    date = new Date(excelDate);
    if (isNaN(date.getTime())) return null;
  } else if (typeof excelDate === 'number') {
    // Excel日期是从1900年1月1日开始的天数（小数部分是时间）
    // 直接转换为 UTC 时间戳
    const msFromEpoch = (excelDate - 25569) * 24 * 60 * 60 * 1000;
    date = new Date(msFromEpoch);
  } else {
    return null;
  }
  
  // 验证日期有效性
  if (isNaN(date.getTime())) return null;
  
  return date;
};

// 生成唯一ID
const generateTradeId = (trade) => {
  const openTime = trade.openTime ? trade.openTime.getTime() : Date.now();
  return `${trade.instrumentCode}_${openTime}_${trade.openPrice}_${Math.random().toString(36).substr(2, 9)}`;
};

// 解析日志工作表
const parseTradeLog = (worksheet, instruments, dataSourceTimezone, userTimezone) => {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (data.length < 2) return { trades: [], newInstruments: [] };

  // 查找表头行
  const headerRow = data[0];
  const columnMap = {};
  
  // 中文列名映射
  const columnNames = {
    '账户': 'account',
    '品种': 'symbol',
    '开仓时间': 'openTime',
    '开仓价': 'openPrice',
    '开仓量': 'openQuantity',
    '平仓时间': 'closeTime',
    '平仓价': 'closePrice',
    '平仓量': 'closeQuantity',
    '价格盈亏': 'pricePnL',
    '利润(ticks)': 'ticks',
    'PnL': 'pnl',
    '备注': 'notes',
  };

  headerRow.forEach((col, idx) => {
    const mappedName = columnNames[col];
    if (mappedName) {
      columnMap[mappedName] = idx;
    }
  });

  const trades = [];
  const newInstruments = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const symbol = row[columnMap.symbol];
    if (!symbol) continue;

    const instrumentCode = parseInstrumentCode(symbol, instruments);
    let instrument = instruments.find(ins => ins.code === instrumentCode)
      || newInstruments.find(ins => ins.code === instrumentCode);
    if (!instrument && instrumentCode && instrumentCode !== 'OTHER') {
      instrument = buildDefaultInstrument(instrumentCode);
      newInstruments.push(instrument);
    }
    
    // 解析时间并进行时区转换
    let openTime = parseExcelDate(row[columnMap.openTime]);
    let closeTime = parseExcelDate(row[columnMap.closeTime]);
    
    // 将时间从数据源时区转换到用户时区
    if (openTime && dataSourceTimezone && userTimezone) {
      openTime = convertTimezone(openTime, dataSourceTimezone, userTimezone);
    }
    if (closeTime && dataSourceTimezone && userTimezone) {
      closeTime = convertTimezone(closeTime, dataSourceTimezone, userTimezone);
    }
    
    const openQuantity = Number(row[columnMap.openQuantity]) || 0;
    
    const trade = {
      id: null, // 稍后生成
      account: row[columnMap.account] || '',
      symbol: symbol,
      instrumentCode: instrumentCode,
      instrumentName: instrument?.name || instrumentCode,
      openTime: openTime,
      openPrice: Number(row[columnMap.openPrice]) || 0,
      openQuantity: openQuantity,
      closeTime: closeTime,
      closePrice: Number(row[columnMap.closePrice]) || 0,
      closeQuantity: Number(row[columnMap.closeQuantity]) || 0,
      pricePnL: Number(row[columnMap.pricePnL]) || 0,
      ticks: Number(row[columnMap.ticks]) || 0,
      pnl: Number(row[columnMap.pnl]) || 0,
      notes: row[columnMap.notes] || '',
      // 计算字段
      direction: openQuantity > 0 ? 'LONG' : 'SHORT',
      marketSession: getMarketSession(openTime),
      holdingSeconds: openTime && closeTime ? Math.round((closeTime - openTime) / 1000) : 0,
      // 策略标注（用户后续填写）
      expectedTrend: '',
      logicCategory: '',
      logicAnalysis: '',
      // 元数据
      importedAt: new Date(),
      // 记录时区信息
      sourceTimezone: dataSourceTimezone,
      displayTimezone: userTimezone,
    };

    trade.id = generateTradeId(trade);
    trades.push(trade);
  }

  return { trades, newInstruments };
};

// 解析统计数据工作表
const parseStatistics = (worksheet) => {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (data.length < 2) return {};

  const stats = {};
  const columnMap = { name: 0, total: 1, long: 2, short: 3 };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    
    const name = String(row[0]).trim();
    stats[name] = {
      total: Number(row[columnMap.total]) || 0,
      long: Number(row[columnMap.long]) || 0,
      short: Number(row[columnMap.short]) || 0,
    };
  }

  return stats;
};

// 解析交易情况工作表（委托订单）
const parseOrders = (worksheet) => {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (data.length < 2) return [];

  const headerRow = data[0];
  const columnNames = {
    '账户': 'account',
    '品种': 'symbol',
    '时间': 'time',
    '市场ID': 'marketId',
    '方向': 'direction',
    '价格': 'price',
    '交易量': 'quantity',
    '路径': 'route',
    '手续费': 'fee',
  };

  const columnMap = {};
  headerRow.forEach((col, idx) => {
    const mappedName = columnNames[col];
    if (mappedName) {
      columnMap[mappedName] = idx;
    }
  });

  const orders = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    orders.push({
      account: row[columnMap.account] || '',
      symbol: row[columnMap.symbol] || '',
      time: parseExcelDate(row[columnMap.time]),
      marketId: row[columnMap.marketId] || '',
      direction: row[columnMap.direction] || '',
      price: Number(row[columnMap.price]) || 0,
      quantity: Number(row[columnMap.quantity]) || 0,
      route: row[columnMap.route] || '',
      fee: Number(row[columnMap.fee]) || 0,
    });
  }

  return orders;
};

// 主解析函数
export const parseATASFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        await ensureXLSX();
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const instruments = await StorageService.getInstruments();
        
        // 获取时区设置
        const dataSourceTimezone = StorageService.getDataSourceTimezone();
        const userTimezone = StorageService.getUserTimezone();
        
        const result = {
          filename: file.name,
          importDate: new Date(),
          trades: [],
          statistics: {},
          orders: [],
          summary: {
            totalTrades: 0,
            totalPnL: 0,
            byInstrument: {},
          },
          // 记录使用的时区
          timezoneInfo: {
            dataSource: dataSourceTimezone,
            user: userTimezone,
          },
        };

        // 解析各个工作表
        const sheetNames = workbook.SheetNames;
        
        // 查找日志工作表
        const logSheet = sheetNames.find(name => 
          name.includes('日志') || name.toLowerCase().includes('log')
        );
        if (logSheet) {
          const { trades, newInstruments } = parseTradeLog(
            workbook.Sheets[logSheet], 
            instruments,
            dataSourceTimezone,
            userTimezone
          );
          result.trades = trades;
          if (newInstruments.length > 0) {
            const existingCodes = new Set(instruments.map(i => i.code));
            const toAdd = newInstruments.filter(i => !existingCodes.has(i.code));
            if (toAdd.length > 0) {
              await StorageService.saveInstruments([...instruments, ...toAdd]);
            }
          }
        }

        // 查找统计数据工作表
        const statsSheet = sheetNames.find(name => 
          name.includes('统计') || name.toLowerCase().includes('stat')
        );
        if (statsSheet) {
          result.statistics = parseStatistics(workbook.Sheets[statsSheet]);
        }

        // 查找交易情况工作表
        const ordersSheet = sheetNames.find(name => 
          name.includes('交易情况') || name.includes('委托') || name.toLowerCase().includes('order')
        );
        if (ordersSheet) {
          result.orders = parseOrders(workbook.Sheets[ordersSheet]);
        }

        // 计算汇总
        result.summary.totalTrades = result.trades.length;
        result.summary.totalPnL = result.trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        
        // 按品种分组统计
        result.trades.forEach(trade => {
          if (!result.summary.byInstrument[trade.instrumentCode]) {
            result.summary.byInstrument[trade.instrumentCode] = {
              count: 0,
              pnl: 0,
            };
          }
          result.summary.byInstrument[trade.instrumentCode].count++;
          result.summary.byInstrument[trade.instrumentCode].pnl += trade.pnl || 0;
        });

        resolve(result);
      } catch (error) {
        reject(new Error(`解析文件失败: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsArrayBuffer(file);
  });
};

// 检查重复交易
export const checkDuplicates = async (newTrades) => {
  const existingTrades = await StorageService.getAllTrades();
  const duplicates = [];
  const unique = [];

  newTrades.forEach(trade => {
    const isDuplicate = existingTrades.some(existing => {
      // 安全地比较时间，处理字符串和Date对象
      const existingTime = existing.openTime ? new Date(existing.openTime).getTime() : null;
      const tradeTime = trade.openTime ? new Date(trade.openTime).getTime() : null;
      
      return existing.symbol === trade.symbol &&
        existingTime === tradeTime &&
        existing.openPrice === trade.openPrice &&
        existing.openQuantity === trade.openQuantity;
    });

    if (isDuplicate) {
      duplicates.push(trade);
    } else {
      unique.push(trade);
    }
  });

  return { duplicates, unique };
};

export default {
  parseATASFile,
  checkDuplicates,
  parseInstrumentCode,
};

