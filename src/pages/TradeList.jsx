import { useState, useEffect } from 'react';
import { 
  Table, Tag, Space, Select, DatePicker, Input, Button, 
  Modal, Form, message, Popconfirm, Tooltip, Dropdown, Progress
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

// ========== 高级分析指标计算函数 ==========

/**
 * 利润留存率 (Profit Retention Rate)
 * 公式：(MFE - max(0, PnL)) / MFE
 * 意义：反映止盈保护机制，值越高说明越容易"见证过暴利但最后平在亏损"
 */
const calcProfitRetentionRate = (mfeUSD, pnl) => {
  if (!mfeUSD || mfeUSD <= 0) return null;
  const retainedProfit = mfeUSD - Math.max(0, pnl);
  return (retainedProfit / mfeUSD) * 100;
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
 * 心理压力系数 (Psychological Stress Score)
 * 逻辑：根据 MAE 占 PnL 的比例以及持仓时长，计算交易者在持仓期间承受的心理压力等级
 * 评分标准：1-5级，5级最高压力
 */
const calcPsychologicalStressScore = (maeUSD, pnl, holdingSeconds) => {
  if (!maeUSD) return null;
  const absMAE = Math.abs(maeUSD);
  const absPnL = Math.abs(pnl) || 1;
  
  // MAE占PnL的比例
  const maeRatio = absMAE / absPnL;
  
  // 持仓时间因子（超过10分钟开始累加压力）
  const timeFactor = holdingSeconds > 600 ? Math.min((holdingSeconds - 600) / 1800, 1) : 0;
  
  // 基础压力分（根据MAE比例）
  let baseScore = 1;
  if (maeRatio > 3) baseScore = 5;
  else if (maeRatio > 2) baseScore = 4;
  else if (maeRatio > 1.5) baseScore = 3;
  else if (maeRatio > 1) baseScore = 2;
  
  // 时间加成
  const finalScore = Math.min(5, baseScore + timeFactor);
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
 * R倍数 (R-Multiple)
 * 逻辑：假设初始风险为 |MAE|，计算 PnL / |MAE|
 */
const calcRMultiple = (pnl, maeUSD) => {
  if (!maeUSD || maeUSD === 0) return null;
  return pnl / Math.abs(maeUSD);
};

/**
 * 自动归因诊断
 * 返回诊断标签数组
 */
const getAutoDiagnosis = (trade, maeUSD, mfeUSD) => {
  const diagnoses = [];
  const { pnl, fills, openQuantity } = trade;
  const quantity = Math.abs(openQuantity || 1);
  
  // 1. 贪婪导致的获利回吐
  if (pnl < 0 && mfeUSD && mfeUSD > Math.abs(pnl)) {
    diagnoses.push({
      type: 'greed',
      label: '获利回吐',
      color: '#f59e0b',
      description: '曾经有盈利但最终亏损离场，可能是贪婪导致'
    });
  }
  
  // 2. 割肉位置不佳
  if (maeUSD && pnl < 0 && Math.abs(maeUSD) > Math.abs(pnl) * 1.5) {
    diagnoses.push({
      type: 'badExit',
      label: '止损极点',
      color: '#ef4444',
      description: '扛单后止损在接近最低点，割肉位置不佳'
    });
  }
  
  // 3. 执行过程犹豫
  if (fills && quantity && fills > quantity * 2) {
    diagnoses.push({
      type: 'hesitation',
      label: '过度操作',
      color: '#8b5cf6',
      description: '成交次数远超仓位数量，存在频繁加减仓'
    });
  }
  
  // 4. 完美离场
  if (pnl > 0 && mfeUSD && pnl >= mfeUSD * 0.8) {
    diagnoses.push({
      type: 'perfect',
      label: '完美止盈',
      color: '#10b981',
      description: '在接近最高点离场，执行优秀'
    });
  }
  
  // 5. 承压过重
  if (maeUSD && pnl > 0 && Math.abs(maeUSD) > pnl * 2) {
    diagnoses.push({
      type: 'pressure',
      label: '承压过重',
      color: '#f97316',
      description: '盈利前经历了过大的浮亏，心理压力大'
    });
  }
  
  return diagnoses;
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
    <Tooltip title={`心理压力等级: ${score.toFixed(1)}/5`}>
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
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [form] = Form.useForm();

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
        const rMultiple = calcRMultiple(t.pnl, maeUSD);
        const profitRetention = calcProfitRetentionRate(mfeUSD, t.pnl);
        const riskExposure = calcRiskExposureIndex(maeUSD, mfeUSD, t.pnl);
        const stressScore = calcPsychologicalStressScore(maeUSD, t.pnl, t.holdingSeconds);
        const execComplexity = calcExecutionComplexity(fills, t.openQuantity);
        const diagnoses = getAutoDiagnosis(t, maeUSD, mfeUSD);
        
        baseData['R倍数'] = rMultiple !== null ? rMultiple.toFixed(2) : '';
        baseData['利润留存率(%)'] = profitRetention !== null ? profitRetention.toFixed(1) : '';
        baseData['风险占用比'] = riskExposure !== null ? riskExposure.toFixed(2) : '';
        baseData['心理压力(1-5)'] = stressScore !== null ? stressScore.toFixed(1) : '';
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
    filters.dateRange !== null ||
    filters.keyword !== '';

  // 统计计算
  const stats = {
    total: filteredTrades.length,
    pnl: filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    wins: filteredTrades.filter(t => t.pnl > 0).length,
    losses: filteredTrades.filter(t => t.pnl < 0).length,
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
    let totalProfitRetention = 0;
    let profitRetentionCount = 0;
    let totalStressScore = 0;
    let stressScoreCount = 0;
    let diagnosisCounts = { greed: 0, badExit: 0, hesitation: 0, perfect: 0, pressure: 0 };
    
    filteredTrades.forEach(t => {
      const mae = t.mae ?? t.jigsawData?.mae;
      const mfe = t.mfe ?? t.jigsawData?.mfe;
      const maeUSD = mae !== undefined ? ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) : null;
      const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments) : null;
      
      // R倍数统计
      const rMultiple = calcRMultiple(t.pnl, maeUSD);
      if (rMultiple !== null) {
        totalRMultiple += rMultiple;
        rMultipleCount++;
      }
      
      // 利润留存率统计
      const profitRetention = calcProfitRetentionRate(mfeUSD, t.pnl);
      if (profitRetention !== null) {
        totalProfitRetention += profitRetention;
        profitRetentionCount++;
      }
      
      // 心理压力统计
      const stressScore = calcPsychologicalStressScore(maeUSD, t.pnl, t.holdingSeconds);
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
      avgProfitRetention: profitRetentionCount > 0 ? totalProfitRetention / profitRetentionCount : 0,
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
      width: 150,
      render: (t) => (
        <div>
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
      width: 100,
      render: (c) => (
        <span 
          className="font-mono font-semibold text-sm px-2 py-1 rounded"
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
      width: 80,
      render: (d) => (
        <div 
          className="flex items-center gap-1 font-semibold text-sm"
          style={{ color: d === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)' }}
        >
          {d === 'LONG' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {d === 'LONG' ? '多' : '空'}
        </div>
      ),
    },
    {
      title: '数量',
      key: 'quantity',
      width: 70,
      align: 'right',
      render: (_, r) => (
        <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
          {Math.abs(r.openQuantity || 0)}
        </span>
      ),
    },
    {
      title: '价格',
      key: 'prices',
      width: 140,
      align: 'right',
      render: (_, r) => (
        <div className="font-mono">
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
      width: 120,
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
      title: '时段',
      dataIndex: 'marketSession',
      key: 'marketSession',
      width: 100,
      render: (s) => {
        const isImportant = s === '美盘开盘' || s === '欧美重叠';
        return (
          <span 
            className="text-xs px-2 py-0.5 rounded"
            style={{ 
              background: isImportant ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
              color: isImportant ? 'var(--color-brand)' : 'var(--text-secondary)',
            }}
          >
            {s}
          </span>
        );
      },
    },
    {
      title: '时长',
      dataIndex: 'holdingSeconds',
      key: 'duration',
      width: 80,
      align: 'right',
      render: (s) => (
        <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
          {formatHoldingTime(s)}
        </span>
      ),
    },
    // Jigsaw 专属列
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="Maximum Adverse Excursion - 最大不利偏移">
          <span style={{ color: 'var(--text-secondary)' }}>MAE</span>
        </Tooltip>
      ),
      key: 'mae',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        return (
          <Tooltip title={`${mae} ticks`}>
            <span className="font-mono font-semibold" style={{ color: 'var(--color-loss)' }}>
              -${maeUSD?.toFixed(0)}
            </span>
          </Tooltip>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="Maximum Favorable Excursion - 最大有利偏移">
          <span style={{ color: 'var(--text-secondary)' }}>MFE</span>
        </Tooltip>
      ),
      key: 'mfe',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        if (mfe === undefined || mfe === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const mfeUSD = ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments);
        return (
          <Tooltip title={`${mfe} ticks`}>
            <span className="font-mono font-semibold" style={{ color: 'var(--color-profit)' }}>
              +${mfeUSD?.toFixed(0)}
            </span>
          </Tooltip>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="成交次数">
          <span style={{ color: 'var(--text-secondary)' }}>Fills</span>
        </Tooltip>
      ),
      key: 'fills',
      width: 60,
      align: 'right',
      render: (_, r) => {
        const fills = r.fills ?? r.jigsawData?.fills;
        if (fills === undefined || fills === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        return <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{fills}</span>;
      },
    }] : []),
    // ========== 高级分析指标列 ==========
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="R-Multiple: PnL / |MAE|，衡量风险回报">
          <span style={{ color: 'var(--text-secondary)' }}>R倍数</span>
        </Tooltip>
      ),
      key: 'rMultiple',
      width: 70,
      align: 'right',
      sorter: (a, b) => {
        const maeA = ticksToUSD(a.mae ?? a.jigsawData?.mae, a.instrumentCode, a.openQuantity, instruments);
        const maeB = ticksToUSD(b.mae ?? b.jigsawData?.mae, b.instrumentCode, b.openQuantity, instruments);
        const rA = calcRMultiple(a.pnl, maeA) || 0;
        const rB = calcRMultiple(b.pnl, maeB) || 0;
        return rA - rB;
      },
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        const rMultiple = calcRMultiple(r.pnl, maeUSD);
        if (rMultiple === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        return (
          <Tooltip title={`风险回报倍数: ${rMultiple.toFixed(2)}R`}>
            <span 
              className="font-mono font-semibold"
              style={{ color: rMultiple >= 1 ? 'var(--color-profit)' : rMultiple >= 0 ? 'var(--color-brand)' : 'var(--color-loss)' }}
            >
              {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(1)}R
            </span>
          </Tooltip>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="利润留存率: (MFE - max(0,PnL)) / MFE，值越高说明越容易获利回吐">
          <span style={{ color: 'var(--text-secondary)' }}>留存率</span>
        </Tooltip>
      ),
      key: 'profitRetention',
      width: 80,
      align: 'right',
      sorter: (a, b) => {
        const mfeA = ticksToUSD(a.mfe ?? a.jigsawData?.mfe, a.instrumentCode, a.openQuantity, instruments);
        const mfeB = ticksToUSD(b.mfe ?? b.jigsawData?.mfe, b.instrumentCode, b.openQuantity, instruments);
        const prA = calcProfitRetentionRate(mfeA, a.pnl) || 0;
        const prB = calcProfitRetentionRate(mfeB, b.pnl) || 0;
        return prA - prB;
      },
      render: (_, r) => {
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        if (mfe === undefined || mfe === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const mfeUSD = ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments);
        const retention = calcProfitRetentionRate(mfeUSD, r.pnl);
        if (retention === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        // 低留存率=好（保住了利润），高留存率=差（利润回吐）
        const isGood = retention < 30;
        const isBad = retention > 70;
        return (
          <Tooltip title={`利润留存率: ${retention.toFixed(1)}%${isBad ? ' - 严重回吐' : isGood ? ' - 止盈优秀' : ''}`}>
            <span 
              className="font-mono font-semibold"
              style={{ color: isGood ? 'var(--color-profit)' : isBad ? 'var(--color-loss)' : 'var(--color-brand)' }}
            >
              {retention.toFixed(0)}%
            </span>
          </Tooltip>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="心理压力系数: 根据MAE占比和持仓时长计算">
          <span style={{ color: 'var(--text-secondary)' }}>压力</span>
        </Tooltip>
      ),
      key: 'stressScore',
      width: 90,
      align: 'center',
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        const score = calcPsychologicalStressScore(maeUSD, r.pnl, r.holdingSeconds);
        return <StressIndicator score={score} />;
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="自动归因诊断 - 基于交易数据自动识别问题">
          <span style={{ color: 'var(--text-secondary)' }}>诊断</span>
        </Tooltip>
      ),
      key: 'diagnosis',
      width: 140,
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments) : null;
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments) : null;
        
        const diagnoses = getAutoDiagnosis(r, maeUSD, mfeUSD);
        if (diagnoses.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
        
        return (
          <div className="flex flex-wrap gap-1">
            {diagnoses.slice(0, 2).map((d, i) => (
              <Tooltip key={i} title={d.description}>
                <Tag 
                  className="text-xs border-0 rounded m-0"
                  style={{ background: d.color + '20', color: d.color }}
                >
                  {d.label}
                </Tag>
              </Tooltip>
            ))}
            {diagnoses.length > 2 && (
              <Tooltip title={diagnoses.slice(2).map(d => d.label).join(', ')}>
                <Tag className="text-xs border-0 rounded m-0" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                  +{diagnoses.length - 2}
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    }] : []),
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="交易波动区间可视化 - 左侧MAE，右侧MFE，标记离场点">
          <span style={{ color: 'var(--text-secondary)' }}>波动区间</span>
        </Tooltip>
      ),
      key: 'tradeRange',
      width: 140,
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments) : null;
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments) : null;
        
        return <TradeRangeBar mae={mae} mfe={mfe} pnl={r.pnl} maeUSD={maeUSD} mfeUSD={mfeUSD} />;
      },
    }] : []),
    {
      title: '策略标签',
      key: 'strategyTags',
      width: 180,
      render: (_, r) => {
        const tradeStrategies = (r.strategyIds || []).map(id => getStrategyById(id)).filter(Boolean);
        const available = strategies.filter(s => !r.strategyIds?.includes(s.id));
        return (
          <div className="flex flex-wrap items-center gap-1">
            {tradeStrategies.map(s => (
              <Tag 
                key={s.id} 
                color={s.color} 
                closable 
                onClose={() => handleRemoveStrategy(r.id, s.id)} 
                className="rounded text-xs border-0 m-0"
              >
                {s.name}
              </Tag>
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
                <Button 
                  type="text" 
                  size="small" 
                  icon={<PlusOutlined />} 
                  style={{ color: 'var(--text-tertiary)', padding: '0 4px' }}
                />
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

      {/* 统计概览 */}
      <div 
        className="p-4 rounded-lg space-y-4"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
        }}
      >
        {/* 基础统计行 */}
        <div 
          className="grid gap-4"
          style={{ gridTemplateColumns: hasJigsawData ? 'repeat(7, 1fr)' : 'repeat(4, 1fr)' }}
      >
        {/* 交易笔数 */}
        <div className="text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>交易笔数</div>
          <div className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
            {stats.total}
          </div>
        </div>

        {/* 净盈亏 */}
        <div className="text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>净盈亏</div>
          <div 
            className="text-2xl font-mono font-bold"
            style={{ color: stats.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
          >
            {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(2)}
          </div>
        </div>

        {/* 胜率 */}
        <div className="text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>胜率</div>
          <div className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
            {stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) : 0}%
          </div>
        </div>

        {/* 盈亏比 */}
        <div className="text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>盈/亏</div>
          <div className="text-xl font-mono font-bold">
            <span style={{ color: 'var(--color-profit)' }}>{stats.wins}</span>
            <span style={{ color: 'var(--text-tertiary)' }}> / </span>
            <span style={{ color: 'var(--color-loss)' }}>{stats.losses}</span>
          </div>
        </div>

        {/* Jigsaw 专属统计 */}
        {hasJigsawData && jigsawStats && (
          <>
            <div className="text-center">
              <Tooltip title="Maximum Adverse Excursion - 平均最大不利偏移">
                <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  平均 MAE <InfoCircleOutlined className="ml-1" />
                </div>
              </Tooltip>
              <div className="text-2xl font-mono font-bold" style={{ color: 'var(--color-loss)' }}>
                -${jigsawStats.avgMAE.toFixed(0)}
              </div>
            </div>

            <div className="text-center">
              <Tooltip title="Maximum Favorable Excursion - 平均最大有利偏移">
                <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  平均 MFE <InfoCircleOutlined className="ml-1" />
                </div>
              </Tooltip>
              <div className="text-2xl font-mono font-bold" style={{ color: 'var(--color-profit)' }}>
                +${jigsawStats.avgMFE.toFixed(0)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>总成交次数</div>
              <div className="text-2xl font-mono font-bold" style={{ color: 'var(--color-brand)' }}>
                {jigsawStats.totalFills}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 高级分析指标行 */}
        {hasJigsawData && jigsawStats && (
          <>
            <div className="border-t pt-4" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-2 mb-3">
                <ThunderboltOutlined style={{ color: 'var(--color-brand)' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  高级分析指标
                </span>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                {/* 平均R倍数 */}
                <div className="text-center">
                  <Tooltip title="R-Multiple: PnL / |MAE|，平均风险回报效率">
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      平均R倍数 <InfoCircleOutlined className="ml-1" />
                    </div>
                  </Tooltip>
                  <div 
                    className="text-xl font-mono font-bold"
                    style={{ 
                      color: jigsawStats.avgRMultiple >= 1 ? 'var(--color-profit)' : 
                             jigsawStats.avgRMultiple >= 0 ? 'var(--color-brand)' : 'var(--color-loss)' 
                    }}
                  >
                    {jigsawStats.avgRMultiple >= 0 ? '+' : ''}{jigsawStats.avgRMultiple.toFixed(2)}R
                  </div>
                </div>

                {/* 平均利润留存率 */}
                <div className="text-center">
                  <Tooltip title="利润留存率: (MFE - max(0,PnL)) / MFE，越低越好">
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      平均留存率 <InfoCircleOutlined className="ml-1" />
                    </div>
                  </Tooltip>
                  <div 
                    className="text-xl font-mono font-bold"
                    style={{ 
                      color: jigsawStats.avgProfitRetention < 30 ? 'var(--color-profit)' : 
                             jigsawStats.avgProfitRetention > 70 ? 'var(--color-loss)' : 'var(--color-brand)' 
                    }}
                  >
                    {jigsawStats.avgProfitRetention.toFixed(0)}%
                  </div>
                </div>

                {/* 平均心理压力 */}
                <div className="text-center">
                  <Tooltip title="心理压力系数: 根据MAE占比和持仓时长计算，1-5级">
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      平均压力 <InfoCircleOutlined className="ml-1" />
                    </div>
                  </Tooltip>
                  <div className="flex justify-center">
                    <StressIndicator score={jigsawStats.avgStressScore} />
                  </div>
                </div>

                {/* 获利回吐次数 */}
                <div className="text-center">
                  <Tooltip title="曾经盈利但最终亏损离场的交易次数">
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      获利回吐 <WarningOutlined className="ml-1" style={{ color: '#f59e0b' }} />
                    </div>
                  </Tooltip>
                  <div className="text-xl font-mono font-bold" style={{ color: '#f59e0b' }}>
                    {jigsawStats.diagnosisCounts.greed}
                  </div>
                </div>

                {/* 止损极点次数 */}
                <div className="text-center">
                  <Tooltip title="割肉位置接近最低点的交易次数">
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      止损极点 <ExclamationCircleOutlined className="ml-1" style={{ color: 'var(--color-loss)' }} />
                    </div>
                  </Tooltip>
                  <div className="text-xl font-mono font-bold" style={{ color: 'var(--color-loss)' }}>
                    {jigsawStats.diagnosisCounts.badExit}
                  </div>
                </div>

                {/* 完美止盈次数 */}
                <div className="text-center">
                  <Tooltip title="在接近最高点离场的优秀交易次数">
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      完美止盈 <SafetyOutlined className="ml-1" style={{ color: 'var(--color-profit)' }} />
                    </div>
                  </Tooltip>
                  <div className="text-xl font-mono font-bold" style={{ color: 'var(--color-profit)' }}>
                    {jigsawStats.diagnosisCounts.perfect}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 数据表格 */}
      <div 
        className="rounded-lg overflow-hidden"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)' 
        }}
      >
        <Table
          columns={columns}
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
          size="middle"
          className="binance-table"
        />
      </div>

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
          
          const rMultiple = calcRMultiple(editingTrade.pnl, maeUSD);
          const profitRetention = calcProfitRetentionRate(mfeUSD, editingTrade.pnl);
          const riskExposure = calcRiskExposureIndex(maeUSD, mfeUSD, editingTrade.pnl);
          const stressScore = calcPsychologicalStressScore(maeUSD, editingTrade.pnl, editingTrade.holdingSeconds);
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
                    
                    {/* 利润留存率 */}
                    <div className="p-3 rounded" style={{ background: 'var(--bg-primary)' }}>
                      <Tooltip title="利润留存率: (MFE - max(0,PnL)) / MFE，值越低越好">
                        <div className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                          利润留存 <InfoCircleOutlined />
                        </div>
                      </Tooltip>
                      <div 
                        className="text-xl font-bold font-mono"
                        style={{ color: profitRetention !== null ? (profitRetention < 30 ? 'var(--color-profit)' : profitRetention > 70 ? 'var(--color-loss)' : 'var(--color-brand)') : 'var(--text-tertiary)' }}
                      >
                        {profitRetention !== null ? `${profitRetention.toFixed(0)}%` : '-'}
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
          font-weight: 500 !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          border-bottom: 1px solid var(--border-primary) !important;
          padding: 12px 16px !important;
        }
        .binance-table .ant-table-tbody > tr > td {
          background: var(--bg-secondary) !important;
          border-bottom: 1px solid var(--border-primary) !important;
          padding: 12px 16px !important;
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
      `}</style>
    </div>
  );
};

export default TradeList;
