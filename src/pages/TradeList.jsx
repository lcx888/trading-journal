import { useState, useEffect, useRef } from 'react';
import { 
  Table, Tag, Space, Select, DatePicker, Input, Button, 
  Modal, Form, message, Popconfirm, Tooltip, Dropdown, Progress,
  Switch, Radio, Drawer, Checkbox
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FilterOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  SafetyOutlined,
  AlertOutlined,
  BulbOutlined,
  BarChartOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import StorageService from '../services/storage';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

// 格式化持仓时间
const formatHoldingTime = (seconds) => {
  if (!seconds || seconds === 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

// 品种 tick 价值映射（美元/tick）
const TICK_VALUES = {
  'GC': 10, 'ES': 12.5, 'NQ': 5, 'RTY': 5, 'CL': 10, 'SI': 25, 'YM': 5,
  'ZB': 31.25, 'ZN': 15.625, '6E': 12.5, 'M2K': 0.5, 'MES': 1.25, 'MNQ': 0.5, 'MGC': 1,
};

const getTickValue = (instrumentCode, instruments) => {
  const instrument = instruments.find(i => i.code === instrumentCode);
  if (instrument?.tickValue) return instrument.tickValue;
  return TICK_VALUES[instrumentCode] || 5;
};

const ticksToUSD = (ticks, instrumentCode, quantity, instruments) => {
  if (ticks === undefined || ticks === null) return null;
  const tickValue = getTickValue(instrumentCode, instruments);
  return ticks * tickValue * Math.abs(quantity || 1);
};

// 根据品种配置计算手续费
const calculateTradeFee = (trade, instruments) => {
  // 兼容多种品种代码字段名
  const tradeCode = trade.instrumentCode || trade.instrument || trade.symbol;
  const instrument = instruments.find(i => 
    i.code === tradeCode || 
    i.code?.toUpperCase() === tradeCode?.toUpperCase()
  );
  const feeRate = instrument?.feeRate || 0; // 每手手续费
  const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
  return feeRate * quantity;
};

// ========== 高级分析指标计算函数 ==========

/**
 * 利润捕获率 (Profit Capture Rate)
 * 公式：min(100, max(0, PnL) / MFE × 100%)
 * 意义：反映你能留住多少浮盈。100% = 完美止盈在最高点，0% = 浮盈全部回吐
 * 越高越好
 * 注意：理论上不应超过100%，超过说明 MFE 数据可能不准确（Jigsaw 采样问题）
 */
const calcProfitCaptureRate = (mfeUSD, pnl) => {
  if (!mfeUSD || mfeUSD <= 0) return null;
  // 如果盈利为0或负数，捕获率为0
  if (pnl <= 0) return 0;
  // 计算捕获率，限制最大值为100%
  const rate = (pnl / mfeUSD) * 100;
  return Math.min(100, rate);
};

/**
 * 判断交易是否为分批建仓/减仓（MFE可能不可靠）
 * 规则：fills > 2 表示有多次成交，可能是分批交易
 * @param {object} trade - 交易对象
 * @returns {boolean} - true 表示是分批交易，MFE不可靠
 */
const isMultiFillTrade = (trade) => {
  const fills = trade.fills ?? trade.jigsawData?.fills;
  // fills > 2 表示超过一次开仓+一次平仓，可能是分批交易
  return fills !== undefined && fills > 2;
};

/**
 * 获取MFE可靠性标记
 */
const getMfeReliabilityTag = (trade) => {
  if (!isMultiFillTrade(trade)) return null;
  return {
    label: 'MFE不可靠',
    color: 'orange',
    tooltip: `分批交易（${trade.fills ?? trade.jigsawData?.fills}次成交），MFE/MAE数据可能不准确`,
  };
};

/**
 * 风险占用比 (Risk Exposure Index)
 * 公式：|MAE| / |PnL|（若亏损离场）或 |MAE| / MFE（若盈利离场）
 * 意义：评估为了赚这点钱，到底扛了多少不必要的风险
 */
const calcRiskExposureIndex = (maeUSD, mfeUSD, pnl) => {
  if (!maeUSD || maeUSD === 0) return null;
  const absMAE = Math.abs(maeUSD);
  if (pnl < 0) {
    // 亏损离场
    if (Math.abs(pnl) === 0) return null;
    return absMAE / Math.abs(pnl);
  } else {
    // 盈利离场
    if (!mfeUSD || mfeUSD === 0) return null;
    return absMAE / mfeUSD;
  }
};

/**
 * 回撤压力指数 (Drawdown Stress Index)
 * 逻辑：根据 MAE 的绝对金额以及持仓时长，计算交易者在持仓期间承受的压力等级
 * 评分标准：1-5级，5级最高压力
 * 
 * 改进点：
 * - 使用 MAE 绝对值（而非与 PnL 的比例）避免 PnL 接近 0 时的异常
 * - 设置 $50 作为最低基准，避免小单的比例失真
 * - 综合考虑 MAE 金额和持仓时间
 */
const calcDrawdownStressIndex = (maeUSD, pnl, holdingSeconds) => {
  if (!maeUSD || maeUSD === 0) return null;
  const absMAE = Math.abs(maeUSD);
  
  // 使用 MAE 绝对金额评估压力（而不是与 PnL 的比例）
  // $50 以下 = 1级，$100 = 2级，$200 = 3级，$400 = 4级，$800+ = 5级
  let baseScore = 1;
  if (absMAE >= 800) baseScore = 5;
  else if (absMAE >= 400) baseScore = 4;
  else if (absMAE >= 200) baseScore = 3;
  else if (absMAE >= 100) baseScore = 2;
  
  // 持仓时间因子（超过5分钟开始累加压力，最多+1）
  const timeFactor = holdingSeconds > 300 ? Math.min((holdingSeconds - 300) / 1200, 1) : 0;
  
  // 如果最终亏损且 MAE 很大，额外加压
  const lossBonus = (pnl < 0 && absMAE > Math.abs(pnl) * 1.5) ? 0.5 : 0;
  
  const finalScore = Math.min(5, baseScore + timeFactor + lossBonus);
  return finalScore;
};

/**
 * 执行复杂度 (Execution Complexity)
 * 逻辑：利用 Fills（成交次数）与 Quantity（数量）的比值
 * 意义：评估入场/出场是否果断，是否存在频繁加减仓的震荡操作
 */
const calcExecutionComplexity = (fills, quantity) => {
  if (!fills || !quantity || quantity === 0) return null;
  return fills / Math.abs(quantity);
};

/**
 * 风险回报比 (Risk-Reward Ratio based on MAE)
 * 逻辑：PnL / |MAE|，使用实际最大回撤作为风险基准
 * 注意：这是事后计算，基于实际 MAE 而非预设止损
 * 正值表示盈利超过最大浮亏，负值表示亏损
 */
const calcRiskRewardRatio = (pnl, maeUSD) => {
  if (!maeUSD || maeUSD === 0) return null;
  return pnl / Math.abs(maeUSD);
};

/**
 * 自动归因诊断 - 精简版
 * 每笔交易只返回1个最核心的标签
 */
const getAutoDiagnosis = (trade, maeUSD, mfeUSD) => {
  const { pnl } = trade;
  const absMAE = Math.abs(maeUSD || 0);
  const absMFE = Math.abs(mfeUSD || 0);
  const absPnL = Math.abs(pnl || 0);
  
  // 盈利交易
  if (pnl > 0) {
    // 完美交易 - 入场好 + 止盈好
    if (maeUSD && mfeUSD && absMAE < pnl * 0.3 && pnl >= absMFE * 0.7) {
      return [{ type: 'perfect', label: '完美', color: 'var(--color-profit)' }];
    }
    // 扛单盈利 - 经历大回撤
    if (maeUSD && absMAE > pnl) {
      return [{ type: 'roller', label: '扛赢', color: 'var(--text-secondary)' }];
    }
    // 小赚就跑
    if (mfeUSD && pnl < absMFE * 0.3 && absMFE > 50) {
      return [{ type: 'earlyExit', label: '跑早', color: 'var(--text-secondary)' }];
    }
    return [];
  }
  
  // 亏损交易
  if (pnl < 0) {
    // 入场即亏 - 方向错误
    if (mfeUSD && absMFE < absPnL * 0.2) {
      return [{ type: 'badEntry', label: '方向错', color: 'var(--color-loss)' }];
    }
    // 浮盈变亏 - 贪婪
    if (mfeUSD && absMFE > absPnL * 0.5) {
      return [{ type: 'greed', label: '浮盈亏', color: 'var(--color-loss)' }];
    }
    // 扛单割肉 - 割在低点
    if (maeUSD && absPnL >= absMAE * 0.8 && absMAE > 100) {
      return [{ type: 'badExit', label: '扛亏', color: 'var(--color-loss)' }];
    }
    // 果断止损 - 控制得好
    if (maeUSD && absPnL >= absMAE * 0.9 && absMAE <= 150) {
      return [{ type: 'goodStop', label: '止损好', color: 'var(--text-secondary)' }];
    }
    return [];
  }
  
  return [];
};

/**
 * 订单评级函数
 * 基于多维度综合评分：A/B/C/D/F
 * 
 * 评分维度：
 * 1. 盈亏结果 (+40分)
 * 2. 风险控制 (+30分) - 基于MAE/PnL
 * 3. 利润捕获 (+20分) - 基于PnL/MFE
 * 4. 执行质量 (+10分) - 基于成交次数
 */
const getTradeRating = (trade, maeUSD, mfeUSD) => {
  let score = 0;
  const { pnl, fills, openQuantity } = trade;
  const quantity = Math.abs(openQuantity || 1);
  const absMAE = Math.abs(maeUSD || 0);
  const absMFE = Math.abs(mfeUSD || 0);
  const absPnL = Math.abs(pnl || 0);
  
  // 1. 盈亏结果 (0-40分)
  if (pnl > 0) {
    score += 40; // 盈利满分
  } else if (pnl === 0) {
    score += 20; // 平局
  } else {
    // 亏损根据幅度扣分
    score += Math.max(0, 20 - (absPnL / 100) * 5);
  }
  
  // 2. 风险控制 (0-30分) - MAE越小越好
  if (maeUSD) {
    if (pnl > 0) {
      // 盈利时：MAE/PnL 越小越好
      const riskRatio = absMAE / Math.max(pnl, 1);
      if (riskRatio < 0.5) score += 30;
      else if (riskRatio < 1) score += 25;
      else if (riskRatio < 2) score += 15;
      else score += 5;
    } else {
      // 亏损时：亏损/MAE 越小越好（说明没割在最低点）
      const exitRatio = absPnL / Math.max(absMAE, 1);
      if (exitRatio < 0.5) score += 25; // 反弹后跑
      else if (exitRatio < 0.8) score += 15;
      else score += 5; // 割在低点
    }
  } else {
    score += 15; // 无数据给中间分
  }
  
  // 3. 利润捕获 (0-20分)
  if (mfeUSD && pnl > 0) {
    const captureRate = pnl / Math.max(absMFE, 1);
    if (captureRate >= 0.8) score += 20;
    else if (captureRate >= 0.5) score += 15;
    else if (captureRate >= 0.3) score += 10;
    else score += 5;
  } else if (pnl <= 0) {
    score += 5; // 亏损单基础分
  } else {
    score += 10;
  }
  
  // 4. 执行质量 (0-10分)
  if (fills && quantity) {
    const fillRatio = fills / quantity;
    if (fillRatio <= 1.5) score += 10; // 干净执行
    else if (fillRatio <= 3) score += 7;
    else score += 3; // 频繁操作
  } else {
    score += 7;
  }
  
  // 转换为等级
  if (score >= 85) return { grade: 'A', score, label: '优秀', color: 'var(--color-profit)' };
  if (score >= 70) return { grade: 'B', score, label: '良好', color: 'var(--color-profit)' };
  if (score >= 55) return { grade: 'C', score, label: '一般', color: 'var(--text-secondary)' };
  if (score >= 40) return { grade: 'D', score, label: '较差', color: 'var(--color-loss)' };
  return { grade: 'F', score, label: '很差', color: 'var(--color-loss)' };
};

// MAE/MFE 可视化条组件
const TradeRangeBar = ({ mae, mfe, pnl, maeUSD, mfeUSD }) => {
  if (!mae && !mfe) return null;
  
  // 计算相对位置
  const absMAE = Math.abs(maeUSD || 0);
  const absMFE = Math.abs(mfeUSD || 0);
  const total = absMAE + absMFE;
  
  if (total === 0) return null;
  
  const maePercent = (absMAE / total) * 100;
  const mfePercent = (absMFE / total) * 100;
  
  // PnL 在范围内的位置
  let pnlPosition = 50; // 默认中间（入场点）
  if (pnl >= 0 && absMFE > 0) {
    pnlPosition = maePercent + (pnl / absMFE) * mfePercent * 0.5;
  } else if (pnl < 0 && absMAE > 0) {
    pnlPosition = maePercent - (Math.abs(pnl) / absMAE) * maePercent * 0.5;
  }
  pnlPosition = Math.max(5, Math.min(95, pnlPosition));
  
  return (
    <div className="w-full">
      <div className="relative h-4 rounded-sm overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
        {/* MAE区域（左侧红色） */}
        <div 
          className="absolute left-0 top-0 h-full"
          style={{ 
            width: `${maePercent}%`,
            background: 'linear-gradient(90deg, rgba(244,63,94,0.6) 0%, rgba(244,63,94,0.3) 100%)'
          }}
        />
        {/* MFE区域（右侧绿色） */}
        <div 
          className="absolute right-0 top-0 h-full"
          style={{ 
            width: `${mfePercent}%`,
            background: 'linear-gradient(90deg, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.6) 100%)'
          }}
        />
        {/* 入场点标记（中间白线） */}
        <div 
          className="absolute top-0 h-full w-0.5"
          style={{ 
            left: `${maePercent}%`,
            background: 'var(--text-primary)',
            opacity: 0.5
          }}
        />
        {/* PnL结束点标记 */}
        <div 
          className="absolute top-0 h-full w-1"
          style={{ 
            left: `${pnlPosition}%`,
            transform: 'translateX(-50%)',
            background: pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
            borderRadius: 2
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px]">
        <span style={{ color: 'var(--color-loss)' }}>-${absMAE.toFixed(0)}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>入场</span>
        <span style={{ color: 'var(--color-profit)' }}>+${absMFE.toFixed(0)}</span>
      </div>
    </div>
  );
};

// 心理压力等级显示组件
const StressIndicator = ({ score }) => {
  if (score === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
  
  const getColor = (s) => {
    if (s >= 4) return 'var(--color-loss)';
    if (s >= 3) return '#f97316';
    if (s >= 2) return '#eab308';
    return 'var(--color-profit)';
  };
  
  const getLabel = (s) => {
    if (s >= 4.5) return '极高';
    if (s >= 3.5) return '高';
    if (s >= 2.5) return '中等';
    if (s >= 1.5) return '低';
    return '极低';
  };
  
  return (
    <Tooltip title={`心理压力等级: ${(score ?? 0).toFixed(1)}/5`}>
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div 
              key={i}
              className="w-1.5 h-3 rounded-sm"
              style={{ 
                background: i <= Math.round(score) ? getColor(score) : 'var(--bg-tertiary)'
              }}
            />
          ))}
        </div>
        <span className="text-xs font-medium" style={{ color: getColor(score) }}>
          {getLabel(score)}
        </span>
      </div>
    </Tooltip>
  );
};

// ========== 表格配置存储 ==========
const TABLE_CONFIG_KEY = 'tradeListTableConfig';
const getDefaultTableConfig = () => ({
  hiddenColumns: [], // 隐藏的列key
  rowHeight: 'middle', // compact | middle | large
});
const loadTableConfig = () => {
  try {
    const saved = localStorage.getItem(TABLE_CONFIG_KEY);
    return saved ? { ...getDefaultTableConfig(), ...JSON.parse(saved) } : getDefaultTableConfig();
  } catch { return getDefaultTableConfig(); }
};
const saveTableConfig = (config) => {
  localStorage.setItem(TABLE_CONFIG_KEY, JSON.stringify(config));
};

const TradeList = ({ activeRecordId = 'all' }) => {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [filteredTrades, setFilteredTrades] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [hasJigsawData, setHasJigsawData] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    instrument: 'ALL',
    direction: 'ALL',
    result: 'ALL',
    session: 'ALL',
    strategy: 'ALL',
    dateRange: null,
    keyword: '',
    source: 'ALL',
    rating: 'ALL', // 评级筛选
    mfeReliable: 'ALL', // MFE可靠性筛选：ALL, reliable, unreliable
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [form] = Form.useForm();
  
  // ========== 表格配置状态 ==========
  const [tableConfig, setTableConfig] = useState(loadTableConfig);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const tableWrapperRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });
  
  // 列配置定义（用于配置面板）
  const columnDefs = [
    { key: 'openTime', label: '时间' },
    { key: 'instrumentCode', label: '品种' },
    { key: 'direction', label: '方向' },
    { key: 'quantity', label: '数量' },
    { key: 'prices', label: '价格' },
    { key: 'pnl', label: '盈亏' },
    { key: 'fee', label: '手续费' },
    { key: 'feeRatio', label: '费率' },
    { key: 'marketSession', label: '时段' },
    { key: 'duration', label: '时长' },
    { key: 'mae', label: '最大回撤', jigsaw: true },
    { key: 'mfe', label: '最大浮盈', jigsaw: true },
    { key: 'fills', label: '成交', jigsaw: true },
    { key: 'riskReward', label: '风险回报', jigsaw: true },
    { key: 'profitCapture', label: '捕获率', jigsaw: true },
    { key: 'stressScore', label: '压力', jigsaw: true },
    { key: 'diagnosis', label: '诊断', jigsaw: true },
    { key: 'tradeRange', label: '波动区间', jigsaw: true },
    { key: 'rating', label: '评级', jigsaw: true },
    { key: 'strategyTags', label: '策略' },
  ];
  
  // 更新表格配置
  const updateTableConfig = (updates) => {
    const newConfig = { ...tableConfig, ...updates };
    setTableConfig(newConfig);
    saveTableConfig(newConfig);
  };
  
  // 切换列显示/隐藏
  const toggleColumn = (key) => {
    const hidden = tableConfig.hiddenColumns.includes(key)
      ? tableConfig.hiddenColumns.filter(k => k !== key)
      : [...tableConfig.hiddenColumns, key];
    updateTableConfig({ hiddenColumns: hidden });
  };
  
  // 行高映射
  const rowHeightMap = {
    compact: { size: 'small', padding: '4px 12px' },
    middle: { size: 'middle', padding: '8px 16px' },
    large: { size: 'large', padding: '12px 20px' },
  };
  
  // ========== 拖动滚动 ==========
  useEffect(() => {
    if (!tableWrapperRef.current) return;
    
    const wrapper = tableWrapperRef.current;
    // 查找可滚动的表格容器
    const findScrollContainer = () => {
      return wrapper.querySelector('.ant-table-body') || 
             wrapper.querySelector('.ant-table-content') ||
             wrapper.querySelector('.ant-table');
    };
    
    const handleMouseDown = (e) => {
      const scrollContainer = findScrollContainer();
      if (!scrollContainer) return;
      // 忽略按钮、链接等交互元素的点击
      if (e.target.closest('button, a, .ant-dropdown-trigger, .ant-btn')) return;
      
      isDragging.current = true;
      dragStart.current = { x: e.clientX, scrollLeft: scrollContainer.scrollLeft };
      wrapper.style.cursor = 'grabbing';
      wrapper.style.userSelect = 'none';
      e.preventDefault();
    };
    
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const scrollContainer = findScrollContainer();
      if (!scrollContainer) return;
      const dx = e.clientX - dragStart.current.x;
      scrollContainer.scrollLeft = dragStart.current.scrollLeft - dx;
    };
    
    const handleMouseUp = () => {
      if (isDragging.current) {
        wrapper.style.cursor = '';
        wrapper.style.userSelect = '';
        isDragging.current = false;
      }
    };
    
    wrapper.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      wrapper.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [filteredTrades]); // 数据变化时重新绑定

  useEffect(() => { loadData(); }, [activeRecordId]);
  useEffect(() => { applyFilters(); }, [trades, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allTrades, instrumentList, strategyList] = await Promise.all([
        StorageService.getAllTrades(),
        StorageService.getInstruments(),
        StorageService.getAllStrategies(),
      ]);
      setStrategies(strategyList);
      let filteredByRecord = allTrades;
      if (activeRecordId !== 'all') {
        filteredByRecord = allTrades.filter(t => t.recordId === activeRecordId);
      }
      filteredByRecord.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
      setTrades(filteredByRecord);
      setInstruments(instrumentList);
      
      const hasJigsaw = filteredByRecord.some(t => 
        t.source === 'jigsaw' || t.jigsawData || t.mae !== undefined || t.mfe !== undefined
      );
      setHasJigsawData(hasJigsaw);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...trades];
    if (filters.instrument !== 'ALL') result = result.filter(t => t.instrumentCode === filters.instrument);
    if (filters.direction !== 'ALL') result = result.filter(t => t.direction === filters.direction);
    if (filters.result !== 'ALL') {
      if (filters.result === 'WIN') result = result.filter(t => t.pnl > 0);
      else if (filters.result === 'LOSS') result = result.filter(t => t.pnl < 0);
    }
    if (filters.session !== 'ALL') result = result.filter(t => t.marketSession === filters.session);
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const start = filters.dateRange[0].startOf('day').toDate();
      const end = filters.dateRange[1].endOf('day').toDate();
      result = result.filter(t => {
        const tradeDate = new Date(t.openTime);
        return tradeDate >= start && tradeDate <= end;
      });
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      result = result.filter(t => 
        t.instrumentCode?.toLowerCase().includes(kw) ||
        t.logicAnalysis?.toLowerCase().includes(kw) ||
        t.notes?.toLowerCase().includes(kw)
      );
    }
    if (filters.strategy !== 'ALL') {
      if (filters.strategy === 'NONE') result = result.filter(t => !t.strategyIds || t.strategyIds.length === 0);
      else result = result.filter(t => t.strategyIds && t.strategyIds.includes(filters.strategy));
    }
    if (filters.source !== 'ALL') {
      result = result.filter(t => {
        const tradeSource = t.source || (t.jigsawData ? 'jigsaw' : 'atas');
        return tradeSource === filters.source;
      });
    }
    // 评级筛选
    if (filters.rating !== 'ALL') {
      result = result.filter(t => {
        const mae = t.mae ?? t.jigsawData?.mae;
        const mfe = t.mfe ?? t.jigsawData?.mfe;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) : null;
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments) : null;
        const rating = getTradeRating(t, maeUSD, mfeUSD);
        return rating.grade === filters.rating;
      });
    }
    // MFE可靠性筛选
    if (filters.mfeReliable !== 'ALL') {
      result = result.filter(t => {
        const isUnreliable = isMultiFillTrade(t);
        if (filters.mfeReliable === 'reliable') return !isUnreliable;
        if (filters.mfeReliable === 'unreliable') return isUnreliable;
        return true;
      });
    }
    setFilteredTrades(result);
  };

  const getStrategyById = (id) => strategies.find(s => s.id === id);

  const handleAddStrategy = async (tradeId, strategyId) => {
    try {
      await StorageService.addStrategyToTrade(tradeId, strategyId);
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, strategyIds: [...(t.strategyIds || []), strategyId] } : t));
      message.success('标签已添加');
    } catch (e) { message.error('操作失败'); }
  };

  const handleRemoveStrategy = async (tradeId, strategyId) => {
    try {
      await StorageService.removeStrategyFromTrade(tradeId, strategyId);
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, strategyIds: (t.strategyIds || []).filter(id => id !== strategyId) } : t));
      message.success('标签已移除');
    } catch (e) { message.error('操作失败'); }
  };

  const handleEdit = (trade) => {
    setEditingTrade(trade);
    form.setFieldsValue({
      expectedTrend: trade.expectedTrend,
      strategyIds: trade.strategyIds || [],
      logicAnalysis: trade.logicAnalysis,
      notes: trade.notes,
    });
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    try {
      const vals = form.getFieldsValue();
      await StorageService.updateTrade(editingTrade.id, vals);
      message.success('保存成功');
      setEditModalVisible(false);
      loadData();
    } catch (e) { message.error('保存失败'); }
  };

  const handleDelete = async (id) => {
    try {
      await StorageService.deleteTrade(id);
      message.success('删除成功');
      loadData();
    } catch (e) { message.error('删除失败'); }
  };

  const handleExport = () => {
    const data = filteredTrades.map(t => {
      const baseData = {
        '品种': t.instrumentCode,
        '时间': dayjs(t.openTime).format('YYYY-MM-DD HH:mm:ss'),
        '方向': t.direction === 'LONG' ? '多' : '空',
        '数量': t.openQuantity,
        '开仓价': t.openPrice,
        '平仓价': t.closePrice,
        '盈亏': t.pnl,
        '手续费': calculateTradeFee(t, instruments),
        '时段': t.marketSession,
        '持仓时长': formatHoldingTime(t.holdingSeconds),
        '数据来源': t.source === 'jigsaw' ? 'Jigsaw' : 'ATAS',
      };
      
      if (hasJigsawData) {
        const mae = t.mae ?? t.jigsawData?.mae;
        const mfe = t.mfe ?? t.jigsawData?.mfe;
        const fills = t.fills ?? t.jigsawData?.fills;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) : null;
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments) : null;
        
        baseData['MAE(ticks)'] = mae ?? '';
        baseData['MAE(美元)'] = maeUSD ? (-maeUSD).toFixed(2) : '';
        baseData['MFE(ticks)'] = mfe ?? '';
        baseData['MFE(美元)'] = mfeUSD ? mfeUSD.toFixed(2) : '';
        baseData['成交次数'] = fills ?? '';
        
        // 高级分析指标
        const rMultiple = calcRiskRewardRatio(t.pnl, maeUSD);
        const profitCapture = calcProfitCaptureRate(mfeUSD, t.pnl);
        const riskExposure = calcRiskExposureIndex(maeUSD, mfeUSD, t.pnl);
        const stressScore = calcDrawdownStressIndex(maeUSD, t.pnl, t.holdingSeconds);
        const execComplexity = calcExecutionComplexity(fills, t.openQuantity);
        const diagnoses = getAutoDiagnosis(t, maeUSD, mfeUSD);
        
        baseData['风险回报比'] = rMultiple !== null ? rMultiple.toFixed(2) : '';
        baseData['利润捕获率(%)'] = profitCapture !== null ? profitCapture.toFixed(1) : '';
        baseData['风险占用比'] = riskExposure !== null ? riskExposure.toFixed(2) : '';
        baseData['回撤压力(1-5)'] = stressScore !== null ? stressScore.toFixed(1) : '';
        baseData['执行复杂度'] = execComplexity !== null ? execComplexity.toFixed(1) : '';
        baseData['自动诊断'] = diagnoses.map(d => d.label).join(', ');
      }
      
      return baseData;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '交易记录');
    XLSX.writeFile(wb, `交易明细_${dayjs().format('MMDD_HHmm')}.xlsx`);
  };

  const resetFilters = () => {
    setFilters({
      instrument: 'ALL',
      direction: 'ALL',
      result: 'ALL',
      session: 'ALL',
      strategy: 'ALL',
      dateRange: null,
      keyword: '',
      source: 'ALL',
      rating: 'ALL',
      mfeReliable: 'ALL',
    });
  };

  const hasActiveFilters = 
    filters.instrument !== 'ALL' || 
    filters.direction !== 'ALL' || 
    filters.result !== 'ALL' || 
    filters.source !== 'ALL' ||
    filters.rating !== 'ALL' ||
    filters.mfeReliable !== 'ALL' ||
    filters.dateRange !== null ||
    filters.keyword !== '';

  // 统计计算
  const winTrades = filteredTrades.filter(t => t.pnl > 0);
  const lossTrades = filteredTrades.filter(t => t.pnl < 0);
  const totalFee = filteredTrades.reduce((sum, t) => sum + calculateTradeFee(t, instruments), 0);
  const grossPnL = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  
  // 盈利总额（用于计算手续费占比）
  const grossProfit = winTrades.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
  
  const stats = {
    total: filteredTrades.length,
    pnl: grossPnL,
    netPnL: grossPnL - totalFee, // 扣除手续费后的真实净盈亏
    totalFee,
    grossProfit, // 盈利总额
    grossLoss,   // 亏损总额
    wins: winTrades.length,
    losses: lossTrades.length,
    // 平均盈利/亏损
    avgWin: winTrades.length > 0 ? grossProfit / winTrades.length : 0,
    avgLoss: lossTrades.length > 0 ? grossLoss / lossTrades.length : 0,
    // 盈亏比 (Profit Factor)
    profitFactor: grossLoss > 0 && grossProfit > 0
      ? grossProfit / grossLoss
      : 0,
    // 期望值 (Expectancy per trade)
    expectancy: filteredTrades.length > 0 ? grossPnL / filteredTrades.length : 0,
  };
  
  const jigsawStats = hasJigsawData ? (() => {
    const tradesWithMAE = filteredTrades.filter(t => (t.mae ?? t.jigsawData?.mae) !== undefined);
    const tradesWithMFE = filteredTrades.filter(t => (t.mfe ?? t.jigsawData?.mfe) !== undefined);
    
    const totalMAEUSD = tradesWithMAE.reduce((sum, t) => {
      const mae = t.mae ?? t.jigsawData?.mae ?? 0;
      return sum + ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments);
    }, 0);
    
    const totalMFEUSD = tradesWithMFE.reduce((sum, t) => {
      const mfe = t.mfe ?? t.jigsawData?.mfe ?? 0;
      return sum + ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments);
    }, 0);
    
    // 计算高级统计指标
    let totalRMultiple = 0;
    let rMultipleCount = 0;
    let totalProfitCapture = 0;
    let profitCaptureCount = 0;
    let totalStressScore = 0;
    let stressScoreCount = 0;
    let diagnosisCounts = { 
      perfect: 0, roller: 0, earlyExit: 0,  // 盈利场景
      badEntry: 0, greed: 0, badExit: 0, goodStop: 0 // 亏损场景
    };
    
    filteredTrades.forEach(t => {
      const mae = t.mae ?? t.jigsawData?.mae;
      const mfe = t.mfe ?? t.jigsawData?.mfe;
      const maeUSD = mae !== undefined ? ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) : null;
      const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments) : null;
      
      // R倍数统计
      const rMultiple = calcRiskRewardRatio(t.pnl, maeUSD);
      if (rMultiple !== null) {
        totalRMultiple += rMultiple;
        rMultipleCount++;
      }
      
      // 利润捕获率统计
      const profitCapture = calcProfitCaptureRate(mfeUSD, t.pnl);
      if (profitCapture !== null) {
        totalProfitCapture += profitCapture;
        profitCaptureCount++;
      }
      
      // 心理压力统计
      const stressScore = calcDrawdownStressIndex(maeUSD, t.pnl, t.holdingSeconds);
      if (stressScore !== null) {
        totalStressScore += stressScore;
        stressScoreCount++;
      }
      
      // 诊断统计
      const diagnoses = getAutoDiagnosis(t, maeUSD, mfeUSD);
      diagnoses.forEach(d => {
        if (diagnosisCounts[d.type] !== undefined) {
          diagnosisCounts[d.type]++;
        }
      });
    });
    
    return {
      avgMAE: tradesWithMAE.length > 0 ? (totalMAEUSD / tradesWithMAE.length) : 0,
      avgMFE: tradesWithMFE.length > 0 ? (totalMFEUSD / tradesWithMFE.length) : 0,
      totalFills: filteredTrades.reduce((sum, t) => sum + (t.fills ?? t.jigsawData?.fills ?? 0), 0),
      avgRMultiple: rMultipleCount > 0 ? totalRMultiple / rMultipleCount : 0,
      avgProfitCapture: profitCaptureCount > 0 ? totalProfitCapture / profitCaptureCount : 0,
      avgStressScore: stressScoreCount > 0 ? totalStressScore / stressScoreCount : 0,
      diagnosisCounts,
    };
  })() : null;

  // 表格列定义
  const columns = [
    {
      title: '时间',
      dataIndex: 'openTime',
      key: 'openTime',
      width: 180,
      render: (t) => (
        <div style={{ padding: '4px 0' }}>
          <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
            {dayjs(t).format('MM-DD HH:mm:ss')}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {dayjs(t).format('YYYY')}
          </div>
        </div>
      ),
      sorter: (a, b) => new Date(a.openTime) - new Date(b.openTime),
    },
    {
      title: '品种',
      dataIndex: 'instrumentCode',
      key: 'instrumentCode',
      width: 120,
      render: (c) => (
        <span 
          className="font-mono font-semibold text-sm px-3 py-1.5 rounded"
          style={{ 
            background: 'var(--bg-tertiary)', 
            color: 'var(--text-primary)' 
          }}
        >
          {c}
        </span>
      ),
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 60,
      render: (d) => (
        <span 
          className="font-mono text-xs font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          {d === 'LONG' ? '多' : '空'}
        </span>
      ),
    },
    {
      title: '数量',
      key: 'quantity',
      width: 90,
      align: 'right',
      render: (_, r) => (
        <span className="font-mono font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          {Math.abs(r.openQuantity || 0)}
        </span>
      ),
    },
    {
      title: '价格',
      key: 'prices',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <div className="font-mono" style={{ padding: '4px 0' }}>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {r.openPrice?.toFixed(2)}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            → {r.closePrice?.toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.pnl - b.pnl,
      render: (p) => (
        <div 
          className="font-mono font-bold text-base"
          style={{ color: p >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
        >
          {p >= 0 ? '+' : ''}{p?.toFixed(2)}
        </div>
      ),
    },
    {
      title: '手续费',
      key: 'fee',
      width: 80,
      align: 'right',
      sorter: (a, b) => calculateTradeFee(a, instruments) - calculateTradeFee(b, instruments),
      render: (_, r) => {
        const fee = calculateTradeFee(r, instruments);
        return (
          <div className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {fee > 0 ? `$${fee.toFixed(2)}` : '-'}
          </div>
        );
      },
    },
    {
      title: '费率',
      key: 'feeRatio',
      width: 60,
      align: 'right',
      render: (_, r) => {
        const fee = calculateTradeFee(r, instruments);
        const absPnL = Math.abs(r.pnl || 0);
        if (fee <= 0 || absPnL <= 0) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const ratio = (fee / absPnL) * 100;
        // 费率超过20%显示警告色
        const isHigh = ratio > 20;
        return (
          <span 
            className="font-mono text-xs" 
            style={{ color: isHigh ? 'var(--color-loss)' : 'var(--text-tertiary)' }}
          >
            {ratio.toFixed(0)}%
          </span>
        );
      },
    },
    {
      title: '时段',
      dataIndex: 'marketSession',
      key: 'marketSession',
      width: 100,
      render: (s) => (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {s}
        </span>
      ),
    },
    {
      title: '时长',
      dataIndex: 'holdingSeconds',
      key: 'duration',
      width: 100,
      align: 'right',
      render: (s) => (
        <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
          {formatHoldingTime(s)}
        </span>
      ),
    },
    // Jigsaw 专属列 - 灰度风格
    ...(hasJigsawData ? [{
      title: '最大回撤',
      key: 'mae',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        return (
          <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
            ${maeUSD?.toFixed(0)}
          </span>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: '最大浮盈',
      key: 'mfe',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        if (mfe === undefined || mfe === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const mfeUSD = ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments);
        return (
          <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
            ${mfeUSD?.toFixed(0)}
          </span>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: '成交',
      key: 'fills',
      width: 60,
      align: 'right',
      render: (_, r) => {
        const fills = r.fills ?? r.jigsawData?.fills;
        if (fills === undefined || fills === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        return <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>{fills}</span>;
      },
    }] : []),
    // ========== 高级分析指标列 ==========
    ...(hasJigsawData ? [{
      title: '风险回报',
      key: 'riskReward',
      width: 80,
      align: 'right',
      sorter: (a, b) => {
        const maeA = ticksToUSD(a.mae ?? a.jigsawData?.mae, a.instrumentCode, a.openQuantity, instruments);
        const maeB = ticksToUSD(b.mae ?? b.jigsawData?.mae, b.instrumentCode, b.openQuantity, instruments);
        const rA = calcRiskRewardRatio(a.pnl, maeA) || 0;
        const rB = calcRiskRewardRatio(b.pnl, maeB) || 0;
        return rA - rB;
      },
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        const rMultiple = calcRiskRewardRatio(r.pnl, maeUSD);
        if (rMultiple === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        // 大于1R显示绿色
        const isGood = rMultiple >= 1;
        return (
          <span 
            className="font-mono text-sm font-semibold" 
            style={{ color: isGood ? 'var(--color-profit)' : 'var(--text-secondary)' }}
          >
            {rMultiple.toFixed(1)}R
          </span>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: '捕获率',
      key: 'profitCapture',
      width: 90,
      align: 'right',
      sorter: (a, b) => {
        const mfeA = ticksToUSD(a.mfe ?? a.jigsawData?.mfe, a.instrumentCode, a.openQuantity, instruments);
        const mfeB = ticksToUSD(b.mfe ?? b.jigsawData?.mfe, b.instrumentCode, b.openQuantity, instruments);
        const prA = calcProfitCaptureRate(mfeA, a.pnl) || 0;
        const prB = calcProfitCaptureRate(mfeB, b.pnl) || 0;
        return prA - prB;
      },
      render: (_, r) => {
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        if (mfe === undefined || mfe === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const mfeUSD = ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments);
        const capture = calcProfitCaptureRate(mfeUSD, r.pnl);
        if (capture === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        // 大于80%显示绿色
        const isGood = capture >= 80;
        const reliabilityTag = getMfeReliabilityTag(r);
        return (
          <Tooltip title={reliabilityTag?.tooltip}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <span 
                className="font-mono text-sm font-semibold" 
                style={{ color: isGood ? 'var(--color-profit)' : 'var(--text-secondary)' }}
              >
                {capture.toFixed(0)}%
              </span>
              {reliabilityTag && (
                <span style={{ color: 'var(--color-brand)', fontSize: 10 }}>⚠</span>
              )}
            </span>
          </Tooltip>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: '压力',
      key: 'stressScore',
      width: 60,
      align: 'right',
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        const score = calcDrawdownStressIndex(maeUSD, r.pnl, r.holdingSeconds);
        if (score === null || score === undefined) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        return (
          <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
            {score.toFixed(1)}
          </span>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: '诊断',
      key: 'diagnosis',
      width: 100,
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments) : null;
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments) : null;
        
        const diagnoses = getAutoDiagnosis(r, maeUSD, mfeUSD);
        if (diagnoses.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        
        return (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {diagnoses.slice(0, 2).map(d => d.label).join(', ')}
          </span>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: '波动区间',
      key: 'tradeRange',
      width: 120,
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments) : null;
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments) : null;
        
        return <TradeRangeBar mae={mae} mfe={mfe} pnl={r.pnl} maeUSD={maeUSD} mfeUSD={mfeUSD} />;
      },
    }] : []),
    // 评级列
    ...(hasJigsawData ? [{
      title: '评级',
      key: 'rating',
      width: 60,
      align: 'center',
      sorter: (a, b) => {
        const maeA = ticksToUSD(a.mae ?? a.jigsawData?.mae, a.instrumentCode, a.openQuantity, instruments);
        const mfeA = ticksToUSD(a.mfe ?? a.jigsawData?.mfe, a.instrumentCode, a.openQuantity, instruments);
        const maeB = ticksToUSD(b.mae ?? b.jigsawData?.mae, b.instrumentCode, b.openQuantity, instruments);
        const mfeB = ticksToUSD(b.mfe ?? b.jigsawData?.mfe, b.instrumentCode, b.openQuantity, instruments);
        return getTradeRating(a, maeA, mfeA).score - getTradeRating(b, maeB, mfeB).score;
      },
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments) : null;
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments) : null;
        const rating = getTradeRating(r, maeUSD, mfeUSD);
        return (
          <span 
            className="font-mono text-sm font-bold"
            style={{ color: rating.color }}
            title={`${rating.label} (${rating.score}分)`}
          >
            {rating.grade}
          </span>
        );
      },
    }] : []),
    {
      title: '策略',
      key: 'strategyTags',
      width: 140,
      render: (_, r) => {
        const tradeStrategies = (r.strategyIds || []).map(id => getStrategyById(id)).filter(Boolean);
        const available = strategies.filter(s => !r.strategyIds?.includes(s.id));
        return (
          <div className="flex flex-wrap items-center gap-1">
            {tradeStrategies.map(s => (
              <span 
                key={s.id} 
                className="text-xs px-2 py-0.5 rounded cursor-pointer"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                onClick={() => handleRemoveStrategy(r.id, s.id)}
              >
                {s.name}
              </span>
            ))}
            {available.length > 0 && (
              <Dropdown 
                menu={{ 
                  items: available.map(s => ({ 
                    key: s.id, 
                    label: s.name, 
                    onClick: () => handleAddStrategy(r.id, s.id) 
                  })) 
                }} 
                trigger={['click']}
              >
                <span 
                  className="text-xs cursor-pointer"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  +
                </span>
              </Dropdown>
            )}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button 
            type="text" 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(r)}
            style={{ color: 'var(--text-tertiary)' }}
            className="hover:!text-[var(--color-brand)]"
          />
          <Popconfirm 
            title={<span style={{ color: 'var(--text-primary)' }}>确认删除此交易记录？</span>}
            onConfirm={() => handleDelete(r.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, size: 'small' }}
            cancelButtonProps={{ size: 'small' }}
          >
            <Button 
              type="text" 
              size="small" 
              icon={<DeleteOutlined />}
              style={{ color: 'var(--text-tertiary)' }}
              className="hover:!text-[var(--color-loss)]"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>交易明细</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            查看和管理所有交易记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            icon={<FilterOutlined />}
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              background: hasActiveFilters ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
              borderColor: hasActiveFilters ? 'var(--color-brand)' : 'var(--border-primary)',
              color: hasActiveFilters ? 'var(--color-brand)' : 'var(--text-secondary)',
            }}
          >
            筛选 {hasActiveFilters && `(${filteredTrades.length})`}
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadData}
            style={{ 
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          />
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
          >
            导出
          </Button>
          <Button 
            icon={<SettingOutlined />} 
            onClick={() => setShowTableSettings(true)}
            style={{ 
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            设置
          </Button>
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div 
          className="p-4 rounded-lg"
          style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)' 
          }}
        >
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={filters.instrument}
              onChange={v => setFilters({ ...filters, instrument: v })}
              style={{ width: 120 }}
              placeholder="品种"
              options={[
                { value: 'ALL', label: '全部品种' },
                ...instruments.map(i => ({ value: i.code, label: i.code }))
              ]}
            />
            <Select
              value={filters.direction}
              onChange={v => setFilters({ ...filters, direction: v })}
              style={{ width: 100 }}
              options={[
                { value: 'ALL', label: '全部方向' },
                { value: 'LONG', label: '多头' },
                { value: 'SHORT', label: '空头' },
              ]}
            />
            <Select
              value={filters.result}
              onChange={v => setFilters({ ...filters, result: v })}
              style={{ width: 100 }}
              options={[
                { value: 'ALL', label: '全部结果' },
                { value: 'WIN', label: '盈利' },
                { value: 'LOSS', label: '亏损' },
              ]}
            />
            {hasJigsawData && (
              <Select
                value={filters.source}
                onChange={v => setFilters({ ...filters, source: v })}
                style={{ width: 110 }}
                options={[
                  { value: 'ALL', label: '全部来源' },
                  { value: 'atas', label: 'ATAS' },
                  { value: 'jigsaw', label: 'Jigsaw' },
                ]}
              />
            )}
            {hasJigsawData && (
              <Select
                value={filters.rating}
                onChange={v => setFilters({ ...filters, rating: v })}
                style={{ width: 100 }}
                options={[
                  { value: 'ALL', label: '全部评级' },
                  { value: 'A', label: 'A 优秀' },
                  { value: 'B', label: 'B 良好' },
                  { value: 'C', label: 'C 一般' },
                  { value: 'D', label: 'D 较差' },
                  { value: 'F', label: 'F 很差' },
                ]}
              />
            )}
            {hasJigsawData && (
              <Select
                value={filters.mfeReliable}
                onChange={v => setFilters({ ...filters, mfeReliable: v })}
                style={{ width: 120 }}
                options={[
                  { value: 'ALL', label: '全部交易' },
                  { value: 'reliable', label: '✓ MFE可靠' },
                  { value: 'unreliable', label: '⚠ 分批交易' },
                ]}
              />
            )}
            <RangePicker
              value={filters.dateRange}
              onChange={v => setFilters({ ...filters, dateRange: v })}
              placeholder={['开始日期', '结束日期']}
              style={{ width: 240 }}
            />
            <Input
              placeholder="搜索..."
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              style={{ width: 180 }}
              allowClear
            />
            {hasActiveFilters && (
              <Button 
                type="text" 
                onClick={resetFilters}
                style={{ color: 'var(--text-secondary)' }}
              >
                重置
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 统计概览 - 极简灰度设计 */}
      <div 
        className="p-5 rounded-lg"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
        }}
      >
        {/* 核心指标 - 单行排列 */}
        <div 
          className="flex items-baseline justify-between"
          style={{ gap: 32 }}
        >
          {/* 净盈亏 - 最突出 */}
          <div>
            <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>净盈亏</div>
            <div 
              className="text-3xl font-mono font-bold"
              style={{ color: stats.netPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
            >
              {stats.netPnL >= 0 ? '+' : ''}{(stats.netPnL ?? 0).toFixed(2)}
            </div>
          </div>

          {/* 其他指标 - 灰度处理 */}
          <div className="flex items-baseline gap-8">
            <div>
              <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>交易数</div>
              <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {stats.total}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>胜率</div>
              <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(0) : 0}%
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>胜/负</div>
              <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {stats.wins}/{stats.losses}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>盈亏比</div>
              <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {(stats.profitFactor ?? 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>均盈</div>
              <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                ${(stats.avgWin ?? 0).toFixed(0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>均亏</div>
              <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                ${(stats.avgLoss ?? 0).toFixed(0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>手续费</div>
              <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                ${(stats.totalFee ?? 0).toFixed(0)}
              </div>
            </div>
            {hasJigsawData && jigsawStats && (
              <>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>均MAE</div>
                  <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    ${(jigsawStats.avgMAE ?? 0).toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>均MFE</div>
                  <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    ${(jigsawStats.avgMFE ?? 0).toFixed(0)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

        {/* 高级分析指标行 - 仅 Jigsaw 数据时显示 */}
        {hasJigsawData && jigsawStats && (
          <div 
            className="mt-3 p-4 rounded-lg"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  高级分析
                </span>
              </div>
              <div className="flex items-baseline gap-8">
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>风险回报</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {(jigsawStats.avgRMultiple ?? 0).toFixed(2)}R
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>捕获率</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {(jigsawStats.avgProfitCapture ?? 0).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>压力指数</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {(jigsawStats.avgStressScore ?? 0).toFixed(1)}/5
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--color-profit)' }}>完美</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.perfect}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>扛赢</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.roller}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--color-loss)' }}>方向错</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.badEntry}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--color-loss)' }}>浮盈亏</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.greed}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--color-loss)' }}>扛亏</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.badExit}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', paddingLeft: 24, borderLeft: '1px solid var(--border-primary)' }}>
                  <div className="text-[10px] tracking-wider mb-1" style={{ color: stats.grossProfit > 0 && (stats.totalFee / stats.grossProfit * 100) > 15 ? 'var(--color-loss)' : 'var(--text-tertiary)' }}>
                    手续费占比
                  </div>
                  <div className="text-lg font-mono font-semibold" style={{ 
                    color: stats.grossProfit > 0 && (stats.totalFee / stats.grossProfit * 100) > 15 ? 'var(--color-loss)' : 'var(--text-secondary)' 
                  }}>
                    {stats.grossProfit > 0 ? (stats.totalFee / stats.grossProfit * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
          </div>
        )}

      {/* 数据表格 */}
      <div 
        ref={tableWrapperRef}
        className="rounded-lg overflow-hidden table-drag-scroll"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
          cursor: 'grab'
        }}
      >
        <Table
          columns={columns.filter(col => !tableConfig.hiddenColumns.includes(col.key))}
          dataSource={filteredTrades}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            defaultPageSize: 20,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => (
              <span style={{ color: 'var(--text-secondary)' }}>
                显示 {range[0]}-{range[1]} 条，共 {total} 条
              </span>
            ),
          }}
          scroll={{ x: hasJigsawData ? 2000 : 1100 }}
          size={rowHeightMap[tableConfig.rowHeight]?.size || 'middle'}
          className={`binance-table row-height-${tableConfig.rowHeight}`}
        />
      </div>
      
      {/* 表格设置抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ color: 'var(--color-brand)' }} />
            <span>表格设置</span>
          </div>
        }
        placement="right"
        width={320}
        open={showTableSettings}
        onClose={() => setShowTableSettings(false)}
        styles={{
          header: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' },
          body: { background: 'var(--bg-primary)', padding: 16 },
        }}
      >
        {/* 行间距设置 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            fontSize: 12, 
            fontWeight: 600, 
            color: 'var(--text-secondary)', 
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <ColumnHeightOutlined />
            行间距
          </div>
          <Radio.Group 
            value={tableConfig.rowHeight} 
            onChange={(e) => updateTableConfig({ rowHeight: e.target.value })}
            buttonStyle="solid"
            style={{ width: '100%' }}
          >
            <Radio.Button value="compact" style={{ width: '33.33%', textAlign: 'center' }}>紧凑</Radio.Button>
            <Radio.Button value="middle" style={{ width: '33.33%', textAlign: 'center' }}>标准</Radio.Button>
            <Radio.Button value="large" style={{ width: '33.34%', textAlign: 'center' }}>宽松</Radio.Button>
          </Radio.Group>
        </div>
        
        {/* 列显示设置 */}
        <div>
          <div style={{ 
            fontSize: 12, 
            fontWeight: 600, 
            color: 'var(--text-secondary)', 
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <EyeOutlined />
              列显示
            </span>
            <Button 
              type="link" 
              size="small"
              onClick={() => updateTableConfig({ hiddenColumns: [] })}
              style={{ padding: 0, fontSize: 11 }}
            >
              重置
            </Button>
          </div>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            borderRadius: 8, 
            padding: 12,
            border: '1px solid var(--border-primary)'
          }}>
            {columnDefs
              .filter(col => !col.jigsaw || hasJigsawData)
              .map(col => (
                <div 
                  key={col.key}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-primary)'
                  }}
                >
                  <span style={{ 
                    fontSize: 12, 
                    color: tableConfig.hiddenColumns.includes(col.key) 
                      ? 'var(--text-tertiary)' 
                      : 'var(--text-primary)' 
                  }}>
                    {col.label}
                    {col.jigsaw && (
                      <span style={{ 
                        fontSize: 9, 
                        marginLeft: 4, 
                        color: 'var(--text-tertiary)',
                        background: 'var(--bg-tertiary)',
                        padding: '1px 4px',
                        borderRadius: 2
                      }}>
                        Jigsaw
                      </span>
                    )}
                  </span>
                  <Switch
                    size="small"
                    checked={!tableConfig.hiddenColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                </div>
              ))
            }
          </div>
        </div>
        
        {/* 提示 */}
        <div style={{ 
          marginTop: 24, 
          padding: 12, 
          background: 'rgba(212, 175, 55, 0.1)', 
          borderRadius: 8,
          border: '1px solid rgba(212, 175, 55, 0.2)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            💡 提示：左右拖动表格可以水平滚动
          </div>
        </div>
      </Drawer>

      {/* 编辑模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 6, 
              background: 'var(--color-brand-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <EditOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>交易复盘</span>
          </div>
        }
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={680}
        okButtonProps={{
          style: {
            background: 'var(--color-brand)',
            borderColor: 'var(--color-brand)',
            color: 'var(--bg-primary)',
            fontWeight: 600,
            borderRadius: 4
          }
        }}
        cancelButtonProps={{
          style: {
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
            borderRadius: 4
          }
        }}
      >
        {editingTrade && (() => {
          const mae = editingTrade.mae ?? editingTrade.jigsawData?.mae;
          const mfe = editingTrade.mfe ?? editingTrade.jigsawData?.mfe;
          const fills = editingTrade.fills ?? editingTrade.jigsawData?.fills;
          const maeUSD = mae !== undefined ? ticksToUSD(mae, editingTrade.instrumentCode, editingTrade.openQuantity, instruments) : null;
          const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, editingTrade.instrumentCode, editingTrade.openQuantity, instruments) : null;
          
          const rMultiple = calcRiskRewardRatio(editingTrade.pnl, maeUSD);
          const profitCapture = calcProfitCaptureRate(mfeUSD, editingTrade.pnl);
          const riskExposure = calcRiskExposureIndex(maeUSD, mfeUSD, editingTrade.pnl);
          const stressScore = calcDrawdownStressIndex(maeUSD, editingTrade.pnl, editingTrade.holdingSeconds);
          const execComplexity = calcExecutionComplexity(fills, editingTrade.openQuantity);
          const diagnoses = getAutoDiagnosis(editingTrade, maeUSD, mfeUSD);
          
          return (
            <>
              {/* 交易基础信息 */}
          <div 
            className="mb-4 p-3 rounded-lg flex items-center justify-between"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <div className="flex items-center gap-3">
              <span 
                className="font-mono font-bold px-2 py-1 rounded"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {editingTrade.instrumentCode}
              </span>
              <span style={{ color: editingTrade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                {editingTrade.direction === 'LONG' ? '多' : '空'}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {dayjs(editingTrade.openTime).format('YYYY-MM-DD HH:mm')}
              </span>
            </div>
            <div 
              className="font-mono font-bold text-lg"
              style={{ color: editingTrade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
            >
              {editingTrade.pnl >= 0 ? '+' : ''}{editingTrade.pnl?.toFixed(2)}
            </div>
              </div>

              {/* 波动区间可视化 */}
              {(mae !== undefined || mfe !== undefined) && (
                <div 
                  className="mb-4 p-4 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <BarChartOutlined style={{ color: 'var(--color-brand)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>交易波动区间</span>
                  </div>
                  <TradeRangeBar mae={mae} mfe={mfe} pnl={editingTrade.pnl} maeUSD={maeUSD} mfeUSD={mfeUSD} />
          </div>
        )}

              {/* 高级分析指标网格 */}
              {(maeUSD || mfeUSD) && (
                <div 
                  className="mb-4 p-4 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ThunderboltOutlined style={{ color: 'var(--color-brand)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>高级分析指标</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* R倍数 */}
                    <div className="p-3 rounded" style={{ background: 'var(--bg-primary)' }}>
                      <Tooltip title="R-Multiple: PnL / |MAE|，衡量风险回报效率">
                        <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          R倍数 <InfoCircleOutlined />
                        </div>
                      </Tooltip>
                      <div 
                        className="text-xl font-bold font-mono"
                        style={{ color: rMultiple !== null ? (rMultiple >= 1 ? 'var(--color-profit)' : rMultiple >= 0 ? 'var(--color-brand)' : 'var(--color-loss)') : 'var(--text-tertiary)' }}
                      >
                        {rMultiple !== null ? `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R` : '-'}
                      </div>
                    </div>
                    
                    {/* 利润捕获率 */}
                    <div className="p-3 rounded" style={{ background: 'var(--bg-primary)' }}>
                      <Tooltip title="利润捕获率: 实际盈利 / 最大浮盈，越高越好">
                        <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          利润捕获 <InfoCircleOutlined />
                        </div>
                      </Tooltip>
                      <div 
                        className="text-xl font-bold font-mono"
                        style={{ color: profitCapture !== null ? (profitCapture >= 70 ? 'var(--color-profit)' : profitCapture < 30 ? 'var(--color-loss)' : 'var(--color-brand)') : 'var(--text-tertiary)' }}
                      >
                        {profitCapture !== null ? `${profitCapture.toFixed(0)}%` : '-'}
                      </div>
                    </div>
                    
                    {/* 风险占用比 */}
                    <div className="p-3 rounded" style={{ background: 'var(--bg-primary)' }}>
                      <Tooltip title="风险占用比: |MAE|/(|PnL|或MFE)，评估承担的风险">
                        <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          风险占用 <InfoCircleOutlined />
                        </div>
                      </Tooltip>
                      <div 
                        className="text-xl font-bold font-mono"
                        style={{ color: riskExposure !== null ? (riskExposure < 0.5 ? 'var(--color-profit)' : riskExposure > 2 ? 'var(--color-loss)' : 'var(--color-brand)') : 'var(--text-tertiary)' }}
                      >
                        {riskExposure !== null ? riskExposure.toFixed(2) : '-'}
                      </div>
                    </div>
                    
                    {/* 心理压力系数 */}
                    <div className="p-3 rounded" style={{ background: 'var(--bg-primary)' }}>
                      <Tooltip title="心理压力系数: 根据MAE占比和持仓时长计算">
                        <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          心理压力 <InfoCircleOutlined />
                        </div>
                      </Tooltip>
                      <div className="mt-1">
                        <StressIndicator score={stressScore} />
                      </div>
                    </div>
                    
                    {/* 执行复杂度 */}
                    <div className="p-3 rounded" style={{ background: 'var(--bg-primary)' }}>
                      <Tooltip title="执行复杂度: Fills/Quantity，值越高说明操作越频繁">
                        <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          执行复杂度 <InfoCircleOutlined />
                        </div>
                      </Tooltip>
                      <div 
                        className="text-xl font-bold font-mono"
                        style={{ color: execComplexity !== null ? (execComplexity <= 2 ? 'var(--color-profit)' : execComplexity > 4 ? 'var(--color-loss)' : 'var(--color-brand)') : 'var(--text-tertiary)' }}
                      >
                        {execComplexity !== null ? execComplexity.toFixed(1) : '-'}
                      </div>
                    </div>
                    
                    {/* 持仓时长 */}
                    <div className="p-3 rounded" style={{ background: 'var(--bg-primary)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>持仓时长</div>
                      <div className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                        {formatHoldingTime(editingTrade.holdingSeconds)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 自动归因诊断 */}
              {diagnoses.length > 0 && (
                <div 
                  className="mb-4 p-4 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <BulbOutlined style={{ color: 'var(--color-brand)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>自动归因诊断</span>
                  </div>
                  <div className="space-y-2">
                    {diagnoses.map((d, i) => (
                      <div 
                        key={i}
                        className="flex items-start gap-3 p-2 rounded"
                        style={{ background: d.color + '10' }}
                      >
                        <div 
                          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: d.color + '30' }}
                        >
                          {d.type === 'greed' && <WarningOutlined style={{ color: d.color, fontSize: 12 }} />}
                          {d.type === 'badExit' && <ExclamationCircleOutlined style={{ color: d.color, fontSize: 12 }} />}
                          {d.type === 'hesitation' && <AlertOutlined style={{ color: d.color, fontSize: 12 }} />}
                          {d.type === 'perfect' && <SafetyOutlined style={{ color: d.color, fontSize: 12 }} />}
                          {d.type === 'pressure' && <HeartOutlined style={{ color: d.color, fontSize: 12 }} />}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: d.color }}>{d.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{d.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        <Form form={form} layout="vertical">
          <Form.Item 
            name="strategyIds" 
            label={<span style={{ color: 'var(--text-secondary)' }}>交易策略</span>}
          >
            <Select 
              mode="multiple" 
              placeholder="选择使用的策略..." 
              options={strategies.map(s => ({ value: s.id, label: s.name }))} 
            />
          </Form.Item>
          <Form.Item 
            name="logicAnalysis" 
            label={<span style={{ color: 'var(--text-secondary)' }}>技术分析 / 入场逻辑</span>}
          >
            <TextArea 
              rows={3} 
              placeholder="描述入场时的市场背景、技术信号..." 
            />
          </Form.Item>
          <Form.Item 
            name="notes" 
            label={<span style={{ color: 'var(--text-secondary)' }}>复盘笔记</span>}
          >
            <TextArea 
              rows={3} 
              placeholder="记录心态、失误、可改进之处..." 
            />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .binance-table .ant-table {
          background: transparent !important;
        }
        .binance-table .ant-table-thead > tr > th {
          background: var(--bg-tertiary) !important;
          color: var(--text-secondary) !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.8px !important;
          border-bottom: 1px solid var(--border-primary) !important;
          padding: 16px 20px !important;
        }
        .binance-table .ant-table-tbody > tr > td {
          background: var(--bg-secondary) !important;
          border-bottom: 1px solid var(--border-primary) !important;
          padding: 18px 20px !important;
          transition: background 0.15s ease !important;
        }
        .binance-table .ant-table-tbody > tr:hover > td {
          background: var(--bg-hover) !important;
        }
        .binance-table .ant-table-tbody > tr.ant-table-row-selected > td {
          background: var(--color-brand-bg) !important;
        }
        .binance-table .ant-pagination {
          margin: 16px !important;
        }
        .binance-table .ant-pagination-item {
          background: var(--bg-tertiary) !important;
          border-color: var(--border-primary) !important;
        }
        .binance-table .ant-pagination-item a {
          color: var(--text-secondary) !important;
        }
        .binance-table .ant-pagination-item-active {
          background: var(--color-brand) !important;
          border-color: var(--color-brand) !important;
        }
        .binance-table .ant-pagination-item-active a {
          color: var(--bg-primary) !important;
        }
        .binance-table .ant-table-column-sorter {
          color: var(--text-tertiary) !important;
        }
        .binance-table .ant-table-column-sorter-up.active,
        .binance-table .ant-table-column-sorter-down.active {
          color: var(--color-brand) !important;
        }
        .binance-table .ant-empty-description {
          color: var(--text-tertiary) !important;
        }
        .binance-table .ant-spin-dot-item {
          background-color: var(--color-brand) !important;
        }
        
        /* 拖动滚动 */
        .binance-table .ant-table-body {
          cursor: grab;
        }
        .binance-table .ant-table-body:active {
          cursor: grabbing;
        }
        
        /* 行高 - 紧凑 */
        .row-height-compact .ant-table-thead > tr > th {
          padding: 8px 12px !important;
          font-size: 10px !important;
        }
        .row-height-compact .ant-table-tbody > tr > td {
          padding: 6px 12px !important;
        }
        .row-height-compact .ant-table-tbody > tr > td * {
          font-size: 11px !important;
        }
        
        /* 行高 - 标准 (默认) */
        .row-height-middle .ant-table-thead > tr > th {
          padding: 12px 16px !important;
        }
        .row-height-middle .ant-table-tbody > tr > td {
          padding: 12px 16px !important;
        }
        
        /* 行高 - 宽松 */
        .row-height-large .ant-table-thead > tr > th {
          padding: 18px 20px !important;
        }
        .row-height-large .ant-table-tbody > tr > td {
          padding: 20px 20px !important;
        }
        .row-height-large .ant-table-tbody > tr > td * {
          font-size: 14px !important;
        }
      `}</style>
    </div>
  );
};

export default TradeList;
