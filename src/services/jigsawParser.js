/**
 * Jigsaw RTP-Positions 文件解析服务
 * 解析 Jigsaw 交易平台导出的 RTP-Positions.xls 文件
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
 */
const getTimezoneOffset = (timezone, date) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart) {
      const match = tzPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3] || '0', 10);
        return sign * (hours * 60 + minutes);
      }
    }
  } catch (e) {
    // fallback
  }
  return TIMEZONE_OFFSETS[timezone] || 0;
};

/**
 * 将日期从源时区转换到目标时区
 */
const convertTimezone = (date, fromTimezone, toTimezone) => {
  if (!date || fromTimezone === toTimezone) return date;
  
  const fromOffset = getTimezoneOffset(fromTimezone, date);
  const toOffset = getTimezoneOffset(toTimezone, date);
  const diffMinutes = toOffset - fromOffset;
  
  if (diffMinutes === 0) return date;
  
  return new Date(date.getTime() + diffMinutes * 60 * 1000);
};

// 品种代码映射 - Jigsaw 格式
const INSTRUMENT_PATTERNS = {
  'GC': /^GC[A-Z]\d+$/i,      // 黄金期货 GCG26
  'ES': /^ES[A-Z]\d+$/i,      // 标普期货 ESH26
  'NQ': /^NQ[A-Z]\d+$/i,      // 纳指期货 NQH26
  'RTY': /^RTY[A-Z]\d+$/i,    // 罗素期货
  'CL': /^CL[A-Z]\d+$/i,      // 原油期货
  'SI': /^SI[A-Z]\d+$/i,      // 白银期货
  'YM': /^YM[A-Z]\d+$/i,      // 道指期货
  'ZB': /^ZB[A-Z]\d+$/i,      // 国债期货
  'ZN': /^ZN[A-Z]\d+$/i,      // 10年期国债
  '6E': /^6E[A-Z]\d+$/i,      // 欧元期货
  'M2K': /^M2K[A-Z]\d+$/i,    // 微型罗素
  'MES': /^MES[A-Z]\d+$/i,    // 微型标普
  'MNQ': /^MNQ[A-Z]\d+$/i,    // 微型纳指
  'MGC': /^MGC[A-Z]\d+$/i,    // 微型黄金
};

// 从 Jigsaw 品种字符串推导代码
const deriveInstrumentCode = (jigsawSymbol) => {
  if (!jigsawSymbol) return null;
  const upper = String(jigsawSymbol).toUpperCase().trim();
  
  // 移除月份和年份后缀 (如 NQH26 -> NQ)
  const match = upper.match(/^([A-Z0-9]+?)[A-Z]\d+$/);
  if (match) return match[1];
  
  return upper;
};

const buildDefaultInstrument = (code) => ({
  code,
  name: `${code}（Jigsaw 自动识别）`,
  feeRate: 0,
  tickValue: 0,
  initialCapital: 0,
  atasPattern: `${code}.*`,
});

// 解析品种代码
const parseInstrumentCode = (jigsawSymbol, instruments = []) => {
  if (!jigsawSymbol) return 'OTHER';
  
  // 先尝试匹配已配置的品种
  for (const inst of instruments) {
    if (!inst?.atasPattern) continue;
    try {
      const regex = new RegExp(inst.atasPattern, 'i');
      if (regex.test(jigsawSymbol)) return inst.code;
    } catch (e) {
      // ignore invalid regex
    }
  }

  // 使用内置模式匹配
  for (const [code, pattern] of Object.entries(INSTRUMENT_PATTERNS)) {
    if (pattern.test(jigsawSymbol)) {
      return code;
    }
  }

  return deriveInstrumentCode(jigsawSymbol) || 'OTHER';
};

// 解析 Jigsaw 日期时间格式 (2026/1/24 01:28:48)
const parseJigsawDate = (dateStr) => {
  if (!dateStr) return null;
  
  try {
    // Jigsaw 格式: "2026/1/24 01:28:48"
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    // 尝试手动解析
  }
  
  try {
    // 手动解析 YYYY/M/D HH:mm:ss 格式
    const parts = String(dateStr).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
      const [, year, month, day, hour, min, sec] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
    }
  } catch (e) {
    console.error('Date parse error:', e);
  }
  
  return null;
};

// 解析持仓时间 (01:44 或 23:11 格式)
const parseTimeInSeconds = (timeIn) => {
  if (!timeIn) return 0;
  const parts = String(timeIn).split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
};

