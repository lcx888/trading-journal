import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Table, Tag, Space, Select, DatePicker, Input, Button, 
  Modal, Form, message, Popconfirm, Tooltip, Dropdown, Progress,
  Switch, Radio, Drawer, Checkbox, InputNumber
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
  MergeCellsOutlined,
  SplitCellsOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import StorageService from '../services/storage';
import { processTradesWithMerge } from '../services/tradeMerge';

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

// 根据品种配置计算手续费（双边：开仓+平仓）
const calculateTradeFee = (trade, instruments) => {
  // 兼容多种品种代码字段名
  const tradeCode = trade.instrumentCode || trade.instrument || trade.symbol;
  const instrument = instruments.find(i => 
    i.code === tradeCode || 
    i.code?.toUpperCase() === tradeCode?.toUpperCase()
  );
  const feeRate = instrument?.feeRate || 0; // 单边手续费（每手）
  const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
  // 一笔完整交易包含开仓和平仓，所以手续费 = 单边费率 × 手数 × 2
  return feeRate * quantity * 2;
};

// ========== 高级分析指标计算函数 ==========

/**
 * 利润捕获率 (Profit Capture Rate)
 * 公式：max(0, PnL) / MFE × 100%
 * 意义：反映你能留住多少浮盈。100% = 完美止盈在最高点，0% = 浮盈全部回吐
 * 越高越好
 */
