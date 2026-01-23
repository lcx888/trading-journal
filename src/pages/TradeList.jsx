import { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Space, Select, DatePicker, Input, Button, 
  Modal, Form, message, Popconfirm, Tooltip, Badge, Dropdown
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  RiseOutlined,
  TrophyOutlined,
  TagOutlined,
  PlusOutlined,
  CloseOutlined,
  GlobalOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import StorageService from '../services/storage';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

// TradingView Colors
const COLORS = {
  profit: '#26a69a',
  loss: '#ef5350',
  primary: '#2962ff',
  text: '#131722',
  textLight: '#787b86',
  border: '#e0e3eb',
  grid: '#f0f3fa'
};

const formatHoldingTime = (seconds) => {
  if (!seconds || seconds === 0) return '0秒';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);
  return parts.join(' ');
};

// 品种 tick 价值映射（美元/tick）
const TICK_VALUES = {
  'GC': 10,      // 黄金: $10/tick
  'ES': 12.5,   // 标普: $12.5/tick
  'NQ': 5,      // 纳指: $5/tick
  'RTY': 5,     // 罗素: $5/tick
  'CL': 10,     // 原油: $10/tick
  'SI': 25,     // 白银: $25/tick
  'YM': 5,      // 道指: $5/tick
  'ZB': 31.25,  // 国债: $31.25/tick
  'ZN': 15.625, // 10年国债: $15.625/tick
  '6E': 12.5,   // 欧元: $12.5/tick
  'M2K': 0.5,   // 微型罗素: $0.5/tick
  'MES': 1.25,  // 微型标普: $1.25/tick
  'MNQ': 0.5,   // 微型纳指: $0.5/tick
  'MGC': 1,     // 微型黄金: $1/tick
};

// 获取品种的 tick 价值
const getTickValue = (instrumentCode, instruments) => {
  // 先尝试从 instruments 列表中获取（用户自定义）
  const instrument = instruments.find(i => i.code === instrumentCode);
  if (instrument?.tickValue) return instrument.tickValue;
  // 否则使用默认值
  return TICK_VALUES[instrumentCode] || 5; // 默认 $5/tick
};

// 将 ticks 转换为美元金额
const ticksToUSD = (ticks, instrumentCode, quantity, instruments) => {
  if (ticks === undefined || ticks === null) return null;
  const tickValue = getTickValue(instrumentCode, instruments);
  return ticks * tickValue * Math.abs(quantity || 1);
};