// 解析盈亏金额 ($140.00 或 -$1,735.00 格式)
const parsePnL = (pnlStr) => {
  if (pnlStr === null || pnlStr === undefined) return 0;
  if (typeof pnlStr === 'number') return pnlStr;
  
  const str = String(pnlStr).trim();
  if (!str) return 0;
  
  // 移除 $ 符号和逗号，处理负号
  const cleaned = str.replace(/[$,]/g, '').trim();
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
};

// 生成唯一ID
const generateTradeId = (trade) => {
  const openTime = trade.openTime ? trade.openTime.getTime() : Date.now();
  return `jigsaw_${trade.instrumentCode}_${openTime}_${trade.openPrice}_${Math.random().toString(36).substr(2, 9)}`;
};

// 主解析函数
export const parseJigsawFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false }); // 不自动解析日期
        
        const instruments = await StorageService.getInstruments();
        
        // 获取时区设置
        const dataSourceTimezone = StorageService.getDataSourceTimezone();
        const userTimezone = StorageService.getUserTimezone();
        
        const result = {
          filename: file.name,
          importDate: new Date(),
          fileType: 'jigsaw',
          trades: [],
          summary: {
            totalTrades: 0,
            totalPnL: 0,
            byInstrument: {},
            byAccount: {},
          },
          // 记录使用的时区
          timezoneInfo: {
            dataSource: dataSourceTimezone,
            user: userTimezone,
          },
        };

        // 获取第一个工作表
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawData.length < 2) {
          reject(new Error('文件中没有足够的数据'));
          return;
        }

        // 解析表头
        const headerRow = rawData[0];
        const columnMap = {};
        
        // Jigsaw 列名映射
        const columnNames = {
          'Selection': 'selection',
          'Account': 'account',
          'Instrument': 'instrument',
          'Instrument Name': 'instrumentName',
          'Open': 'openTime',
          'Closed': 'closeTime',
          'Time in': 'timeIn',
          'Action': 'action',
          'Max Qty': 'maxQty',
          'Qty': 'qty',
          'Fills': 'fills',
          'Avg Price': 'avgPrice',
          'Open PnL': 'openPnL',
          'Closed PnL': 'closedPnL',
          'MAE': 'mae',
          'MFE': 'mfe',
          'Last Ask': 'lastAsk',
          'Last Bid': 'lastBid',
          'Last Price': 'lastPrice',
        };

        headerRow.forEach((col, idx) => {
          const mappedName = columnNames[col];
          if (mappedName) {
            columnMap[mappedName] = idx;
          }
        });

        // 检查必需列
        if (columnMap.instrument === undefined || columnMap.openTime === undefined) {
          reject(new Error('文件格式不正确，缺少必需的列（Instrument, Open）'));
          return;
        }

        const trades = [];
        const newInstruments = [];
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const instrumentSymbol = row[columnMap.instrument];
          if (!instrumentSymbol) continue;

          const instrumentCode = parseInstrumentCode(instrumentSymbol, instruments);
          let instrument = instruments.find(ins => ins.code === instrumentCode)
            || newInstruments.find(ins => ins.code === instrumentCode);
          if (!instrument && instrumentCode && instrumentCode !== 'OTHER') {
            instrument = buildDefaultInstrument(instrumentCode);
            newInstruments.push(instrument);
          }
          
          // 解析时间并进行时区转换
          let openTime = parseJigsawDate(row[columnMap.openTime]);
          let closeTime = parseJigsawDate(row[columnMap.closeTime]);
          
          // 将时间从数据源时区转换到用户时区
          if (openTime && dataSourceTimezone && userTimezone) {
            openTime = convertTimezone(openTime, dataSourceTimezone, userTimezone);
          }
          if (closeTime && dataSourceTimezone && userTimezone) {
            closeTime = convertTimezone(closeTime, dataSourceTimezone, userTimezone);
          }
          
          const action = String(row[columnMap.action] || '').toLowerCase();
          const closedPnL = parsePnL(row[columnMap.closedPnL]);
          const maxQty = Number(row[columnMap.maxQty]) || 0;
          const fills = Number(row[columnMap.fills]) || 0;
          const avgPrice = Number(row[columnMap.avgPrice]) || 0;
          const mae = Number(row[columnMap.mae]) || 0;
          const mfe = Number(row[columnMap.mfe]) || 0;
          const timeInSeconds = parseTimeInSeconds(row[columnMap.timeIn]);
          
          const trade = {
            id: null, // 稍后生成
            // 基础字段
            account: row[columnMap.account] || '',
            symbol: instrumentSymbol,
            instrumentCode: instrumentCode,
            instrumentName: row[columnMap.instrumentName] || instrument?.name || instrumentCode,
            openTime: openTime,
            closeTime: closeTime,
            openPrice: avgPrice, // Jigsaw 使用平均价格
            closePrice: avgPrice, // 同上
            openQuantity: maxQty,
            closeQuantity: maxQty,
            pnl: closedPnL,
            
            // 计算字段
            direction: action === 'buy' ? 'LONG' : 'SHORT',
            marketSession: getMarketSession(openTime),
            holdingSeconds: timeInSeconds,
            
            // Jigsaw 独有字段
            jigsawData: {
              action: row[columnMap.action],
              maxQty: maxQty,
              fills: fills,
              mae: mae, // 最大不利偏移 (ticks)
              mfe: mfe, // 最大有利偏移 (ticks)
              timeIn: row[columnMap.timeIn],
              openPnL: parsePnL(row[columnMap.openPnL]),
            },
            
            // 策略标注（用户后续填写）
            expectedTrend: '',
            logicCategory: '',
            logicAnalysis: '',
            
            // 元数据
            importedAt: new Date(),
            source: 'jigsaw',
          };

          trade.id = generateTradeId(trade);
          trades.push(trade);
        }

        // 保存新发现的品种
        if (newInstruments.length > 0) {
          const existingCodes = new Set(instruments.map(i => i.code));
          const toAdd = newInstruments.filter(i => !existingCodes.has(i.code));
          if (toAdd.length > 0) {
            await StorageService.saveInstruments([...instruments, ...toAdd]);
          }
        }

        // 计算汇总
        result.trades = trades;
        result.summary.totalTrades = trades.length;
        result.summary.totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        
        // 按品种分组统计
        trades.forEach(trade => {
          if (!result.summary.byInstrument[trade.instrumentCode]) {
            result.summary.byInstrument[trade.instrumentCode] = {
              count: 0,
              pnl: 0,
              totalMAE: 0,
              totalMFE: 0,
            };
          }
          result.summary.byInstrument[trade.instrumentCode].count++;
          result.summary.byInstrument[trade.instrumentCode].pnl += trade.pnl || 0;
          result.summary.byInstrument[trade.instrumentCode].totalMAE += trade.jigsawData?.mae || 0;
          result.summary.byInstrument[trade.instrumentCode].totalMFE += trade.jigsawData?.mfe || 0;
          
          // 按账户分组
          if (!result.summary.byAccount[trade.account]) {
            result.summary.byAccount[trade.account] = { count: 0, pnl: 0 };
          }
          result.summary.byAccount[trade.account].count++;
          result.summary.byAccount[trade.account].pnl += trade.pnl || 0;
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
export const checkJigsawDuplicates = async (newTrades) => {
  const existingTrades = await StorageService.getAllTrades();
  const duplicates = [];
  const unique = [];

  newTrades.forEach(trade => {
    const isDuplicate = existingTrades.some(existing => {
      // 安全地比较时间
      const existingTime = existing.openTime ? new Date(existing.openTime).getTime() : null;
      const tradeTime = trade.openTime ? new Date(trade.openTime).getTime() : null;
      
      return existing.symbol === trade.symbol &&
        existingTime === tradeTime &&
        existing.openPrice === trade.openPrice &&
        existing.openQuantity === trade.openQuantity &&
        existing.pnl === trade.pnl;
    });

    if (isDuplicate) {
      duplicates.push(trade);
    } else {
      unique.push(trade);
    }
  });

  return { duplicates, unique };
};

// 检测文件类型
export const detectFileType = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawData.length > 0) {
          const headerRow = rawData[0];
          const headerStr = headerRow.join(',').toLowerCase();
          
          // Jigsaw 特征列
          if (headerStr.includes('mae') && headerStr.includes('mfe') && headerStr.includes('fills')) {
            resolve('jigsaw');
          }
          // ATAS 特征列
          else if (headerStr.includes('品种') || headerStr.includes('开仓价') || headerStr.includes('利润')) {
            resolve('atas');
          }
          else {
            resolve('unknown');
          }
        } else {
          resolve('unknown');
        }
      } catch (e) {
        resolve('unknown');
      }
    };
    
    reader.onerror = () => resolve('unknown');
    reader.readAsArrayBuffer(file);
  });
};

export default {
  parseJigsawFile,
  checkJigsawDuplicates,
  detectFileType,
  parseInstrumentCode,
};
