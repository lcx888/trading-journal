/**
 * ATAS 文件解析服务
 * 解析 ATAS_statistics_realtime_*.xlsx 文件
 */
import * as XLSX from 'xlsx';
import { StorageService } from './storage';
import { convertUTCToCST, getMarketSession } from '../utils/timezone';

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

// 解析Excel日期（ATAS文件中的时间是UTC+0）
// 返回转换为UTC+8（中国时间）的Date对象
const parseExcelDate = (excelDate) => {
  if (!excelDate) return null;
  
  let utcDate = null;
  
  if (excelDate instanceof Date) {
    // 如果已经是 Date 对象，假设它是 UTC 时间
    // 创建一个新的 Date 对象，使用 UTC 时间戳
    const utcTimestamp = Date.UTC(
      excelDate.getUTCFullYear(),
      excelDate.getUTCMonth(),
      excelDate.getUTCDate(),
      excelDate.getUTCHours(),
      excelDate.getUTCMinutes(),
      excelDate.getUTCSeconds(),
      excelDate.getUTCMilliseconds()
    );
    utcDate = new Date(utcTimestamp);
  } else if (typeof excelDate === 'string') {
    // 字符串格式，尝试解析为 UTC 时间
    // 如果字符串包含 'Z' 或 '+00:00'，表示 UTC 时间
    if (excelDate.includes('Z') || excelDate.includes('+00:00')) {
      utcDate = new Date(excelDate);
    } else {
      // 否则假设是 UTC 时间字符串，添加 'Z' 后缀
      utcDate = new Date(excelDate.endsWith('Z') ? excelDate : excelDate + 'Z');
    }
    if (isNaN(utcDate.getTime())) return null;
  } else if (typeof excelDate === 'number') {
    // Excel日期是从1900年1月1日开始的天数
    // Excel 日期基准：1900-01-01 00:00:00
    // JavaScript Date 基准：1970-01-01 00:00:00 UTC
    // 差值：25569 天（注意：Excel 错误地将 1900 年视为闰年，所以实际是 25568）
    // 但 xlsx.js 库已经处理了这个差异，所以我们使用标准公式
    const utcTimestamp = (excelDate - 25569) * 86400 * 1000;
    // 使用 Date.UTC 确保创建的是 UTC 时间
    utcDate = new Date(utcTimestamp);
  } else {
    return null;
  }
  
  // 验证日期有效性
  if (isNaN(utcDate.getTime())) return null;
  
  // 将UTC+0时间转换为UTC+8（中国时间）
  return convertUTCToCST(utcDate);
};

// 生成唯一ID
const generateTradeId = (trade) => {
  const openTime = trade.openTime ? trade.openTime.getTime() : Date.now();
  return `${trade.instrumentCode}_${openTime}_${trade.openPrice}_${Math.random().toString(36).substr(2, 9)}`;
};

// 解析日志工作表
const parseTradeLog = (worksheet, instruments) => {
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
    
    const openTime = parseExcelDate(row[columnMap.openTime]);
    const closeTime = parseExcelDate(row[columnMap.closeTime]);
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
        };

        // 解析各个工作表
        const sheetNames = workbook.SheetNames;
        
        // 查找日志工作表
        const logSheet = sheetNames.find(name => 
          name.includes('日志') || name.toLowerCase().includes('log')
        );
        if (logSheet) {
          const { trades, newInstruments } = parseTradeLog(workbook.Sheets[logSheet], instruments);
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
    const isDuplicate = existingTrades.some(existing => 
      existing.symbol === trade.symbol &&
      existing.openTime?.getTime() === trade.openTime?.getTime() &&
      existing.openPrice === trade.openPrice &&
      existing.openQuantity === trade.openQuantity
    );

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

