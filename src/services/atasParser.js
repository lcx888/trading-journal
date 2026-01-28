/**
 * ATAS 文件解析服务
 * 解析 ATAS_statistics_realtime_*.xlsx 文件
 */
import * as XLSX from 'xlsx';
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
 * 将日期从源时区转换到目标时区
 */
const convertTimezone = (date, fromTimezone, toTimezone) => {
  if (!date || fromTimezone === toTimezone) return date;
  
  // 获取偏移量
  const fromOffset = getTimezoneOffset(fromTimezone, date);
  const toOffset = getTimezoneOffset(toTimezone, date);
  
  // 计算偏移差（分钟）
  const diffMinutes = toOffset - fromOffset;
  
  if (diffMinutes === 0) return date;
  
  // 创建新的日期对象，调整时间
  const newDate = new Date(date.getTime() + diffMinutes * 60 * 1000);
  return newDate;
};

// 品种代码映射
const INSTRUMENT_PATTERNS = {
  'GC': /GC[A-Z]\d+@NYMEX/i,
  'ES': /ES[A-Z]\d+@CME/i,
  'NQ': /NQ[A-Z]\d+@CME/i,
  'RTY': /RTY[A-Z]\d+@CME|M2K[A-Z]\d+@CME/i,
};

// 从 ATAS 品种字符串推导代码
const deriveInstrumentCode = (atasSymbol) => {
  if (!atasSymbol) return null;
  const base = String(atasSymbol).split('@')[0] || '';
  if (!base) return null;
  const upper = base.toUpperCase();
  const withoutSuffix = upper.replace(/[A-Z]\d+$/i, '');
  const match = (withoutSuffix || upper).match(/^[A-Z0-9]+/);
  return match ? match[0] : null;
};

const buildDefaultInstrument = (code) => ({
  code,
  name: `${code}（自动识别）`,
  feeRate: 0,
  tickValue: 0,
  initialCapital: 0,
  atasPattern: `${code}.*@`,
});

// 解析品种代码（优先已配置品种匹配）
const parseInstrumentCode = (atasSymbol, instruments = []) => {
  for (const inst of instruments) {
    if (!inst?.atasPattern) continue;
    try {
      const regex = new RegExp(inst.atasPattern, 'i');
      if (regex.test(atasSymbol)) return inst.code;
    } catch (e) {
      // ignore invalid regex and continue
    }
  }

  for (const [code, pattern] of Object.entries(INSTRUMENT_PATTERNS)) {
    if (pattern.test(atasSymbol)) {
      return code;
    }
  }

  return deriveInstrumentCode(atasSymbol) || 'OTHER';
};

// 解析Excel日期（ATAS导出的时间视为本地时间，直接使用不做转换）
const parseExcelDate = (excelDate) => {
  if (!excelDate) return null;
  
  let date = null;
  
  if (excelDate instanceof Date) {
    // 已经是 Date 对象，直接使用
    date = excelDate;
  } else if (typeof excelDate === 'string') {
    // 字符串格式，直接解析
    date = new Date(excelDate);
    if (isNaN(date.getTime())) return null;
  } else if (typeof excelDate === 'number') {
    // Excel日期是从1900年1月1日开始的天数（小数部分是时间）
    // 将Excel日期转换为日期时间各部分，然后创建本地时间
    const totalDays = excelDate - 25569; // 相对于1970-01-01的天数
    const wholeDays = Math.floor(totalDays);
    const timeFraction = totalDays - wholeDays; // 时间部分（0-1之间的小数）
    
    // 计算基准日期（1970-01-01）加上天数
    const baseDate = new Date(1970, 0, 1); // 本地时间1970-01-01
    baseDate.setDate(baseDate.getDate() + wholeDays);
    
    // 计算时间部分
    const totalSeconds = Math.round(timeFraction * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // 创建本地时间的Date对象
    date = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      hours,
      minutes,
      seconds
    );
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

