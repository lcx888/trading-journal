import { useState, useEffect } from 'react';
import { 
  Table, Tag, Space, Select, DatePicker, Input, Button, 
  Modal, Form, message, Popconfirm, Tooltip, Dropdown
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
    
    return {
      avgMAE: tradesWithMAE.length > 0 ? (totalMAEUSD / tradesWithMAE.length) : 0,
      avgMFE: tradesWithMFE.length > 0 ? (totalMFEUSD / tradesWithMFE.length) : 0,
      totalFills: filteredTrades.reduce((sum, t) => sum + (t.fills ?? t.jigsawData?.fills ?? 0), 0),
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
        className="grid gap-4 p-4 rounded-lg"
        style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-primary)',
          gridTemplateColumns: hasJigsawData ? 'repeat(7, 1fr)' : 'repeat(4, 1fr)',
        }}
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
          scroll={{ x: hasJigsawData ? 1400 : 1100 }}
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
        width={520}
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
        {editingTrade && (
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
        )}

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