const calcProfitCaptureRate = (mfeUSD, pnl) => {
  if (!mfeUSD || mfeUSD <= 0) return null;
  return (Math.max(0, pnl) / mfeUSD) * 100;
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
 * 逻辑：PnL / |MAE|，使用实际最大浮亏作为风险基准
 * 注意：这是事后计算，基于实际 MAE（最大不利偏移）而非预设止损
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
// MAE = 最大不利偏移（最大浮亏），MFE = 最大有利偏移（最大浮盈）
// 图示：[---MAE区域(红)---|入场点|---MFE区域(绿)---]
//       最低点          0     最高点
// 出场点(PnL)可能在入场点左侧(亏损)或右侧(盈利)
const TradeRangeBar = ({ mae, mfe, pnl, maeUSD, mfeUSD }) => {
  if (!mae && !mfe) return null;
  
  // 使用绝对值
  const absMAE = Math.abs(maeUSD || 0);
  const absMFE = Math.abs(mfeUSD || 0);
  const total = absMAE + absMFE;
  
  if (total === 0) return null;
  
  // 入场点在整个条的位置（MAE占比的位置就是入场点）
  const entryPercent = (absMAE / total) * 100;
  const maePercent = entryPercent;
  const mfePercent = 100 - entryPercent;
  
  // PnL 在范围内的位置
  // - 入场点 = entryPercent
  // - 盈利时：出场点在入场点右侧，最大到100%（当 pnl = MFE）
  // - 亏损时：出场点在入场点左侧，最小到0%（当 pnl = -MAE）
  let pnlPosition = entryPercent; // 默认入场点（即 pnl=0）
  
  if (pnl >= 0 && absMFE > 0) {
    // 盈利：从入场点向右移动
    // pnl = MFE 时，位置 = 100%
    // pnl = 0 时，位置 = entryPercent
    const ratio = Math.min(pnl / absMFE, 1); // 限制最大为1
    pnlPosition = entryPercent + ratio * mfePercent;
  } else if (pnl < 0 && absMAE > 0) {
    // 亏损：从入场点向左移动
    // pnl = -MAE 时，位置 = 0%
    // pnl = 0 时，位置 = entryPercent
    const ratio = Math.min(Math.abs(pnl) / absMAE, 1); // 限制最大为1
    pnlPosition = entryPercent - ratio * maePercent;
  }
  
  // 确保在可见范围内
  pnlPosition = Math.max(2, Math.min(98, pnlPosition));
  
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

// 持仓路径可视化组件（支持缩放）
// 复盘问题模板
const REVIEW_TEMPLATES = {
  '首仓': {
    title: '开仓复盘',
    questions: [
      { key: 'entrySignal', label: '入场信号', placeholder: '是什么信号触发了这次入场？' },
      { key: 'marketContext', label: '市场背景', placeholder: '当时的市场环境是怎样的？' },
    ]
  },
  '加仓': {
    title: '加仓复盘',
    questions: [
      { key: 'reason', label: '加仓原因', placeholder: '为什么选择在这个位置加仓？' },
    ]
  },
  '减仓': {
    title: '减仓复盘',
    questions: [
      { key: 'reason', label: '减仓原因', placeholder: '为什么选择减仓而不是持有？' },
    ]
  },
  '平仓': {
    title: '平仓复盘',
    questions: [
      { key: 'exitSignal', label: '平仓信号', placeholder: '是什么信号触发了平仓？' },
    ]
  }
};

// 获取复盘笔记存储 key
const getReviewStorageKey = (tradeGroupId) => `trade_review_${tradeGroupId}`;

// 读取复盘笔记
const loadReviewNotes = (tradeGroupId) => {
  try {
    const data = localStorage.getItem(getReviewStorageKey(tradeGroupId));
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

// 保存复盘笔记
const saveReviewNotes = (tradeGroupId, notes) => {
  localStorage.setItem(getReviewStorageKey(tradeGroupId), JSON.stringify(notes));
};

// 检查合并组是否有复盘数据（localStorage）
const hasMergeReviewData = (tradeId) => {
  try {
    const key = getReviewStorageKey(tradeId);
    const data = localStorage.getItem(key);
    if (!data) return false;
    const notes = JSON.parse(data);
    // 检查是否有任何非空的复盘笔记
    return Object.values(notes).some(note => {
      if (!note || typeof note !== 'object') return false;
      return Object.values(note).some(val => val && String(val).trim() !== '');
    });
  } catch {
    return false;
  }
};

// 检查单笔交易是否有复盘数据（数据库字段）
const hasTradeReviewData = (trade) => {
  if (!trade) return false;
  // 检查复盘相关字段是否有内容
  const reviewFields = ['notes', 'entryReason', 'stopLossReason', 'takeProfitReason', 'expectedTrend'];
  return reviewFields.some(field => trade[field] && String(trade[field]).trim() !== '');
};

const PositionChart = ({ trades, overallDirection, dayjs, onStartReview, reviewNotes }) => {
  const [scale, setScale] = useState(1);
  const [hoveredNode, setHoveredNode] = useState(null);
  const containerRef = useRef(null);
  const svgWrapperRef = useRef(null);

  // 使用 useEffect 添加非 passive 的 wheel 事件监听器
  useEffect(() => {
    const wrapper = svgWrapperRef.current;
    if (!wrapper) return;
    
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
    };
    
    // 添加非 passive 的事件监听器
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      wrapper.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 构建时间线事件
  const events = [];
  trades.forEach((t) => {
    const qty = Math.abs(t.openQuantity || 1);
    events.push({
      time: new Date(t.openTime).getTime(),
      type: 'open',
      qty,
      price: t.openPrice || 0,
      trade: t
    });
    events.push({
      time: new Date(t.closeTime).getTime(),
      type: 'close',
      qty,
      price: t.closePrice || 0,
      trade: t
    });
  });
  events.sort((a, b) => a.time - b.time);

  // 构建曲线数据点
  const curvePoints = [];
  let pos = 0;
  let curveAvgPrice = 0;

  events.forEach((event) => {
    const prevPos = pos;
    const prevAvgPrice = curveAvgPrice;

    if (event.type === 'open') {
      curveAvgPrice = prevPos === 0 ? event.price : (prevPos * curveAvgPrice + event.qty * event.price) / (prevPos + event.qty);
      pos += event.qty;
    } else {
      pos -= event.qty;
    }

    let label, color, isProfitAction = false;
    const priceDiff = (event.price - prevAvgPrice) * overallDirection;
    
    // 计算此时此刻的浮盈浮亏金额 (基于当前价格和之前的持仓均价)
    // 浮盈亏 = (现价 - 均价) * 持仓数量 * 方向 * 乘数(如果有)
    // 注意：这里的 pnl 应该是基于品种的最小跳动值和每跳价值计算的，
    // 但如果 trades 中已经有了单笔 pnl，我们可以推算出价格与金额的比例
    const firstTrade = trades[0];
    const priceToPnlRatio = firstTrade && firstTrade.openQuantity && (firstTrade.closePrice - firstTrade.openPrice) !== 0 
      ? Math.abs(firstTrade.pnl / ((firstTrade.closePrice - firstTrade.openPrice) * firstTrade.openQuantity))
      : 1; // 默认比例为 1，如果无法推算

    const floatingPnl = prevPos > 0 ? (event.price - prevAvgPrice) * prevPos * overallDirection * priceToPnlRatio : 0;

    if (event.type === 'open') {
      label = prevPos === 0 ? '首仓' : '加仓';
      isProfitAction = prevPos > 0 && priceDiff > 0;
      color = prevPos === 0 ? 'var(--color-brand)' : (isProfitAction ? '#22c55e' : '#ef4444');
    } else {
      label = pos === 0 ? '平仓' : '减仓';
      isProfitAction = priceDiff > 0;
      color = isProfitAction ? '#22c55e' : '#ef4444';
    }

    curvePoints.push({
      time: event.time,
      position: pos,
      prevPosition: prevPos,
      avgPrice: curveAvgPrice,
      price: event.price,
      label,
      color,
      isProfitAction,
      qty: event.qty,
      type: event.type,
      floatingPnl,
      // 如果是平仓，使用订单自带的精确盈亏金额；如果是加减仓，显示计算出的浮动盈亏金额
      displayPnl: event.type === 'close' ? (event.trade?.pnl || (event.price - prevAvgPrice) * event.qty * overallDirection * priceToPnlRatio) : floatingPnl
    });
  });

  const baseHeight = 500; // 增加基础高度
  const svgWidth = 1200;
  const svgHeight = baseHeight * scale;
  const padding = { top: 140, right: 100, bottom: 140, left: 80 }; // 显著增加上下边距，防止标签超出 SVG 范围
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // 计算价格范围 - 紧凑型
  const allPrices = curvePoints.map(p => p.price);
  const allAvgPrices = curvePoints.filter(p => p.avgPrice > 0).map(p => p.avgPrice);
  const minPrice = Math.min(...allPrices, ...allAvgPrices);
  const maxPrice = Math.max(...allPrices, ...allAvgPrices);
  const priceMargin = (maxPrice - minPrice) * 0.4 || 0.1; // 增加价格边距，让曲线在中间，为上下标签留出更多空间
  const chartMinPrice = minPrice - priceMargin;
  const chartMaxPrice = maxPrice + priceMargin;
  const priceRange = chartMaxPrice - chartMinPrice || 1;

  const minTime = curvePoints[0]?.time || 0;
  const maxTime = curvePoints[curvePoints.length - 1]?.time || 1;
  const timeRange = maxTime - minTime || 1;
  const maxPos = Math.max(...curvePoints.map(p => p.position), 1);

  const getX = (time) => padding.left + ((time - minTime) / timeRange) * chartWidth;
  const getY = (price) => padding.top + chartHeight - ((price - chartMinPrice) / priceRange) * chartHeight;

  return (
    <div ref={containerRef} className="modern-chart-container">
      <div className="modern-chart-header">
        <div className="header-info">
          <div className="direction-tag" style={{ color: overallDirection === 1 ? '#22c55e' : '#ef4444' }}>
            {overallDirection === 1 ? '做多' : '做空'}
          </div>
          <div className="stats-group">
            <div className="stat">
              <span className="label">总盈亏</span>
              <span className="value" style={{ color: trades.reduce((s,t)=>s+(t.pnl||0),0) >= 0 ? '#22c55e' : '#ef4444' }}>
                {trades.reduce((s,t)=>s+(t.pnl||0),0).toFixed(2)}
              </span>
            </div>
            <div className="stat">
              <span className="label">交易数</span>
              <span className="value">{trades.length}</span>
            </div>
          </div>
          {/* 复盘引导提示 */}
          <div style={{ 
            marginLeft: 24, 
            padding: '4px 12px', 
            background: 'var(--color-brand)15', 
            border: '1px solid var(--color-brand)30',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'pulse-soft 2s infinite'
          }}>
            <EditOutlined style={{ color: 'var(--color-brand)', fontSize: 12 }} />
            <span style={{ fontSize: 11, color: 'var(--color-brand)', fontWeight: 600 }}>点击节点标签记录复盘逻辑</span>
          </div>
        </div>
        <div className="header-controls">
          <div className="legend">
            <div className="item"><span className="dot" style={{ background: '#22c55e' }}></span> 盈利操作</div>
            <div className="item"><span className="dot" style={{ background: '#ef4444' }}></span> 亏损操作</div>
            <div className="item"><span className="line" style={{ borderTop: '1px dashed var(--text-tertiary)' }}></span> 均价线</div>
          </div>
          <button className="reset-btn" onClick={() => setScale(1)}>RESET</button>
        </div>
      </div>

      <div className="modern-svg-wrapper" ref={svgWrapperRef}>
        <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="modern-svg">
          <defs>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 网格 - 仅显示实际出现的关键价格 */}
          <g className="grid">
            {[chartMinPrice, minPrice, (minPrice + maxPrice) / 2, maxPrice, chartMaxPrice].map((price, i) => (
              <g key={i}>
                <line x1={padding.left} y1={getY(price)} x2={svgWidth - padding.right} y2={getY(price)} stroke="var(--border-primary)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.3" />
                <text x={padding.left - 10} y={getY(price) + 4} textAnchor="end" fontSize="10" fill="var(--text-tertiary)" fontFamily="monospace">{price.toFixed(2)}</text>
              </g>
            ))}
          </g>

          {/* 均价线 */}
          <path
            d={curvePoints.filter(p => p.avgPrice > 0).map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.time)} ${getY(p.avgPrice)}`).join(' ')}
            fill="none" stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="5,5" opacity="0.6"
          />

          {/* 价格主线 */}
          {curvePoints.length > 1 && curvePoints.slice(0, -1).map((p, i) => {
            const nextP = curvePoints[i + 1];
            return (
              <line
                key={i}
                x1={getX(p.time)} y1={getY(p.price)} x2={getX(nextP.time)} y2={getY(nextP.price)}
                stroke="var(--text-primary)" strokeWidth={Math.max(1.5, (p.position / maxPos) * 6)} strokeLinecap="round"
              />
            );
          })}

          {/* 节点与标签 - 错位排列防止重叠 */}
          {curvePoints.map((p, i) => {
            const isHovered = hoveredNode === i;
            
            // 改进的防重叠逻辑：
            // 1. 增加 Y 轴偏移的跨度，使用更大幅度的错位
            // 2. 增加 X 轴微调：如果两个点的时间非常接近，则根据索引进行左右微调
            const offsets = [-120, -60, 60, 120];
            const labelYOffset = offsets[i % 4];
            
            // X 轴微调：如果相邻点 X 坐标差距小于 40 像素，则进行左右偏移
            let xOffset = 0;
            if (i > 0) {
              const prevX = getX(curvePoints[i-1].time);
              const currentX = getX(p.time);
              if (Math.abs(currentX - prevX) < 40) {
                // 根据索引奇偶性向左或向右偏移
                xOffset = (i % 2 === 0 ? -30 : 30);
              }
            }
            
            const xPos = getX(p.time);
            const yPos = getY(p.price);
            const finalX = xPos + xOffset;

            return (
              <g key={i} onMouseEnter={() => setHoveredNode(i)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'pointer' }}>
                {isHovered && <line x1={xPos} y1={padding.top} x2={xPos} y2={svgHeight - padding.bottom} stroke="var(--color-brand)" strokeWidth="0.5" strokeDasharray="2,2" />}
                
                {/* 连线：从节点到标签的指引线 */}
                <path 
                  d={`M ${xPos} ${yPos} L ${finalX} ${yPos + (labelYOffset > 0 ? labelYOffset - 25 : labelYOffset + 25)}`}
                  fill="none"
                  stroke={p.color} 
                  strokeWidth="0.5" 
                  opacity="0.4" 
                />

                <circle cx={xPos} cy={yPos} r={isHovered ? 6 : 4} fill={p.color} filter="url(#softGlow)" />
                
                <g transform={`translate(${finalX}, ${yPos + labelYOffset})`}>
                  {/* 文字背景遮罩 - 增大尺寸以适应更大的字号 */}
                  <rect 
                    x="-50" y="-22" width="100" height="75" 
                    fill="var(--bg-primary)" 
                    fillOpacity="0.9" 
                    rx="6"
                    stroke="var(--border-primary)"
                    strokeWidth="0.5"
                  />

                  {/* 可点击的标签 - 用于复盘 */}
                  <g 
                    onClick={(e) => { e.stopPropagation(); onStartReview && onStartReview(i, p); }}
                    style={{ cursor: 'pointer' }}
                    className="review-label-btn"
                  >
                    <rect x="-32" y="-18" width="64" height="22" rx="4" fill={reviewNotes[i] ? `${p.color}30` : 'transparent'} stroke={reviewNotes[i] ? p.color : 'transparent'} strokeWidth="1" />
                    <text textAnchor="middle" fontSize="12" fontWeight="800" fill={p.color} dy="-3">{p.label}</text>
                    {/* 已有笔记的标记 */}
                    {reviewNotes[i] && (
                      <circle cx="28" cy="-8" r="4" fill="var(--color-brand)" />
                    )}
                  </g>
                  <text textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-primary)" dy="12">{p.type === 'open' ? '+' : '-'}{p.qty}手 @ {p.price.toFixed(2)}</text>
                  
                  {/* 显示此时此刻的手中单量 */}
                  <text textAnchor="middle" fontSize="10" fill="var(--text-tertiary)" dy="26">
                    持仓: {p.position.toFixed(1)}手
                  </text>

                  {/* 显示浮盈浮亏具体金额 */}
                  {p.displayPnl !== 0 && (
                    <text textAnchor="middle" fontSize="12" fontWeight="900" fill={p.displayPnl >= 0 ? '#22c55e' : '#ef4444'} dy="42">
                      {p.displayPnl >= 0 ? '盈' : '亏'} {p.displayPnl >= 0 ? '+' : ''}{p.displayPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </text>
                  )}
                </g>

                {isHovered && (
                  <g transform={`translate(${getX(p.time)}, ${svgHeight - padding.bottom + 15})`}>
                    <text textAnchor="middle" fontSize="10" fill="var(--text-secondary)" fontFamily="monospace">{dayjs(p.time).format('HH:mm:ss')}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* curvePoints 导出给父组件用于交易明细列表 */}
    </div>
  );
};

const TradeList = ({ activeRecordId = 'all' }) => {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [filteredTrades, setFilteredTrades] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [hasJigsawData, setHasJigsawData] = useState(false);
  const [traderName, setTraderName] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // 移动端检测
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [filters, setFilters] = useState({
    instrument: 'ALL',
    direction: 'ALL',
    result: 'ALL',
    session: 'ALL',
    strategy: 'ALL',
    dateRange: null,
    keyword: '',
    source: 'ALL',
    rating: 'ALL', // 新增评级筛选
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [form] = Form.useForm();
  
  // MAE/MFE 内联编辑状态
  const [editingMaeMfe, setEditingMaeMfe] = useState({ tradeId: null, field: null, trade: null });
  const [editingValue, setEditingValue] = useState(null);
  const [maeMfeInputMode, setMaeMfeInputMode] = useState('tick'); // 'tick' 或 'usd' - 输入模式
  const maeMfeInputRef = useRef(null); // 输入框引用
  
  // 合并交易状态
  const [mergeEnabled, setMergeEnabled] = useState(true); // 是否启用合并显示
  const [selectedMergeGroup, setSelectedMergeGroup] = useState(null); // 选中的合并组（用于抽屉）
  const [mergeDrawerOpen, setMergeDrawerOpen] = useState(false); // 抽屉开关
  
  // 复盘功能状态
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewingEvent, setReviewingEvent] = useState(null); // { index, point, groupId }
  const [reviewNotes, setReviewNotes] = useState({});
  const [editingReview, setEditingReview] = useState({});
  
  // 保存为策略状态
  const [saveStrategyModalVisible, setSaveStrategyModalVisible] = useState(false);
  const [strategyForm] = Form.useForm();
  
  // ========== 表格配置状态 ==========
  const [tableConfig, setTableConfig] = useState(loadTableConfig);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
    { key: 'mae', label: '最大浮亏', jigsaw: true },
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
    let cleanup = () => {};
    
    // 延迟绑定以确保 Portal 渲染完成
    const timer = setTimeout(() => {
    const wrapper = tableWrapperRef.current;
      if (!wrapper) return;
      
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
        if (e.target.closest('button, a, .ant-dropdown-trigger, .ant-btn, .ant-input-number')) return;
      
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
    
      cleanup = () => {
      wrapper.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    }, 50);
    
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [filteredTrades, isFullscreen]); // 数据变化或全屏状态变化时重新绑定

  useEffect(() => { loadData(); }, [activeRecordId]);
  useEffect(() => { applyFilters(); }, [trades, filters, mergeEnabled, instruments]);

  useEffect(() => {
    const name = StorageService.getTraderName();
    setTraderName(name);
  }, []);

  // ESC 键退出全屏
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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
        t.entryReason?.toLowerCase().includes(kw) ||
        t.stopLossReason?.toLowerCase().includes(kw) ||
        t.takeProfitReason?.toLowerCase().includes(kw) ||
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
    // 应用合并检测
    if (mergeEnabled) {
      const mergedResult = processTradesWithMerge(result, instruments);
      setFilteredTrades(mergedResult);
    } else {
      setFilteredTrades(result.map(t => ({ ...t, isMergedGroup: false })));
    }
  };

  // 打开合并组详情抽屉
  const openMergeDrawer = (record) => {
    if (record.isMergedGroup && record.mergeStats) {
      setSelectedMergeGroup(record);
      setMergeDrawerOpen(true);
      // 加载该组的复盘笔记
      setReviewNotes(loadReviewNotes(record.id || 'default'));
    }
  };

  // 关闭抽屉
  const closeMergeDrawer = () => {
    setMergeDrawerOpen(false);
    setSelectedMergeGroup(null);
    setReviewModalVisible(false);
    setReviewingEvent(null);
  };
  
  // 开始复盘某个事件
  const handleStartReview = (index, point) => {
    const groupId = selectedMergeGroup?.id || 'default';
    setReviewingEvent({ index, point, groupId });
    setEditingReview(reviewNotes[index] || {});
    setReviewModalVisible(true);
  };
  
  // 保存复盘
  const handleSaveReview = () => {
    if (reviewingEvent !== null) {
      const newNotes = { ...reviewNotes, [reviewingEvent.index]: editingReview };
      setReviewNotes(newNotes);
      saveReviewNotes(reviewingEvent.groupId, newNotes);
      setReviewModalVisible(false);
      setReviewingEvent(null);
      setEditingReview({});
      message.success('复盘笔记已保存');
    }
  };
  
  // 取消复盘
  const handleCancelReview = () => {
    setReviewModalVisible(false);
    setReviewingEvent(null);
    setEditingReview({});
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
      entryReason: trade.entryReason || '',
      stopLossReason: trade.stopLossReason || '',
      takeProfitReason: trade.takeProfitReason || '',
      notes: trade.notes || '',
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

  // 打开保存为策略对话框
  const handleOpenSaveStrategy = () => {
    const vals = form.getFieldsValue();
    // 检查是否有内容可保存
    if (!vals.entryReason && !vals.stopLossReason && !vals.takeProfitReason && !vals.notes) {
      message.warning('请先填写复盘内容再保存为策略');
      return;
    }
    strategyForm.resetFields();
    strategyForm.setFieldsValue({
      category: '通用',
      color: '#eab308',
    });
    setSaveStrategyModalVisible(true);
  };

  // 保存为策略
  const handleSaveAsStrategy = async () => {
    try {
      const strategyVals = await strategyForm.validateFields();
      const reviewVals = form.getFieldsValue();
      
      // 构建策略描述
      const descParts = [];
      if (reviewVals.entryReason) descParts.push(`【入场】${reviewVals.entryReason}`);
      if (reviewVals.stopLossReason) descParts.push(`【止损】${reviewVals.stopLossReason}`);
      if (reviewVals.takeProfitReason) descParts.push(`【止盈】${reviewVals.takeProfitReason}`);
      if (reviewVals.notes) descParts.push(`【备注】${reviewVals.notes}`);
      
      const colorValue = typeof strategyVals.color === 'string' 
        ? strategyVals.color 
        : strategyVals.color?.toHexString?.() || '#eab308';
      
      // 创建策略
      const newStrategy = await StorageService.createStrategy({
        name: strategyVals.name,
        description: descParts.join('\n'),
        color: colorValue,
        category: strategyVals.category,
      });
      
      // 自动关联到当前交易
      const currentStrategyIds = reviewVals.strategyIds || [];
      if (!currentStrategyIds.includes(newStrategy.id)) {
        form.setFieldsValue({ strategyIds: [...currentStrategyIds, newStrategy.id] });
      }
      
      // 刷新策略列表
      const updatedStrategies = await StorageService.getAllStrategies();
      setStrategies(updatedStrategies);
      
      setSaveStrategyModalVisible(false);
      message.success('策略创建成功，已自动关联到当前交易');
    } catch (e) { 
      console.error('保存策略失败:', e);
      message.error('保存策略失败'); 
    }
  };

  const handleDelete = async (id) => {
    try {
      await StorageService.deleteTrade(id);
      message.success('删除成功');
      loadData();
    } catch (e) { message.error('删除失败'); }
  };

  // 开始编辑 MAE/MFE
  const startEditMaeMfe = (tradeId, field, currentValue, trade) => {
    setEditingMaeMfe({ tradeId, field, trade });
    // 如果是 tick 模式，显示原始 tick 值；如果是 USD 模式，显示换算后的 USD 值
    if (maeMfeInputMode === 'tick') {
      // 直接使用 tick 值
      const tickVal = trade?.[field] ?? trade?.jigsawData?.[field];
      setEditingValue(tickVal !== undefined && tickVal !== null ? tickVal : null);
    } else {
      // 使用 USD 值（已换算）
      setEditingValue(currentValue);
    }
  };

  // 保存 MAE/MFE 内联编辑
  const saveMaeMfeInline = useCallback(async (trade, field, value) => {
    try {
      let ticks;
      
      if (maeMfeInputMode === 'tick') {
        // Tick 模式：直接保存输入的 tick 值
        ticks = value !== null && value !== undefined ? Math.round(value) : null;
      } else {
        // USD 模式：将美元转换为 ticks
        const tickValue = getTickValue(trade.instrumentCode, instruments);
        const quantity = Math.abs(trade.openQuantity || 1);
        ticks = value !== null && value !== undefined && tickValue > 0 && quantity > 0
          ? Math.round(value / tickValue / quantity)
          : null;
      }
      
      await StorageService.updateTrade(trade.id, {
        [field]: ticks,
      });
      
      // 更新本地状态
      setTrades(prev => prev.map(t => 
        t.id === trade.id ? { ...t, [field]: ticks } : t
      ));
      
      setEditingMaeMfe({ tradeId: null, field: null, trade: null });
      setEditingValue(null);
    } catch (e) {
      message.error('保存失败');
      console.error(e);
    }
  }, [maeMfeInputMode, instruments]);
  
  // 全局点击监听：点击输入框外部时自动保存
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // 如果没有正在编辑的状态，直接返回
      if (!editingMaeMfe.tradeId || !editingMaeMfe.trade) return;
      
      // 检查点击是否在输入框内
      const inputElement = maeMfeInputRef.current;
      if (inputElement && (inputElement.contains(e.target) || inputElement === e.target)) {
        return; // 点击在输入框内，不处理
      }
      
      // 检查是否点击了 ant-input-number 的内部元素（包括上下箭头）
      const isAntInputNumber = e.target.closest('.ant-input-number');
      if (isAntInputNumber) {
        return; // 点击在 InputNumber 组件内，不处理
      }
      
      // 点击在输入框外，保存当前编辑
      saveMaeMfeInline(editingMaeMfe.trade, editingMaeMfe.field, editingValue);
    };
    
    // 使用 mousedown 而不是 click，这样可以在 blur 之前触发
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [editingMaeMfe, editingValue, saveMaeMfeInline]);

  // 取消编辑
  const cancelEditMaeMfe = () => {
    setEditingMaeMfe({ tradeId: null, field: null, trade: null });
    setEditingValue(null);
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
    });
  };

  const hasActiveFilters = 
    filters.instrument !== 'ALL' || 
    filters.direction !== 'ALL' || 
    filters.result !== 'ALL' || 
    filters.source !== 'ALL' ||
    filters.rating !== 'ALL' ||
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
    
    // 计算最大MAE（单笔最大浮亏/最大不利偏移）
    let maxMAEUSD = 0;
    tradesWithMAE.forEach(t => {
      const mae = t.mae ?? t.jigsawData?.mae ?? 0;
      const maeUSD = ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) || 0;
      if (maeUSD > maxMAEUSD) maxMAEUSD = maeUSD;
    });
    
    // 计算最大实际亏损（单笔最大平仓亏损）
    const lossTrades = filteredTrades.filter(t => t.pnl !== null && t.pnl !== undefined && t.pnl < 0);
    const maxLoss = lossTrades.length > 0 
      ? Math.max(...lossTrades.map(t => Math.abs(t.pnl || 0))) 
      : 0;
    
    return {
      avgMAE: tradesWithMAE.length > 0 ? (totalMAEUSD / tradesWithMAE.length) : 0,
      avgMFE: tradesWithMFE.length > 0 ? (totalMFEUSD / tradesWithMFE.length) : 0,
      maxMAE: maxMAEUSD,  // 单笔最大浮亏
      maxLoss: maxLoss,   // 单笔最大实际亏损
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
      width: 200,
      render: (t, record) => {
        if (record.isMergedGroup && record.mergeStats) {
          const stats = record.mergeStats;
          return (
            <div 
              style={{ 
                padding: '4px 0', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                position: 'relative',
                marginLeft: '-12px', // 抵消 padding 让渐变从最左侧开始
                paddingLeft: '12px'
              }}
              onClick={(e) => { e.stopPropagation(); openMergeDrawer(record); }}
            >
              {/* 左侧淡淡的品牌色渐变条 */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: '10%',
                bottom: '10%',
                width: '3px',
                background: 'linear-gradient(to bottom, transparent, var(--color-brand), transparent)',
                opacity: 0.4,
                borderRadius: '0 4px 4px 0'
              }} />
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'var(--color-brand)10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-brand)20'
              }}>
                <MergeCellsOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {dayjs(stats.firstOpenTime).format('MM-DD HH:mm')}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>→</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {dayjs(stats.lastCloseTime).format('HH:mm')}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-brand)', opacity: 0.8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {stats.tradeCount} 笔合并交易记录
                  {hasMergeReviewData(record.id) && (
                    <Tooltip title="已完成复盘">
                      <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          );
        }
        const reviewed = hasTradeReviewData(record);
        return (
          <div style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div>
            <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
              {dayjs(t).format('MM-DD HH:mm:ss')}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {dayjs(t).format('YYYY')}
            </div>
            </div>
            {reviewed && (
              <Tooltip title="已完成复盘">
                <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} />
              </Tooltip>
            )}
          </div>
        );
      },
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
      render: (_, r) => {
        if (r.isMergedGroup && r.mergeStats) {
          return (
            <div className="text-right">
              <span className="font-mono font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                {r.mergeStats.totalQuantity}
              </span>
              <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                峰值 {r.mergeStats.maxConcurrentQty}
              </div>
            </div>
          );
        }
        return (
          <span className="font-mono font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            {Math.abs(r.openQuantity || 0)}
          </span>
        );
      },
    },
    {
      title: '价格',
      key: 'prices',
      width: 160,
      align: 'right',
      render: (_, r) => {
        if (r.isMergedGroup && r.mergeStats) {
          const stats = r.mergeStats;
          return (
            <div className="font-mono" style={{ padding: '4px 0' }}>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {stats.weightedOpenPrice?.toFixed(2)}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                → {stats.weightedClosePrice?.toFixed(2)} <span style={{ color: 'var(--color-brand)', fontSize: 9 }}>加权</span>
              </div>
            </div>
          );
        }
        return (
          <div className="font-mono" style={{ padding: '4px 0' }}>
            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {r.openPrice?.toFixed(2)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              → {r.closePrice?.toFixed(2)}
            </div>
          </div>
        );
      },
    },
    {
      title: '盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      width: 140,
      align: 'right',
      sorter: (a, b) => (a.pnl || 0) - (b.pnl || 0),
      render: (p, r) => {
        if (r.isMergedGroup && r.mergeStats) {
          const stats = r.mergeStats;
          return (
            <div>
              <div 
                className="font-mono font-bold text-base"
                style={{ color: stats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
              >
                {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL?.toFixed(2)}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                均 {stats.avgPnL >= 0 ? '+' : ''}{stats.avgPnL?.toFixed(0)}/笔
              </div>
            </div>
          );
        }
        return (
          <div 
            className="font-mono font-bold text-base"
            style={{ color: (p || 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
          >
            {(p || 0) >= 0 ? '+' : ''}{(p || 0).toFixed(2)}
          </div>
        );
      },
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
      title: (
        <Tooltip 
          title={
            <span>
              时段根据开仓时间自动判断<br/>
              如显示不正确，请在<b>设置</b>中调整时区
            </span>
          }
          placement="top"
        >
          <span style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            时段
            <InfoCircleOutlined style={{ fontSize: 10, opacity: 0.5 }} />
          </span>
        </Tooltip>
      ),
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
      render: (s, r) => {
        if (r.isMergedGroup && r.mergeStats) {
          return (
            <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatHoldingTime(r.mergeStats.totalDuration)}
            </span>
          );
        }
        return (
          <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
            {formatHoldingTime(s)}
          </span>
        );
      },
    },
    // Jigsaw 专属列 - 内联编辑
    ...(hasJigsawData ? [{
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>最大浮亏</span>
          <Tooltip title={`点击切换输入模式：${maeMfeInputMode === 'tick' ? '当前Tick模式' : '当前美元模式'}`}>
            <span 
              onClick={(e) => { e.stopPropagation(); setMaeMfeInputMode(m => m === 'tick' ? 'usd' : 'tick'); }}
              style={{ 
                cursor: 'pointer', 
                fontSize: 10, 
                padding: '1px 4px', 
                borderRadius: 3,
                background: maeMfeInputMode === 'tick' ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
                color: maeMfeInputMode === 'tick' ? 'var(--color-brand)' : 'var(--text-tertiary)',
                border: `1px solid ${maeMfeInputMode === 'tick' ? 'var(--color-brand)' : 'var(--border-secondary)'}`,
                fontWeight: 600
              }}
            >
              {maeMfeInputMode === 'tick' ? 'T' : '$'}
            </span>
          </Tooltip>
        </div>
      ),
      key: 'mae',
      width: 110,
      align: 'right',
      render: (_, r) => {
        // 合并组不显示 MAE
        if (r.isMergedGroup) return null;
        
        const mae = r.mae ?? r.jigsawData?.mae;
        const maeUSD = mae !== undefined && mae !== null ? ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments) : null;
        const isEditing = editingMaeMfe.tradeId === r.id && editingMaeMfe.field === 'mae';
        
        if (isEditing) {
          return (
            <div ref={maeMfeInputRef}>
            <InputNumber
              autoFocus
              size="small"
              value={editingValue}
              onChange={setEditingValue}
              onPressEnter={() => saveMaeMfeInline(r, 'mae', editingValue)}
              onKeyDown={(e) => e.key === 'Escape' && cancelEditMaeMfe()}
              prefix={maeMfeInputMode === 'tick' ? 'T' : '$'}
              min={0}
              precision={0}
              style={{ width: 80 }}
              className="mae-mfe-input"
            />
            </div>
          );
        }
        
        // 有数据时正常显示
        if (mae !== undefined && mae !== null) {
          return (
            <Tooltip title={maeMfeInputMode === 'tick' ? `$${maeUSD?.toFixed(0) || 0}` : `${mae} ticks`}>
              <span 
                className="font-mono text-sm cursor-pointer hover:text-[var(--color-brand)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-tertiary)] inline-block min-w-[50px] text-right"
                style={{ color: 'var(--text-secondary)' }}
                onClick={(e) => { e.stopPropagation(); startEditMaeMfe(r.id, 'mae', Math.round(maeUSD || 0), r); }}
              >
                {maeMfeInputMode === 'tick' ? `${mae}T` : `$${maeUSD?.toFixed(0) || 0}`}
              </span>
            </Tooltip>
          );
        }
        
        // 无数据时显示占位提示
        return (
          <span 
            className="cursor-pointer transition-all inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]"
            style={{ color: 'var(--text-quaternary)' }}
            onClick={(e) => { e.stopPropagation(); startEditMaeMfe(r.id, 'mae', null, r); }}
            title="点击录入最大浮亏"
          >
            <span style={{ 
              fontSize: 10, 
              padding: '1px 4px', 
              background: 'var(--bg-tertiary)', 
              borderRadius: 3,
              border: '1px dashed var(--border-secondary)',
              color: 'var(--text-tertiary)'
            }}>
              +添加
            </span>
          </span>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>最大浮盈</span>
          <Tooltip title={`点击切换输入模式：${maeMfeInputMode === 'tick' ? '当前Tick模式' : '当前美元模式'}`}>
            <span 
              onClick={(e) => { e.stopPropagation(); setMaeMfeInputMode(m => m === 'tick' ? 'usd' : 'tick'); }}
              style={{ 
                cursor: 'pointer', 
                fontSize: 10, 
                padding: '1px 4px', 
                borderRadius: 3,
                background: maeMfeInputMode === 'tick' ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
                color: maeMfeInputMode === 'tick' ? 'var(--color-brand)' : 'var(--text-tertiary)',
                border: `1px solid ${maeMfeInputMode === 'tick' ? 'var(--color-brand)' : 'var(--border-secondary)'}`,
                fontWeight: 600
              }}
            >
              {maeMfeInputMode === 'tick' ? 'T' : '$'}
            </span>
          </Tooltip>
        </div>
      ),
      key: 'mfe',
      width: 110,
      align: 'right',
      render: (_, r) => {
        // 合并组不显示 MFE
        if (r.isMergedGroup) return null;
        
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        const mfeUSD = mfe !== undefined && mfe !== null ? ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments) : null;
        const isEditing = editingMaeMfe.tradeId === r.id && editingMaeMfe.field === 'mfe';
        
        if (isEditing) {
          return (
            <div ref={maeMfeInputRef}>
            <InputNumber
              autoFocus
              size="small"
              value={editingValue}
              onChange={setEditingValue}
              onPressEnter={() => saveMaeMfeInline(r, 'mfe', editingValue)}
              onKeyDown={(e) => e.key === 'Escape' && cancelEditMaeMfe()}
              prefix={maeMfeInputMode === 'tick' ? 'T' : '$'}
              min={0}
              precision={0}
              style={{ width: 80 }}
              className="mae-mfe-input"
            />
            </div>
          );
        }
        
        // 有数据时正常显示
        if (mfe !== undefined && mfe !== null) {
          return (
            <Tooltip title={maeMfeInputMode === 'tick' ? `$${mfeUSD?.toFixed(0) || 0}` : `${mfe} ticks`}>
              <span 
                className="font-mono text-sm cursor-pointer hover:text-[var(--color-brand)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-tertiary)] inline-block min-w-[50px] text-right"
                style={{ color: 'var(--text-secondary)' }}
                onClick={(e) => { e.stopPropagation(); startEditMaeMfe(r.id, 'mfe', Math.round(mfeUSD || 0), r); }}
              >
                {maeMfeInputMode === 'tick' ? `${mfe}T` : `$${mfeUSD?.toFixed(0) || 0}`}
              </span>
            </Tooltip>
          );
        }
        
        // 无数据时显示占位提示
        return (
          <span 
            className="cursor-pointer transition-all inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]"
            style={{ color: 'var(--text-quaternary)' }}
            onClick={(e) => { e.stopPropagation(); startEditMaeMfe(r.id, 'mfe', null, r); }}
            title="点击录入最大浮盈"
          >
            <span style={{ 
              fontSize: 10, 
              padding: '1px 4px', 
              background: 'var(--bg-tertiary)', 
              borderRadius: 3,
              border: '1px dashed var(--border-secondary)',
              color: 'var(--text-tertiary)'
            }}>
              +添加
            </span>
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
    // 需要 MAE 数据的提示组件
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
        if (r.isMergedGroup) return null;
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) {
          return (
            <Tooltip title="录入 MAE 后自动计算">
              <span style={{ fontSize: 9, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>需MAE</span>
            </Tooltip>
          );
        }
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        const rMultiple = calcRiskRewardRatio(r.pnl, maeUSD);
        if (rMultiple === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
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
      width: 80,
      align: 'right',
      sorter: (a, b) => {
        const mfeA = ticksToUSD(a.mfe ?? a.jigsawData?.mfe, a.instrumentCode, a.openQuantity, instruments);
        const mfeB = ticksToUSD(b.mfe ?? b.jigsawData?.mfe, b.instrumentCode, b.openQuantity, instruments);
        const prA = calcProfitCaptureRate(mfeA, a.pnl) || 0;
        const prB = calcProfitCaptureRate(mfeB, b.pnl) || 0;
        return prA - prB;
      },
      render: (_, r) => {
        if (r.isMergedGroup) return null;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        if (mfe === undefined || mfe === null) {
          return (
            <Tooltip title="录入 MFE 后自动计算">
              <span style={{ fontSize: 9, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>需MFE</span>
            </Tooltip>
          );
        }
        const mfeUSD = ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments);
        const capture = calcProfitCaptureRate(mfeUSD, r.pnl);
        if (capture === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const isGood = capture >= 80;
        const isAbnormal = capture > 100;
        return (
          <Tooltip title={isAbnormal ? '⚠️ 超过100%可能因分批建仓导致统计不准确' : `利润捕获率: ${capture.toFixed(1)}%`}>
            <span 
              className="font-mono text-sm font-semibold" 
              style={{ 
                color: isAbnormal ? '#f59e0b' : (isGood ? 'var(--color-profit)' : 'var(--text-secondary)'),
                cursor: isAbnormal ? 'help' : 'default'
              }}
            >
              {capture.toFixed(0)}%
              {isAbnormal && <span style={{ marginLeft: 2, fontSize: 10 }}>⚠</span>}
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
        if (r.isMergedGroup) return null;
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) {
          return (
            <Tooltip title="录入 MAE 后自动计算">
              <span style={{ fontSize: 9, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>需MAE</span>
            </Tooltip>
          );
        }
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
        if (r.isMergedGroup) return null;
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        
        // 如果都没有数据，显示提示
        if ((mae === undefined || mae === null) && (mfe === undefined || mfe === null)) {
          return (
            <Tooltip title="录入 MAE/MFE 后自动诊断">
              <span style={{ fontSize: 9, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>需数据</span>
            </Tooltip>
          );
        }
        
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
        if (r.isMergedGroup) return null;
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        
        // 如果都没有数据，显示提示
        if ((mae === undefined || mae === null) && (mfe === undefined || mfe === null)) {
          return (
            <Tooltip title="录入 MAE/MFE 后显示波动区间">
              <div style={{ 
                height: 16, 
                background: 'var(--bg-tertiary)', 
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: 9, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>需数据</span>
              </div>
            </Tooltip>
          );
        }
        
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
        if (r.isMergedGroup) return null;
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        
        // 如果都没有数据，显示提示
        if ((mae === undefined || mae === null) && (mfe === undefined || mfe === null)) {
          return (
            <Tooltip title="录入 MAE/MFE 后自动评级">
              <span style={{ fontSize: 9, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>—</span>
            </Tooltip>
          );
        }
        
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
      width: isMobile ? 60 : 80,
      fixed: isMobile ? false : 'right',
      render: (_, r) => (
        <Space size={2}>
          <Button 
            type="text" 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(r)}
            style={{ color: 'var(--text-tertiary)', padding: isMobile ? '2px 4px' : '4px 8px' }}
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
              style={{ color: 'var(--text-tertiary)', padding: isMobile ? '2px 4px' : '4px 8px' }}
              className="hover:!text-[var(--color-loss)]"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 页面内容
  const pageContent = (
    <div 
      className={isFullscreen ? '' : 'max-w-[1600px] mx-auto'}
      style={isFullscreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: 'calc(var(--vh, 1vh) * 100)',
        minHeight: '100vh',
        zIndex: 99999,
        backgroundColor: '#0f0f10',
        padding: 24,
        overflow: 'auto',
        boxSizing: 'border-box',
      } : {}}
    >
      <div className="space-y-4 md:space-y-6">
      {/* 页面头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            交易明细
            {isFullscreen && <span style={{ fontSize: 12, marginLeft: 8, color: 'var(--text-tertiary)', fontWeight: 400 }}>全屏模式 · ESC 退出</span>}
          </h1>
          <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            查看和管理所有交易记录
          </p>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          {/* 合并显示开关 */}
          <Tooltip title={mergeEnabled ? '点击关闭合并显示' : '点击开启自动合并加减仓交易'}>
            <Button 
              size="small"
              className="md:size-default"
              icon={mergeEnabled ? <MergeCellsOutlined /> : <SplitCellsOutlined />}
              onClick={() => setMergeEnabled(!mergeEnabled)}
              style={{ 
                background: mergeEnabled ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
                borderColor: mergeEnabled ? 'var(--color-brand)' : 'var(--border-primary)',
                color: mergeEnabled ? 'var(--color-brand)' : 'var(--text-secondary)',
              }}
            >
              <span className="hidden sm:inline">{mergeEnabled ? '合并中' : '未合并'}</span>
            </Button>
          </Tooltip>
          <Button 
            size="small"
            className="md:size-default"
            icon={<FilterOutlined />}
            onClick={() => setShowFilters(!showFilters)}
            style={{ 
              background: hasActiveFilters ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
              borderColor: hasActiveFilters ? 'var(--color-brand)' : 'var(--border-primary)',
              color: hasActiveFilters ? 'var(--color-brand)' : 'var(--text-secondary)',
            }}
          >
            <span className="hidden sm:inline">筛选</span> {hasActiveFilters && `(${filteredTrades.length})`}
          </Button>
          <Button 
            size="small"
            className="md:size-default"
            icon={<ReloadOutlined />} 
            onClick={loadData}
            style={{ 
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          />
          <Button 
            size="small"
            className="md:size-default"
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
          >
            <span className="hidden sm:inline">导出</span>
          </Button>
          <Tooltip title={isFullscreen ? '退出全屏' : '全屏显示'}>
            <Button 
              size="small"
              className="hidden md:inline-flex"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{ 
                background: isFullscreen ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
                borderColor: isFullscreen ? 'var(--color-brand)' : 'var(--border-primary)',
                color: isFullscreen ? 'var(--color-brand)' : 'var(--text-secondary)',
              }}
            />
          </Tooltip>
          <Button 
            size="small"
            className="md:size-default"
            icon={<SettingOutlined />} 
            onClick={() => setShowTableSettings(true)}
            style={{ 
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="hidden sm:inline">设置</span>
          </Button>
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div 
          className="p-3 md:p-4 rounded-lg"
          style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)' 
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 md:gap-3 items-center">
            <Select
              value={filters.instrument}
              onChange={v => setFilters({ ...filters, instrument: v })}
              className="w-full md:w-[120px]"
              placeholder="品种"
              options={[
                { value: 'ALL', label: '全部品种' },
                ...instruments.map(i => ({ value: i.code, label: i.code }))
              ]}
            />
            <Select
              value={filters.direction}
              onChange={v => setFilters({ ...filters, direction: v })}
              className="w-full md:w-[100px]"
              options={[
                { value: 'ALL', label: '全部方向' },
                { value: 'LONG', label: '多头' },
                { value: 'SHORT', label: '空头' },
              ]}
            />
            <Select
              value={filters.result}
              onChange={v => setFilters({ ...filters, result: v })}
              className="w-full md:w-[100px]"
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
                className="w-full md:w-[110px]"
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
                className="w-full md:w-[100px]"
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
            <RangePicker
              value={filters.dateRange}
              onChange={v => setFilters({ ...filters, dateRange: v })}
              placeholder={['开始', '结束']}
              className="col-span-2 md:col-span-1 w-full md:w-[240px]"
            />
            <Input
              placeholder="搜索..."
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              className="col-span-2 md:col-span-1 w-full md:w-[180px]"
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
        className="p-3 md:p-5 rounded-lg"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
        }}
      >
        {/* 核心指标 - 响应式布局 */}
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4 md:gap-8">
          {/* 净盈亏 - 最突出 */}
          <div className="flex-shrink-0">
            <div className="text-[10px] tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>净盈亏</div>
            <div 
              className="text-2xl md:text-3xl font-mono font-bold"
              style={{ color: stats.netPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
            >
              {stats.netPnL >= 0 ? '+' : ''}{(stats.netPnL ?? 0).toFixed(2)}
            </div>
          </div>

          {/* 其他指标 - 响应式网格 */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:flex md:items-baseline gap-3 md:gap-6 lg:gap-8 overflow-x-auto">
            <div className="min-w-0">
              <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>交易数</div>
              <div className="text-base md:text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {stats.total}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>胜率</div>
              <div className="text-base md:text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(0) : 0}%
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>胜/负</div>
              <div className="text-base md:text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {stats.wins}/{stats.losses}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>盈亏比</div>
              <div className="text-base md:text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {(stats.profitFactor ?? 0).toFixed(2)}
              </div>
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>均盈</div>
              <div className="text-base md:text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                ${(stats.avgWin ?? 0).toFixed(0)}
              </div>
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>均亏</div>
              <div className="text-base md:text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                ${(stats.avgLoss ?? 0).toFixed(0)}
              </div>
            </div>
            <div className="min-w-0 hidden md:block">
              <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>手续费</div>
              <div className="text-base md:text-xl font-mono font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                ${(stats.totalFee ?? 0).toFixed(0)}
              </div>
            </div>
            {hasJigsawData && jigsawStats && (
              <>
                <div className="min-w-0 hidden lg:block">
                  <Tooltip title="单笔最大实际亏损（平仓后的亏损金额）">
                    <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--color-loss)' }}>最大亏损</div>
                  </Tooltip>
                  <div className="text-xl font-mono font-semibold" style={{ color: 'var(--color-loss)' }}>
                    ${(jigsawStats.maxLoss ?? 0).toFixed(0)}
                  </div>
                </div>
                <div className="min-w-0 hidden lg:block">
                  <Tooltip title="单笔最大浮亏（持仓期间承受的最大不利偏移）">
                    <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>最大浮亏</div>
                  </Tooltip>
                  <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    ${(jigsawStats.maxMAE ?? 0).toFixed(0)}
                  </div>
                </div>
                <div className="min-w-0 hidden xl:block">
                  <Tooltip title="平均每笔交易承受的最大浮亏">
                    <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>均浮亏</div>
                  </Tooltip>
                  <div className="text-xl font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    ${(jigsawStats.avgMAE ?? 0).toFixed(0)}
                  </div>
                </div>
                <div className="min-w-0 hidden xl:block">
                  <Tooltip title="平均每笔交易达到的最大浮盈">
                    <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>均浮盈</div>
                  </Tooltip>
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
            className="mt-3 p-3 md:p-4 rounded-lg"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
          >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  高级分析
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:flex md:items-baseline gap-3 md:gap-6 lg:gap-8 overflow-x-auto">
                <div className="min-w-0">
                  <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>风险回报</div>
                  <div className="text-sm md:text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {(jigsawStats.avgRMultiple ?? 0).toFixed(2)}R
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>捕获率</div>
                  <div className="text-sm md:text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {(jigsawStats.avgProfitCapture ?? 0).toFixed(0)}%
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>压力指数</div>
                  <div className="text-sm md:text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {(jigsawStats.avgStressScore ?? 0).toFixed(1)}/5
                  </div>
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div className="text-[9px] md:text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--color-profit)' }}>完美</div>
                  <div className="text-sm md:text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.perfect}
                  </div>
                </div>
                <div className="min-w-0 hidden md:block">
                  <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>扛赢</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.roller}
                  </div>
                </div>
                <div className="min-w-0 hidden md:block">
                  <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--color-loss)' }}>方向错</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.badEntry}
                  </div>
                </div>
                <div className="min-w-0 hidden lg:block">
                  <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--color-loss)' }}>浮盈亏</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.greed}
                  </div>
                </div>
                <div className="min-w-0 hidden lg:block">
                  <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: 'var(--color-loss)' }}>扛亏</div>
                  <div className="text-lg font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {jigsawStats.diagnosisCounts.badExit}
                  </div>
                </div>
                <div className="min-w-0 hidden xl:block md:ml-auto md:pl-6 md:border-l md:border-[var(--border-primary)]">
                  <div className="text-[10px] tracking-wider mb-1 truncate" style={{ color: stats.grossProfit > 0 && (stats.totalFee / stats.grossProfit * 100) > 15 ? 'var(--color-loss)' : 'var(--text-tertiary)' }}>
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

      {/* MAE/MFE 数据缺失引导提示 - 放在高级分析下方 */}
      {(() => {
        // 计算缺少 MAE/MFE 数据的交易数量（排除合并组）
        const tradesWithoutMaeMfe = filteredTrades.filter(t => 
          !t.isMergedGroup && 
          (t.mae === null || t.mae === undefined || t.mae === 0) && 
          (t.mfe === null || t.mfe === undefined || t.mfe === 0)
        );
        const missingCount = tradesWithoutMaeMfe.length;
        const totalSingleTrades = filteredTrades.filter(t => !t.isMergedGroup).length;
        const missingPercent = totalSingleTrades > 0 ? Math.round((missingCount / totalSingleTrades) * 100) : 0;
        const completedPercent = 100 - missingPercent;
        
        // 只有当有缺失数据且 Jigsaw 数据可用时才显示提示
        if (missingCount === 0 || !hasJigsawData) return null;
        
        // 金句库 - 根据完成度选择不同类型的金句
        const wisdomQuotes = {
          // 刚开始（完成度 < 30%）- 强调价值和意义
          beginner: [
            "逐笔复盘 MAE/MFE，是从散户蜕变为职业交易员的必经之路",
            "了解每笔交易的最大波动，是建立交易纪律的第一步",
            "专业交易员不只看结果，更关注过程中的风险暴露",
          ],
          // 进行中（完成度 30-70%）- 强调坚持和方法
          intermediate: [
            "记录 MAE 帮你认识真实风险，记录 MFE 帮你优化止盈",
            "数据不会骗人，复盘让你看见自己的交易盲区",
            "每一个数字背后，都是一次成长的机会",
          ],
          // 快完成（完成度 > 70%）- 鼓励和肯定
          advanced: [
            "坚持到这里，你已经超越了 90% 的交易者",
            "最好的交易日记，是用数据写成的",
            "再坚持一下，完整的数据会给你惊喜",
          ]
        };
        
        // 根据完成度选择金句类型
        let quotePool;
        if (completedPercent < 30) {
          quotePool = wisdomQuotes.beginner;
        } else if (completedPercent < 70) {
          quotePool = wisdomQuotes.intermediate;
        } else {
          quotePool = wisdomQuotes.advanced;
        }
        
        // 基于日期生成稳定的随机索引（每天显示同一条）
        const today = new Date().toDateString();
        const quoteIndex = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % quotePool.length;
        const selectedQuote = quotePool[quoteIndex];
        
        return (
          <div style={{
            marginTop: 12,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {/* 主内容区 */}
            <div style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* 进度指示 */}
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: `conic-gradient(var(--color-brand) ${completedPercent}%, var(--bg-tertiary) 0%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-primary)'
                  }}>
                    {completedPercent}%
                  </div>
                </div>
                
                  <div>
                    {(() => {
                      // 段位系统定义 - 与首页保持一致
                      const levels = [
                        { min: 0, max: 30, name: '交易新手', next: '数据记录者', icon: '🌱', color: '#94a3b8' },
                        { min: 30, max: 50, name: '数据记录者', next: '复盘学徒', icon: '📊', color: '#60a5fa' },
                        { min: 50, max: 70, name: '复盘学徒', next: '交易分析师', icon: '📈', color: '#818cf8' },
                        { min: 70, max: 90, name: '交易分析师', next: '数据大师', icon: '🎯', color: '#a855f7' },
                        { min: 90, max: 100, name: '数据大师', next: null, icon: '👑', color: '#f59e0b' },
                      ];
                      
                      const currentLevel = levels.find(l => completedPercent >= l.min && (l.next === null || completedPercent < l.max)) || levels[0];
                      
                      return (
                        <>
                          <div style={{ 
                            fontSize: 13, 
                            fontWeight: 600, 
                            color: currentLevel.color,
                            marginBottom: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <span>{currentLevel.icon}</span>
                            <span>{currentLevel.name}</span>
                          </div>
                          <div style={{ 
                            fontSize: 11, 
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5
                          }}>
                            {currentLevel.next ? (
                              <>
                                职业交易员 <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{traderName || '访客'}</span>，你还需补全 <span style={{ fontWeight: 700, color: 'var(--color-brand)' }}>{missingCount}</span> 笔 MAE/MFE 数据，
                                即可晋升为「<span style={{ fontWeight: 600, color: currentLevel.color }}>{currentLevel.next}</span>」
                              </>
                            ) : (
                              <span style={{ color: 'var(--color-profit)', fontWeight: 600 }}>
                                🎉 卓越！交易员 {traderName}，你已补全所有数据，正以「{currentLevel.name}」的姿态俯瞰市场
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tooltip title="在表格的 MAE/MFE 列中，直接点击空白单元格即可录入数据">
                  <Button
                    type="text"
                    size="small"
                    style={{ 
                      fontSize: 11, 
                      color: 'var(--text-tertiary)',
                      padding: '2px 8px',
                      height: 'auto'
                    }}
                  >
                    如何录入？
                  </Button>
                </Tooltip>
              </div>
            </div>
            
            {/* 金句区 - 底部引导语 */}
            <div style={{
              padding: '10px 20px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <span style={{ fontSize: 12, opacity: 0.5 }}>💡</span>
              <span style={{ 
                fontSize: 11, 
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                letterSpacing: '0.2px'
              }}>
                "{selectedQuote}"
              </span>
            </div>
          </div>
        );
      })()}

      {/* 数据表格 */}
      <div 
        ref={tableWrapperRef}
        className="rounded-lg overflow-hidden table-drag-scroll"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
          cursor: 'grab',
          marginTop: 12
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
          rowClassName={(record) => record.isMergedGroup ? 'merged-group-row' : ''}
        />
      </div>
      
      {/* 合并交易详情抽屉 */}
      <Drawer
        title={
          selectedMergeGroup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div 
                className="hidden sm:flex"
                style={{ 
                  width: 40, 
                  height: 40, 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '50%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-primary)'
                }}
              >
                <BarChartOutlined style={{ fontSize: 18, color: 'var(--text-secondary)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  持仓分析
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>
                  {selectedMergeGroup.mergeStats?.tradeCount || 0} TRADES
                </div>
              </div>
            </div>
          )
        }
        placement="right"
        width={isMobile ? '100vw' : 'calc(100vw - 240px)'}
        open={mergeDrawerOpen}
        onClose={closeMergeDrawer}
        styles={{
          header: { 
            background: 'var(--bg-primary)', 
            borderBottom: '1px solid var(--border-primary)',
            padding: isMobile ? '16px' : '20px 32px'
          },
          body: { 
            background: 'var(--bg-primary)', 
            padding: 0,
            overflow: 'auto'
          }
        }}
        destroyOnClose
      >
        {selectedMergeGroup && selectedMergeGroup.mergeStats && (() => {
          const stats = selectedMergeGroup.mergeStats;
          const trades = stats.trades || [];
          const firstTrade = trades[0];
          const overallDirection = firstTrade?.direction === 'LONG' ? 1 : -1;
          const isMobileView = isMobile;
          
          return (
            <div style={{ padding: 0 }}>
              {/* 持仓图表 */}
              <div style={{ padding: isMobileView ? '16px' : '32px' }}>
                <PositionChart 
                  trades={trades} 
                  overallDirection={overallDirection} 
                  dayjs={dayjs}
                  tradeGroupId={selectedMergeGroup?.id || 'default'}
                  onStartReview={handleStartReview}
                  reviewNotes={reviewNotes}
                />
              </div>
              
              {/* 交易明细列表 - 极简风格 */}
              <div style={{ padding: isMobileView ? '0 16px 32px' : '0 32px 48px' }}>
                <div style={{ 
                  fontSize: isMobileView ? 11 : 12, 
                  fontWeight: 700, 
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: isMobileView ? 12 : 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <div style={{ width: 12, height: 1, background: 'var(--border-primary)' }}></div>
                  交易明细
                </div>
                
                {/* 表头 - 移动端使用水平滚动 */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobileView ? '80px 100px 60px 80px 100px' : '100px 120px 80px 100px 120px 100px 1fr',
                  gap: isMobileView ? 8 : 12,
                  padding: isMobileView ? '0 12px 10px' : '0 16px 12px',
                  borderBottom: '1px solid var(--border-primary)',
                  fontSize: isMobileView ? 9 : 10,
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  overflowX: isMobileView ? 'auto' : 'visible',
                  minWidth: isMobileView ? 'max-content' : 'auto'
                }}>
                  <div>操作</div>
                  <div>执行时间</div>
                  <div>方向</div>
                  <div style={{ textAlign: 'right' }}>数量</div>
                  <div style={{ textAlign: 'right' }}>成交价格</div>
                  <div style={{ textAlign: 'right' }}>当前持仓</div>
                  <div style={{ textAlign: 'right' }}>盈亏</div>
                </div>
                
                {/* 数据行 */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(() => {
                    const allEvents = [];
                    trades.forEach((t, tradeIdx) => {
                      const qty = Math.abs(t.openQuantity || 1);
                      allEvents.push({ 
                        time: new Date(t.openTime).getTime(), 
                        type: 'open', 
                        price: t.openPrice, 
                        qty, 
                        trade: t,
                        tradeIdx 
                      });
                      allEvents.push({ 
                        time: new Date(t.closeTime).getTime(), 
                        type: 'close', 
                        price: t.closePrice, 
                        qty, 
                        trade: t,
                        tradeIdx 
                      });
                    });
                    allEvents.sort((a, b) => a.time - b.time);
                    
                    let runningPos = 0;
                    let runningAvgPrice = 0;
                    
                    return allEvents.map((event, eventIdx) => {
                      const prevPos = runningPos;
                      const prevAvgPrice = runningAvgPrice;
                      
                      let label, labelColor;
                      const t = event.trade;
                      const pnl = t.pnl || 0;
                      const isProfit = pnl >= 0;
                      
                      if (event.type === 'open') {
                        if (prevPos === 0) {
                          runningAvgPrice = event.price;
                        } else {
                          runningAvgPrice = (prevPos * runningAvgPrice + event.qty * event.price) / (prevPos + event.qty);
                        }
                        runningPos += event.qty;
                        label = prevPos === 0 ? '首仓' : '加仓';
                        const priceDiff = (event.price - prevAvgPrice) * overallDirection;
                        labelColor = prevPos === 0 ? 'var(--text-primary)' : (priceDiff > 0 ? '#22c55e' : '#ef4444');
                      } else {
                        runningPos -= event.qty;
                        label = runningPos === 0 ? '平仓' : '减仓';
                        const priceDiff = (event.price - prevAvgPrice) * overallDirection;
                        labelColor = priceDiff > 0 ? '#22c55e' : '#ef4444';
                      }
                      
                      return (
                        <div 
                          key={eventIdx} 
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '100px 120px 80px 100px 120px 100px 1fr',
                            gap: 12,
                            padding: '16px',
                            borderBottom: '1px solid var(--border-primary)',
                            alignItems: 'center',
                            fontSize: 12,
                            transition: 'background 0.2s'
                          }}
                          className="minimal-row"
                        >
                          {/* 标签 */}
                          <div>
                            <span 
                              onClick={() => handleStartReview(eventIdx, { label, color: labelColor, time: event.time, price: event.price, qty: event.qty, type: event.type })}
                              style={{
                                padding: '2px 0',
                                color: labelColor,
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: 'pointer',
                                borderBottom: reviewNotes[eventIdx] ? `2px solid ${labelColor}` : 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              {label}
                            </span>
                          </div>
                          
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', fontSize: 11 }}>
                            {dayjs(event.time).format('HH:mm:ss')}
                          </div>
                          
                          <div>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: t.direction === 'LONG' ? '#22c55e' : '#ef4444',
                              opacity: 0.8
                            }}>
                              {t.direction === 'LONG' ? 'BUY' : 'SELL'}
                            </span>
                          </div>
                          
                          <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {event.type === 'open' ? '+' : '-'}{event.qty}
                          </div>
                          
                          <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>
                            {event.price.toFixed(2)}
                          </div>
                          
                          <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-tertiary)', fontSize: 11 }}>
                            {runningPos.toFixed(1)}
                          </div>
                          
                          <div style={{ 
                            textAlign: 'right',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 700,
                            color: event.type === 'close' ? (isProfit ? '#22c55e' : '#ef4444') : 'transparent'
                          }}>
                            {event.type === 'close' ? `${isProfit ? '+' : ''}${pnl.toFixed(2)}` : ''}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                {/* 汇总行 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 120px 80px 100px 120px 100px 1fr',
                  gap: 12,
                  padding: '20px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase' }}>Summary</div>
                  <div></div>
                  <div></div>
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                    {trades.reduce((sum, t) => sum + Math.abs(t.openQuantity || 1), 0)}
                  </div>
                  <div></div>
                  <div></div>
                  <div style={{ 
                    textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 14,
                    color: stats.totalPnl >= 0 ? '#22c55e' : '#ef4444'
                  }}>
                    {stats.totalPnl >= 0 ? '+' : ''}{(stats.totalPnl || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              
              {/* 复盘笔记汇总 - 极简卡片 */}
              {Object.keys(reviewNotes).length > 0 && (() => {
                // 重新计算所有事件的 label 和 color，以便在点击时能正确打开复盘弹窗
                const allEvents = [];
                trades.forEach((t, tradeIdx) => {
                  const qty = Math.abs(t.openQuantity || 1);
                  allEvents.push({ time: new Date(t.openTime).getTime(), type: 'open', price: t.openPrice, qty, trade: t, tradeIdx });
                  allEvents.push({ time: new Date(t.closeTime).getTime(), type: 'close', price: t.closePrice, qty, trade: t, tradeIdx });
                });
                allEvents.sort((a, b) => a.time - b.time);
                
                // 计算每个事件的标签信息
                let runningPos = 0;
                let runningAvgPrice = 0;
                const eventLabels = allEvents.map((event) => {
                  const prevPos = runningPos;
                  const prevAvgPrice = runningAvgPrice;
                  let label, color;
                  
                  if (event.type === 'open') {
                    if (prevPos === 0) {
                      runningAvgPrice = event.price;
                    } else {
                      runningAvgPrice = (prevPos * runningAvgPrice + event.qty * event.price) / (prevPos + event.qty);
                    }
                    runningPos += event.qty;
                    label = prevPos === 0 ? '首仓' : '加仓';
                    const priceDiff = (event.price - prevAvgPrice) * overallDirection;
                    color = prevPos === 0 ? 'var(--text-primary)' : (priceDiff > 0 ? '#22c55e' : '#ef4444');
                  } else {
                    runningPos -= event.qty;
                    label = runningPos === 0 ? '平仓' : '减仓';
                    const priceDiff = (event.price - prevAvgPrice) * overallDirection;
                    color = priceDiff > 0 ? '#22c55e' : '#ef4444';
                  }
                  
                  return { label, color, time: event.time, price: event.price, qty: event.qty, type: event.type };
                });
                
                return (
                  <div style={{ padding: '0 32px 64px' }}>
                    <div style={{
                      borderTop: '1px solid var(--border-primary)',
                      paddingTop: 32
                    }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <div style={{ width: 12, height: 1, background: 'var(--border-primary)' }}></div>
                        复盘笔记
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                        {Object.entries(reviewNotes).map(([nodeIdx, note]) => {
                          const hasContent = Object.values(note).some(v => v && v.trim());
                          if (!hasContent) return null;
                          
                          const eventIdx = parseInt(nodeIdx);
                          const eventInfo = eventLabels[eventIdx] || { label: '复盘', color: 'var(--text-primary)' };
                          
                          return (
                            <div 
                              key={nodeIdx}
                              onClick={() => handleStartReview(eventIdx, eventInfo)}
                              style={{
                                padding: '20px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                border: '1px solid var(--border-primary)',
                                transition: 'all 0.2s'
                              }}
                              className="note-card"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <span style={{ 
                                  fontSize: 11, 
                                  fontWeight: 700, 
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: `${eventInfo.color}15`,
                                  color: eventInfo.color
                                }}>
                                  {eventInfo.label}
                                </span>
                                <EditOutlined style={{ fontSize: 12, color: 'var(--text-tertiary)' }} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {Object.entries(note).filter(([, v]) => v && v.trim()).map(([key, value]) => (
                                  <div key={key}>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                                      {REVIEW_TEMPLATES[eventInfo.label]?.questions?.find(q => q.key === key)?.label || 
                                       REVIEW_TEMPLATES['首仓']?.questions?.find(q => q.key === key)?.label || 
                                       REVIEW_TEMPLATES['加仓']?.questions?.find(q => q.key === key)?.label || 
                                       REVIEW_TEMPLATES['减仓']?.questions?.find(q => q.key === key)?.label || 
                                       REVIEW_TEMPLATES['平仓']?.questions?.find(q => q.key === key)?.label || key}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                      {value}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </Drawer>
      
      {/* 复盘编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {reviewingEvent && (
              <span style={{
                padding: '4px 12px',
                borderRadius: 6,
                background: `${reviewingEvent.point?.color || 'var(--color-brand)'}20`,
                color: reviewingEvent.point?.color || 'var(--color-brand)',
                fontWeight: 700,
                fontSize: 12
              }}>
                {reviewingEvent.point?.label || '复盘'}
              </span>
            )}
            <span>{REVIEW_TEMPLATES[reviewingEvent?.point?.label]?.title || '交易复盘'}</span>
          </div>
        }
        open={reviewModalVisible}
        onCancel={handleCancelReview}
        onOk={handleSaveReview}
        okText="保存复盘"
        cancelText="取消"
        width={520}
        styles={{
          header: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' },
          body: { background: 'var(--bg-primary)', padding: 24 },
          footer: { background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)' },
        }}
      >
        {reviewingEvent && (
          <>
            <div style={{ 
              marginBottom: 16, 
              padding: 12, 
              background: 'var(--bg-secondary)', 
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'var(--text-tertiary)'
            }}>
              {reviewingEvent.point?.time && dayjs(reviewingEvent.point.time).format('YYYY-MM-DD HH:mm:ss')}
              {reviewingEvent.point?.qty && ` | ${reviewingEvent.point.qty}手`}
              {reviewingEvent.point?.price && ` @ ${reviewingEvent.point.price.toFixed(2)}`}
            </div>
            
            {(REVIEW_TEMPLATES[reviewingEvent.point?.label]?.questions || []).map((q) => (
              <div key={q.key} style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 6
                }}>
                  {q.label}
                </label>
                <Input.TextArea
                  value={editingReview[q.key] || ''}
                  onChange={(e) => setEditingReview(prev => ({ ...prev, [q.key]: e.target.value }))}
                  placeholder={q.placeholder}
                  rows={2}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 6,
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            ))}
          </>
        )}
      </Modal>
      
      {/* 表格设置抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ color: 'var(--color-brand)' }} />
            <span>表格设置</span>
          </div>
        }
        placement="right"
        width={isMobile ? '100vw' : 320}
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

      {/* 交易复盘抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div 
              className="hidden sm:flex"
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                background: 'var(--bg-tertiary)', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid var(--border-primary)'
              }}
            >
              <EditOutlined style={{ color: 'var(--text-secondary)', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                交易复盘
              </div>
              {editingTrade && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {editingTrade.instrumentCode} · {dayjs(editingTrade.openTime).format('MM-DD HH:mm')}
                </div>
              )}
            </div>
          </div>
        }
        placement="right"
        width={isMobile ? '100vw' : 520}
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        styles={{
          header: { 
            background: 'var(--bg-primary)', 
            borderBottom: '1px solid var(--border-primary)',
            padding: isMobile ? '16px' : '20px 24px'
          },
          body: { 
            background: 'var(--bg-primary)', 
            padding: isMobile ? '16px' : '24px',
            overflow: 'auto'
          },
          footer: {
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-primary)',
            padding: isMobile ? '12px 16px' : '16px 24px'
          }
        }}
        footer={
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0 }}>
            <Button 
              icon={<PlusOutlined />}
              onClick={handleOpenSaveStrategy}
              style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }}
              block={isMobile}
            >
              保存为策略
            </Button>
            <div style={{ display: 'flex', gap: 12 }}>
            <Button 
              onClick={() => setEditModalVisible(false)}
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', flex: isMobile ? 1 : 'none' }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              onClick={handleEditSave}
              style={{ background: 'var(--color-brand)', borderColor: 'var(--color-brand)', flex: isMobile ? 1 : 'none' }}
            >
              保存复盘
            </Button>
            </div>
          </div>
        }
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
                      <Tooltip title={profitCapture !== null && profitCapture > 100 
                        ? "⚠️ 超过100%可能因分批建仓导致统计不准确" 
                        : "利润捕获率: 实际盈利 / 最大浮盈，越高越好"
                      }>
                        <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          利润捕获 <InfoCircleOutlined />
                        </div>
                      </Tooltip>
                      <div 
                        className="text-xl font-bold font-mono flex items-center gap-1"
                        style={{ color: profitCapture !== null 
                          ? (profitCapture > 100 ? '#f59e0b' : profitCapture >= 70 ? 'var(--color-profit)' : profitCapture < 30 ? 'var(--color-loss)' : 'var(--color-brand)') 
                          : 'var(--text-tertiary)' 
                        }}
                      >
                        {profitCapture !== null ? `${profitCapture.toFixed(0)}%` : '-'}
                        {profitCapture !== null && profitCapture > 100 && (
                          <span style={{ fontSize: 12 }}>⚠</span>
                        )}
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
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>交易策略</span>}
          >
            <Select 
              mode="multiple" 
              placeholder="选择使用的策略..." 
              options={strategies.map(s => ({ value: s.id, label: s.name }))} 
            />
          </Form.Item>
          
          <div style={{ 
            fontSize: 12, 
            fontWeight: 600, 
            color: 'var(--text-tertiary)', 
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 16,
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <div style={{ width: 12, height: 1, background: 'var(--border-primary)' }}></div>
            复盘记录
          </div>
          
          <Form.Item 
            name="entryReason" 
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>入场理由</span>}
          >
            <TextArea 
              rows={2} 
              placeholder="为什么在这个点位入场？看到了什么信号？" 
              style={{ resize: 'none' }}
            />
          </Form.Item>
          <Form.Item 
            name="stopLossReason" 
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>止损理由</span>}
          >
            <TextArea 
              rows={2} 
              placeholder="止损位设置的依据是什么？" 
              style={{ resize: 'none' }}
            />
          </Form.Item>
          <Form.Item 
            name="takeProfitReason" 
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>止盈理由</span>}
          >
            <TextArea 
              rows={2} 
              placeholder="止盈目标是如何确定的？" 
              style={{ resize: 'none' }}
            />
          </Form.Item>
          <Form.Item 
            name="notes" 
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>其他备注</span>}
          >
            <TextArea 
              rows={2} 
              placeholder="心态、失误、可改进之处..." 
              style={{ resize: 'none' }}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 保存为策略对话框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BulbOutlined style={{ color: 'var(--color-brand)' }} />
            <span>将复盘内容保存为策略</span>
          </div>
        }
        open={saveStrategyModalVisible}
        onCancel={() => setSaveStrategyModalVisible(false)}
        onOk={handleSaveAsStrategy}
        okText="创建策略"
        cancelText="取消"
        width={480}
        styles={{
          header: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-primary)' },
          body: { background: 'var(--bg-primary)', padding: '24px' },
          footer: { background: 'var(--bg-primary)', borderTop: '1px solid var(--border-primary)' },
        }}
      >
        <Form form={strategyForm} layout="vertical">
          <Form.Item 
            name="name" 
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>策略名称</span>}
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如：突破回踩做多、假突破反转..." />
          </Form.Item>
          
          <Form.Item 
            name="category" 
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>策略分类</span>}
          >
            <Select
              options={[
                { value: '趋势', label: '趋势策略' },
                { value: '突破', label: '突破策略' },
                { value: '反转', label: '反转策略' },
                { value: '区间', label: '区间策略' },
                { value: '剥头皮', label: '剥头皮策略' },
                { value: '套利', label: '套利策略' },
                { value: '实验', label: '实验策略' },
                { value: '通用', label: '通用策略' },
              ]}
            />
          </Form.Item>
          
          <Form.Item 
            name="color" 
            label={<span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>标签颜色</span>}
          >
            <Select
              options={[
                { value: '#eab308', label: <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#eab308', marginRight: 8 }}></span>金色</span> },
                { value: '#10b981', label: <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#10b981', marginRight: 8 }}></span>绿色</span> },
                { value: '#3b82f6', label: <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#3b82f6', marginRight: 8 }}></span>蓝色</span> },
                { value: '#f43f5e', label: <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#f43f5e', marginRight: 8 }}></span>红色</span> },
                { value: '#8B5CF6', label: <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#8B5CF6', marginRight: 8 }}></span>紫色</span> },
                { value: '#06B6D4', label: <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#06B6D4', marginRight: 8 }}></span>青色</span> },
                { value: '#F97316', label: <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#F97316', marginRight: 8 }}></span>橙色</span> },
              ]}
            />
          </Form.Item>
          
          {/* 预览 */}
          <div 
            style={{ 
              background: 'var(--bg-tertiary)', 
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              padding: 16,
              marginTop: 8
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              策略描述预览
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {(() => {
                const vals = form.getFieldsValue();
                const parts = [];
                if (vals.entryReason) parts.push(`【入场】${vals.entryReason}`);
                if (vals.stopLossReason) parts.push(`【止损】${vals.stopLossReason}`);
                if (vals.takeProfitReason) parts.push(`【止盈】${vals.takeProfitReason}`);
                if (vals.notes) parts.push(`【备注】${vals.notes}`);
                return parts.join('\n') || '（请先填写复盘内容）';
              })()}
            </div>
          </div>
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
        
        /* MAE/MFE 内联编辑输入框 */
        .mae-mfe-input {
          background: var(--bg-tertiary) !important;
          border-color: var(--color-brand) !important;
        }
        .mae-mfe-input .ant-input-number-input {
          color: var(--text-primary) !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 12px !important;
        }
        .mae-mfe-input .ant-input-number-prefix {
          color: var(--text-tertiary) !important;
        }
        
        /* 合并组行样式 */
        .merged-group-row > td {
          background: rgba(234, 179, 8, 0.03) !important;
        }
        .merged-group-row:hover > td {
          background: rgba(234, 179, 8, 0.08) !important;
        }
        
        /* 展开行样式 */
        .binance-table .ant-table-expanded-row > td {
          background: var(--bg-tertiary) !important;
          padding: 0 !important;
        }

        /* 专业金融风格持仓曲线图样式 */
        .professional-chart-container {
          padding: 24px;
          background: var(--bg-primary);
        }

        .pro-stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-primary);
        }

        .pro-stat-group {
          display: flex;
          gap: 32px;
        }

        .pro-stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pro-label {
          font-size: 10px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .pro-value {
          font-size: 18px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-primary);
        }

        .pro-value.profit { color: #22c55e; }
        .pro-value.loss { color: #ef4444; }
        .pro-value.long { color: #22c55e; }
        .pro-value.short { color: #ef4444; }

        .pro-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pro-scale-badge {
          font-size: 10px;
          padding: 2px 6px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          color: var(--text-tertiary);
          font-family: monospace;
        }

        .pro-reset-btn {
          padding: 4px 10px;
          font-size: 10px;
          background: transparent;
          border: 1px solid var(--border-primary);
          border-radius: 4px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .pro-reset-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .pro-svg-wrapper {
          background: #0d1117; /* 深色背景更显专业 */
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          overflow: hidden;
        }

        .pro-svg {
          display: block;
        }

        /* 兼容旧样式 */
        .minimal-chart-container {
          padding: 32px;
          background: var(--bg-primary);
        }

        .chart-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        /* 现代专业持仓图表样式 */
        .modern-chart-container {
          padding: 24px;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .modern-chart-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-primary);
        }

        .header-info .direction-tag {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
        }

        .stats-group {
          display: flex;
          gap: 32px;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat .label {
          font-size: 10px;
          color: var(--text-tertiary);
          letter-spacing: 1px;
          margin-bottom: 4px;
        }

        .stat .value {
          font-size: 24px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }

        .header-controls {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
        }

        .legend {
          display: flex;
          gap: 16px;
        }

        .legend .item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .legend .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .legend .line {
          width: 16px;
        }

        .reset-btn {
          padding: 4px 12px;
          font-size: 10px;
          font-weight: 700;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          color: var(--text-secondary);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-btn:hover {
          background: var(--text-primary);
          color: var(--bg-primary);
        }

        .modern-svg-wrapper {
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border-primary);
          overflow: hidden;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }

        .modern-svg {
          display: block;
        }

        /* 复盘节点悬停效果 */
        .review-label-btn {
          transition: transform 0.2s;
        }
        .review-label-btn:hover {
          transform: scale(1.1);
        }

        @keyframes pulse-soft {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0.7; transform: scale(1); }
        }

        /* 复盘标签按钮 */
        .review-label-btn:hover rect {
          fill: rgba(255,255,255,0.1) !important;
          stroke: currentColor !important;
        }

        /* 复盘弹窗覆盖层 */
        .review-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
        }

        .review-modal {
          background: var(--bg-primary);
          border: 1px solid var(--border-primary);
          border-radius: 12px;
          width: 480px;
          max-width: 90vw;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .review-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-primary);
          background: var(--bg-secondary);
        }

        .review-modal-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .review-label-badge {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
        }

        .review-modal-meta {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-tertiary);
          font-family: 'JetBrains Mono', monospace;
        }

        .review-modal-body {
          padding: 20px 24px;
          max-height: 400px;
          overflow-y: auto;
        }

        .review-question {
          margin-bottom: 16px;
        }

        .review-question label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }

        .review-question textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-primary);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 13px;
          resize: vertical;
          transition: border-color 0.2s;
        }

        .review-question textarea:focus {
          outline: none;
          border-color: var(--color-brand);
        }

        .review-question textarea::placeholder {
          color: var(--text-tertiary);
        }

        .review-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border-primary);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: var(--bg-secondary);
        }

        .review-btn-cancel, .review-btn-save {
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .review-btn-cancel {
          background: transparent;
          border: 1px solid var(--border-primary);
          color: var(--text-secondary);
        }

        .review-btn-cancel:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .review-btn-save {
          background: var(--color-brand);
          border: none;
          color: #0a0a0c;
        }

        .review-btn-save:hover {
          filter: brightness(1.1);
        }

        /* 复盘笔记汇总 */
        .review-summary {
          margin-top: 20px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
        }

        .review-summary-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
        }

        .review-summary-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .review-summary-item {
          padding: 12px;
          background: var(--bg-primary);
          border: 1px solid var(--border-primary);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .review-summary-item:hover {
          border-color: var(--color-brand);
        }

        .review-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .review-item-label {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
        }

        .review-item-time {
          font-size: 10px;
          color: var(--text-tertiary);
          font-family: 'JetBrains Mono', monospace;
        }

        .review-item-content {
          font-size: 11px;
        }

        .review-item-note {
          margin-bottom: 4px;
          line-height: 1.4;
        }

        .review-item-note .note-label {
          color: var(--text-tertiary);
          margin-right: 4px;
        }

        .review-item-note .note-value {
          color: var(--text-secondary);
        }

        /* 兼容旧样式 */
        .professional-chart-container {
          padding: 16px 20px;
          background: var(--bg-secondary);
        }

        .chart-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .direction-badge {
          font-size: 13px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 8px;
        }

        .chart-legend {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .legend-item .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .legend-item .line-sample {
          width: 16px;
          height: 0;
          border-top: 2px dashed;
        }

        .chart-controls {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .scale-label {
          font-size: 10px;
          color: var(--text-tertiary);
          font-family: 'JetBrains Mono', monospace;
        }

        .scale-handle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: 6px;
          cursor: ns-resize;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .scale-handle:hover {
          background: var(--color-brand);
          color: var(--bg-primary);
          border-color: var(--color-brand);
        }

        .scale-btn {
          padding: 4px 10px;
          font-size: 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: 4px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .scale-btn:hover {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .chart-scroll-container {
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 100%);
        }

        .position-chart-svg {
          display: block;
          margin-bottom: 16px;
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 100%);
        }

        /* 底部交易明细 */
        .trade-summary-row {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 4px 0;
        }

        .summary-item {
          flex: 0 0 auto;
          min-width: 160px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          padding: 12px;
          border: 1px solid var(--border-primary);
          transition: all 0.2s;
        }

        .summary-item:hover {
          border-color: var(--color-brand);
        }

        .summary-item.float-profit {
          border-left: 3px solid var(--color-profit);
        }

        .summary-item.float-loss {
          border-left: 3px solid #f59e0b;
        }

        .summary-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .summary-num {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-brand);
          background: rgba(234, 179, 8, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .summary-label {
          font-size: 11px;
          font-weight: 700;
        }

        .float-amount {
          font-size: 10px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }

        .close-float-amount {
          font-size: 10px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          margin-left: 4px;
        }

        .summary-body {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-family: 'JetBrains Mono', monospace;
        }

        .summary-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .summary-qty {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .summary-price {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .summary-avg {
          font-size: 10px;
          color: var(--text-tertiary);
          padding: 2px 6px;
          background: var(--bg-primary);
          border-radius: 4px;
        }

        .summary-close {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          padding-top: 6px;
          border-top: 1px dashed var(--border-primary);
        }

        .close-price {
          color: var(--text-tertiary);
        }

        .summary-pnl {
          font-size: 15px;
          font-weight: 700;
          margin-top: 4px;
        }
      `}</style>
      </div>
    </div>
  );

  // 全屏模式使用 Portal 渲染到 body，确保铺满整个屏幕
  if (isFullscreen) {
    return createPortal(pageContent, document.body);
  }

  return pageContent;
};

export default TradeList;