const TradeList = ({ activeRecordId = 'all' }) => {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [filteredTrades, setFilteredTrades] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [hasJigsawData, setHasJigsawData] = useState(false); // 是否有 Jigsaw 数据
  const [filters, setFilters] = useState({
    instrument: 'ALL',
    direction: 'ALL',
    result: 'ALL',
    session: 'ALL',
    strategy: 'ALL',
    dateRange: null,
    keyword: '',
    source: 'ALL', // 新增：数据来源筛选
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [activeRecordId]);

  useEffect(() => {
    applyFilters();
  }, [trades, filters]);

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
      
      // 检查是否有 Jigsaw 数据
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
    // 数据来源筛选
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
      
      // 如果有 Jigsaw 数据，添加额外字段（换算为美元）
      if (hasJigsawData) {
        const mae = t.mae ?? t.jigsawData?.mae;
        const mfe = t.mfe ?? t.jigsawData?.mfe;
        const maeUSD = mae !== undefined ? ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments) : '';
        const mfeUSD = mfe !== undefined ? ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments) : '';
        
        baseData['MAE(ticks)'] = mae ?? '';
        baseData['MAE(美元)'] = maeUSD ? -maeUSD.toFixed(2) : '';
        baseData['MFE(ticks)'] = mfe ?? '';
        baseData['MFE(美元)'] = mfeUSD ? mfeUSD.toFixed(2) : '';
        baseData['成交次数'] = t.fills ?? t.jigsawData?.fills ?? '';
      }
      
      return baseData;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '交易记录');
    XLSX.writeFile(wb, `交易明细_${dayjs().format('MMDD_HHmm')}.xlsx`);
  };

  const columns = [
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">时间</span>,
      dataIndex: 'openTime',
      key: 'openTime',
      width: 140,
      render: (t) => <div className="text-[11px] font-medium text-slate-500">{dayjs(t).format('MM/DD HH:mm:ss')}</div>,
      sorter: (a, b) => new Date(a.openTime) - new Date(b.openTime),
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">品种</span>,
      dataIndex: 'instrumentCode',
      key: 'instrumentCode',
      width: 90,
      render: (c) => <Tag className="rounded bg-slate-100 border-none font-bold text-slate-700">{c}</Tag>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">方向</span>,
      dataIndex: 'direction',
      key: 'direction',
      width: 80,
      render: (d) => (
        <div className={`flex items-center gap-1 font-bold text-[11px] ${d === 'LONG' ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
          {d === 'LONG' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {d === 'LONG' ? '多' : '空'}
        </div>
      ),
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">数量</span>,
      key: 'quantity',
      width: 80,
      align: 'right',
      render: (_, r) => <div className="text-[11px] font-mono font-bold text-slate-600">{Math.abs(r.openQuantity || 0)}</div>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">开/平仓价</span>,
      key: 'prices',
      width: 160,
      align: 'right',
      render: (_, r) => (
        <div className="flex flex-col items-end">
          <div className="text-[11px] font-mono font-bold text-slate-700">{r.openPrice?.toFixed(2)}</div>
          <div className="text-[10px] font-mono text-slate-400">{r.closePrice?.toFixed(2)}</div>
        </div>
      ),
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">盈亏（美元）</span>,
      dataIndex: 'pnl',
      key: 'pnl',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.pnl - b.pnl,
      render: (p) => (
        <div className={`text-[13px] font-mono font-bold ${p >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
          {p >= 0 ? '+' : ''}{p?.toFixed(2)}
        </div>
      ),
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">时段</span>,
      dataIndex: 'marketSession',
      key: 'marketSession',
      width: 110,
      render: (s) => {
        const isImportant = s === '美盘开盘' || s === '欧美重叠';
        return <Tag className={`rounded-full border-none px-2 py-0 text-[10px] font-bold ${isImportant ? 'bg-purple-50 text-purple-500' : 'bg-slate-50 text-slate-400'}`}>{isImportant ? '★ ' : ''}{s}</Tag>;
      },
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">持仓时长</span>,
      dataIndex: 'holdingSeconds',
      key: 'duration',
      width: 100,
      align: 'right',
      render: (s) => <div className="text-[10px] font-bold text-slate-400">{formatHoldingTime(s)}</div>,
    },
    // Jigsaw 独有列：MAE（美元）
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="Maximum Adverse Excursion - 最大不利偏移（已换算为美元）">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 cursor-help">MAE$</span>
        </Tooltip>
      ),
      key: 'mae',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const mae = r.mae ?? r.jigsawData?.mae;
        if (mae === undefined || mae === null) return <span className="text-slate-300">-</span>;
        const maeUSD = ticksToUSD(mae, r.instrumentCode, r.openQuantity, instruments);
        return (
          <Tooltip title={`${mae} ticks`}>
            <span className="text-[11px] font-mono font-bold text-[#ef5350]">-${maeUSD?.toFixed(0)}</span>
          </Tooltip>
        );
      },
    }] : []),
    // Jigsaw 独有列：MFE（美元）
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="Maximum Favorable Excursion - 最大有利偏移（已换算为美元）">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 cursor-help">MFE$</span>
        </Tooltip>
      ),
      key: 'mfe',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const mfe = r.mfe ?? r.jigsawData?.mfe;
        if (mfe === undefined || mfe === null) return <span className="text-slate-300">-</span>;
        const mfeUSD = ticksToUSD(mfe, r.instrumentCode, r.openQuantity, instruments);
        return (
          <Tooltip title={`${mfe} ticks`}>
            <span className="text-[11px] font-mono font-bold text-[#26a69a]">+${mfeUSD?.toFixed(0)}</span>
          </Tooltip>
        );
      },
    }] : []),
    // Jigsaw 独有列：成交次数
    ...(hasJigsawData ? [{
      title: (
        <Tooltip title="成交次数 (Fills)">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 cursor-help">成交</span>
        </Tooltip>
      ),
      key: 'fills',
      width: 60,
      align: 'right',
      render: (_, r) => {
        const fills = r.fills ?? r.jigsawData?.fills;
        if (fills === undefined || fills === null) return <span className="text-slate-300">-</span>;
        return <span className="text-[11px] font-mono font-bold text-slate-600">{fills}</span>;
      },
    }] : []),
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">策略</span>,
      key: 'strategyTags',
      render: (_, r) => {
        const tradeStrategies = (r.strategyIds || []).map(id => getStrategyById(id)).filter(Boolean);
        const available = strategies.filter(s => !r.strategyIds?.includes(s.id));
        return (
          <div className="flex flex-wrap items-center gap-1">
            {tradeStrategies.map(s => (
              <Tag key={s.id} color={s.color} closable onClose={() => handleRemoveStrategy(r.id, s.id)} className="rounded-full border-none px-2 py-0 text-[10px] font-bold">
                {s.name}
              </Tag>
            ))}
            {available.length > 0 && (
              <Dropdown menu={{ items: available.map(s => ({ key: s.id, label: s.name, onClick: () => handleAddStrategy(r.id, s.id) })) }} trigger={['click']}>
                <PlusOutlined className="text-slate-300 hover:text-blue-500 cursor-pointer text-xs" />
              </Dropdown>
            )}
          </div>
        );
      },
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">操作</span>,
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, r) => (
        <Space size="middle">
          <EditOutlined className="text-slate-300 hover:text-blue-500 cursor-pointer text-xs" onClick={() => handleEdit(r)} />
          <Popconfirm title="删除？" onConfirm={() => handleDelete(r.id)}>
            <DeleteOutlined className="text-slate-300 hover:text-red-500 cursor-pointer text-xs" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const currentStats = {
    total: filteredTrades.length,
    pnl: filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    wins: filteredTrades.filter(t => t.pnl > 0).length,
  };
  
  // Jigsaw 统计（换算为美元）
  const jigsawStats = hasJigsawData ? (() => {
    const tradesWithMAE = filteredTrades.filter(t => (t.mae ?? t.jigsawData?.mae) !== undefined);
    const tradesWithMFE = filteredTrades.filter(t => (t.mfe ?? t.jigsawData?.mfe) !== undefined);
    
    // 计算总 MAE 金额
    const totalMAEUSD = tradesWithMAE.reduce((sum, t) => {
      const mae = t.mae ?? t.jigsawData?.mae ?? 0;
      return sum + ticksToUSD(mae, t.instrumentCode, t.openQuantity, instruments);
    }, 0);
    
    // 计算总 MFE 金额
    const totalMFEUSD = tradesWithMFE.reduce((sum, t) => {
      const mfe = t.mfe ?? t.jigsawData?.mfe ?? 0;
      return sum + ticksToUSD(mfe, t.instrumentCode, t.openQuantity, instruments);
    }, 0);
    
    return {
      avgMAE: tradesWithMAE.length > 0 ? (totalMAEUSD / tradesWithMAE.length).toFixed(0) : 0,
      avgMFE: tradesWithMFE.length > 0 ? (totalMFEUSD / tradesWithMFE.length).toFixed(0) : 0,
      totalFills: filteredTrades.reduce((sum, t) => sum + (t.fills ?? t.jigsawData?.fills ?? 0), 0),
    };
  })() : null;

  return (
    <div className="space-y-6 animate-in">
      {/* TradingView Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between p-3 bg-white rounded-xl border border-[#e0e3eb]">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filters.instrument} onChange={v => setFilters({ ...filters, instrument: v })} style={{ width: 110 }} variant="borderless" className="bg-[#f0f3fa] rounded-lg font-bold text-xs"
                  options={[{ value: 'ALL', label: '全部品种' }, ...instruments.map(i => ({ value: i.code, label: i.code }))]} />
          <Select value={filters.direction} onChange={v => setFilters({ ...filters, direction: v })} style={{ width: 90 }} variant="borderless" className="bg-[#f0f3fa] rounded-lg font-bold text-xs"
                  options={[{ value: 'ALL', label: '方向' }, { value: 'LONG', label: '多' }, { value: 'SHORT', label: '空' }]} />
          <Select value={filters.result} onChange={v => setFilters({ ...filters, result: v })} style={{ width: 100 }} variant="borderless" className="bg-[#f0f3fa] rounded-lg font-bold text-xs"
                  options={[{ value: 'ALL', label: '结果' }, { value: 'WIN', label: '盈利' }, { value: 'LOSS', label: '亏损' }]} />
          {hasJigsawData && (
            <Select value={filters.source} onChange={v => setFilters({ ...filters, source: v })} style={{ width: 100 }} variant="borderless" className="bg-purple-50 rounded-lg font-bold text-xs text-purple-600"
                    options={[{ value: 'ALL', label: '全部来源' }, { value: 'atas', label: 'ATAS' }, { value: 'jigsaw', label: 'Jigsaw' }]} />
          )}
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <RangePicker value={filters.dateRange} onChange={v => setFilters({ ...filters, dateRange: v })} variant="borderless" className="bg-[#f0f3fa] rounded-lg text-xs" placeholder={['开始日期', '结束日期']} />
          <div className="flex items-center bg-[#f0f3fa] rounded-lg px-3 py-1 gap-2">
            <SearchOutlined className="text-slate-400 text-xs" />
            <Input placeholder="搜索记录..." value={filters.keyword} onChange={e => setFilters({ ...filters, keyword: e.target.value })} variant="borderless" className="w-32 p-0 text-xs font-medium" allowClear />
          </div>
        </div>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={loadData} className="border-none bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100" />
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport} className="font-bold text-xs rounded-lg px-4 shadow-none">导出</Button>
        </div>
      </div>

      {/* Mini Stats Row */}
      <div className="flex gap-10 px-6 py-4 bg-white rounded-xl border border-[#e0e3eb]">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">交易笔数</div>
          <div className="text-xl font-bold text-[#131722]">{currentStats.total} <span className="text-[10px] opacity-40">笔</span></div>
        </div>
        <div className="w-px h-8 bg-slate-100 mt-2" />
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">净盈亏</div>
          <div className={`text-xl font-bold ${currentStats.pnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
            {currentStats.pnl >= 0 ? '+' : ''}{currentStats.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] opacity-60">美元</span>
          </div>
        </div>
        <div className="w-px h-8 bg-slate-100 mt-2" />
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">胜率</div>
          <div className="text-xl font-bold text-[#131722]">{currentStats.total > 0 ? (currentStats.wins / currentStats.total * 100).toFixed(1) : 0}%</div>
        </div>
        {/* Jigsaw 独有统计（美元金额） */}
        {hasJigsawData && jigsawStats && (
          <>
            <div className="w-px h-8 bg-purple-100 mt-2" />
            <Tooltip title="Maximum Adverse Excursion - 平均最大不利偏移（已换算为美元）">
              <div>
                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">平均 MAE</div>
                <div className="text-xl font-bold text-[#ef5350]">-${jigsawStats.avgMAE} <span className="text-[10px] opacity-60">美元</span></div>
              </div>
            </Tooltip>
            <div className="w-px h-8 bg-purple-100 mt-2" />
            <Tooltip title="Maximum Favorable Excursion - 平均最大有利偏移（已换算为美元）">
              <div>
                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">平均 MFE</div>
                <div className="text-xl font-bold text-[#26a69a]">+${jigsawStats.avgMFE} <span className="text-[10px] opacity-60">美元</span></div>
              </div>
            </Tooltip>
            <div className="w-px h-8 bg-purple-100 mt-2" />
            <Tooltip title="总成交次数">
              <div>
                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">总成交</div>
                <div className="text-xl font-bold text-purple-600">{jigsawStats.totalFills} <span className="text-[10px] opacity-60">次</span></div>
              </div>
            </Tooltip>
          </>
        )}
      </div>

      {/* Main Table Card */}
      <div className="modern-card bg-white p-2">
        <Table
          columns={columns}
          dataSource={filteredTrades}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            defaultPageSize: 20,
            showTotal: (total) => <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">数据量：{total} 笔</span>,
          }}
          scroll={{ x: 1200 }}
          size="small"
          className="modern-table history-table"
        />
      </div>

      <Modal
        title={<div className="flex items-center gap-2"><EditOutlined className="text-blue-500" /><span className="font-bold">交易复盘</span></div>}
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="更新记录"
        cancelText="取消"
        width={500}
        className="trading-view-modal"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="strategyIds" label={<span className="text-[10px] font-bold uppercase text-slate-400">交易策略/模型</span>}>
            <Select mode="multiple" placeholder="选择策略..." options={strategies.map(s => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="logicAnalysis" label={<span className="text-[10px] font-bold uppercase text-slate-400">技术背景/逻辑</span>}>
            <TextArea rows={3} placeholder="描述市场背景..." />
          </Form.Item>
          <Form.Item name="notes" label={<span className="text-[10px] font-bold uppercase text-slate-400">心理备注/观察</span>}>
            <TextArea rows={2} placeholder="心态、失误、错误等..." />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .history-table .ant-table-thead > tr > th {
          background: #f8f9fd !important;
          padding: 12px 16px !important;
        }
        .history-table .ant-table-tbody > tr > td {
          padding: 8px 16px !important;
          border-bottom: 1px solid #f0f3fa !important;
        }
        .history-table .ant-table-row:hover > td {
          background: #f8f9fd !important;
        }
      `}</style>
    </div>
  );
};

export default TradeList;
