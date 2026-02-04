import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Button, Tag, Input, DatePicker, Space, 
  Modal, Spin, Tooltip, Progress, message, Segmented
} from 'antd';
import { 
  ArrowLeftOutlined, SearchOutlined, EditOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, 
  MergeCellsOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import RichEditor from '../components/RichEditor';
import { processTradesWithMerge } from '../services/tradeMerge';

const { RangePicker } = DatePicker;

// 计算净盈亏（扣除手续费）
const getNetPnL = (trade) => {
  if (!trade) return 0;
  const pnl = trade.pnl || 0;
  const openQty = trade.openQuantity || (trade.data && trade.data.openQuantity) || 1;
  const feePerContract = 4.5;
  const roundTrips = Math.ceil(openQty);
  const totalFees = roundTrips * feePerContract * 2;
  return pnl - totalFees;
};

// 统计指标组件
const StatItem = ({ label, value, subValue, valueColor, prefix, suffix }) => (
  <div className="card flex flex-col justify-between h-full hover-lift">
    <div className="stat-label mb-2">{label}</div>
    <div className="flex items-baseline gap-1">
      {prefix && <span className="text-lg text-secondary font-mono">{prefix}</span>}
      <div 
        className="stat-value"
        style={{ color: valueColor || 'var(--text-primary)' }}
      >
        {value}
      </div>
      {suffix && <span className="text-sm text-secondary font-mono ml-1">{suffix}</span>}
    </div>
    {subValue && <div className="mt-2">{subValue}</div>}
  </div>
);

const StrategyReview = ({ onNavigate, strategyId }) => {
  const [strategy, setStrategy] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instruments, setInstruments] = useState([]);
  
  // 筛选状态
  const [filters, setFilters] = useState({
    dateRange: null,
    pnlFilter: 'all', // all, profit, loss
    reviewStatus: 'all', // all, reviewed, pending
    searchText: '',
  });
  
  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  
  // 复盘编辑状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  
  // 批量编辑
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchReviewContent, setBatchReviewContent] = useState('');
  
  // 合并交易显示
  const [mergeEnabled, setMergeEnabled] = useState(true);

  // 加载策略和关联订单
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 加载策略信息
        const strategies = await StorageService.refreshStrategyUsageCounts();
        const targetStrategy = (strategies || []).find(s => s.id === strategyId);
        setStrategy(targetStrategy);
        
        // 加载合约信息
        const instrumentsData = await StorageService.getInstruments();
        setInstruments(instrumentsData || []);
        
        // 加载所有交易
        const allTrades = await StorageService.getAllTrades();
        
        // 筛选使用该策略的订单
        const strategyTrades = allTrades.filter(trade => {
          const ids = trade.strategyIds || (trade.strategyId ? [trade.strategyId] : []);
          return ids.includes(strategyId);
        });
        
        // 按时间降序排序
        strategyTrades.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
        
        // 保存原始交易数据（用于合并计算）
        setTrades(strategyTrades);
        setPagination(prev => ({ ...prev, total: strategyTrades.length }));
      } catch (error) {
        console.error('加载数据失败:', error);
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    if (strategyId) {
      loadData();
    }
  }, [strategyId]);

  // 筛选后的交易
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    // 日期范围筛选
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const [start, end] = filters.dateRange;
      result = result.filter(trade => {
        const tradeDate = dayjs(trade.openTime);
        return tradeDate.isAfter(start.startOf('day')) && tradeDate.isBefore(end.endOf('day'));
      });
    }
    
    // 盈亏筛选
    if (filters.pnlFilter === 'profit') {
      result = result.filter(trade => getNetPnL(trade) > 0);
    } else if (filters.pnlFilter === 'loss') {
      result = result.filter(trade => getNetPnL(trade) < 0);
    }
    
    // 复盘状态筛选
    if (filters.reviewStatus === 'reviewed') {
      result = result.filter(trade => 
        (trade.reviewTitle && trade.reviewTitle.trim()) || (trade.reviewContent && trade.reviewContent !== '<p></p>')
      );
    } else if (filters.reviewStatus === 'pending') {
      result = result.filter(trade => 
        (!trade.reviewTitle || !trade.reviewTitle.trim()) && (!trade.reviewContent || trade.reviewContent === '<p></p>')
      );
    }
    
    // 搜索筛选
    if (filters.searchText) {
      const text = filters.searchText.toLowerCase();
      result = result.filter(trade => 
        (trade.instrument || '').toLowerCase().includes(text) ||
        (trade.reviewTitle || '').toLowerCase().includes(text) ||
        (trade.reviewContent || '').toLowerCase().includes(text)
      );
    }
    
    // 应用合并逻辑
    if (mergeEnabled) {
      result = processTradesWithMerge(result, instruments);
    } else {
      result = result.map(t => ({ ...t, isMergedGroup: false }));
    }
    
    return result;
  }, [trades, filters, mergeEnabled, instruments]);

  // 统计数据
  const stats = useMemo(() => {
    const totalTrades = trades.length;
    const reviewedTrades = trades.filter(t => 
      (t.reviewTitle && t.reviewTitle.trim()) || (t.reviewContent && t.reviewContent !== '<p></p>')
    ).length;
    const totalPnL = trades.reduce((sum, t) => sum + getNetPnL(t), 0);
    const winTrades = trades.filter(t => getNetPnL(t) > 0).length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    
    return {
      totalTrades,
      reviewedTrades,
      reviewProgress: totalTrades > 0 ? (reviewedTrades / totalTrades) * 100 : 0,
      totalPnL,
      winRate,
      avgPnL: totalTrades > 0 ? totalPnL / totalTrades : 0,
    };
  }, [trades]);

  // 打开复盘编辑
  const handleEdit = (trade) => {
    setEditingTrade(trade);
    
    // 如果是合并交易，取第一笔有复盘的子交易内容
    if (trade.isMergedGroup && trade.mergeStats?.trades) {
      const firstReviewedTitle = trade.mergeStats.trades.find(t => t.reviewTitle && t.reviewTitle.trim());
      const firstReviewedContent = trade.mergeStats.trades.find(t => t.reviewContent && t.reviewContent !== '<p></p>');
      setReviewTitle(firstReviewedTitle?.reviewTitle || '');
      setReviewContent(firstReviewedContent?.reviewContent || '');
    } else {
      setReviewTitle(trade.reviewTitle || '');
      setReviewContent(trade.reviewContent || '');
    }
    
    setEditModalVisible(true);
  };

  // 保存复盘
  const handleSave = async () => {
    if (!editingTrade) return;
    setSaving(true);
    try {
      const updateData = { reviewTitle, reviewContent };
      
      // 如果是合并交易组，更新所有子交易
      if (editingTrade.isMergedGroup && editingTrade.mergeStats?.trades) {
        const subTrades = editingTrade.mergeStats.trades;
        for (const subTrade of subTrades) {
          await StorageService.updateTrade(subTrade.id, updateData);
        }
        message.success(`已为 ${subTrades.length} 笔交易保存复盘`);
        // 更新本地状态
        const subTradeIds = subTrades.map(t => t.id);
        setTrades(prev => prev.map(t => 
          subTradeIds.includes(t.id) ? { ...t, reviewTitle, reviewContent } : t
        ));
      } else {
        // 单笔交易
        await StorageService.updateTrade(editingTrade.id, updateData);
        message.success('复盘保存成功');
        setTrades(prev => prev.map(t => 
          t.id === editingTrade.id ? { ...t, reviewTitle, reviewContent } : t
        ));
      }
      
      setEditModalVisible(false);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };


  // 表格列定义
  const columns = [
    {
      title: '时间',
      dataIndex: 'openTime',
      key: 'openTime',
      width: 160,
      fixed: 'left',
      render: (time, record) => {
        if (record.isMergedGroup && record.mergeStats) {
          const stats = record.mergeStats;
          return (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MergeCellsOutlined className="text-brand" />
                <span className="text-xs font-medium text-brand bg-brand-bg px-1 rounded">
                  合并 {stats.tradeCount} 笔
                </span>
              </div>
              <div className="font-mono text-primary font-medium">
                {dayjs(stats.firstOpenTime).format('MM-DD HH:mm')}
              </div>
              <div className="font-mono text-xs text-secondary">
                至 {dayjs(stats.lastCloseTime).format('MM-DD HH:mm')}
              </div>
            </div>
          );
        }
        return (
          <div>
            <div className="font-mono text-primary font-medium">
              {dayjs(time).format('YYYY-MM-DD')}
            </div>
            <div className="font-mono text-xs text-secondary">
              {dayjs(time).format('HH:mm:ss')}
            </div>
          </div>
        );
      },
    },
    {
      title: '品种',
      dataIndex: 'instrument',
      key: 'instrument',
      width: 100,
      render: (instrument, record) => {
        const code = record.isMergedGroup ? record.mergeStats?.instrumentCode : (instrument || record.instrumentCode);
        return (
          <span className="font-mono font-bold bg-tertiary px-2 py-1 rounded text-primary">
            {code}
          </span>
        );
      },
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 80,
      render: (direction, record) => {
        const dir = record.isMergedGroup ? record.mergeStats?.direction : direction;
        const isLong = dir === 'LONG';
        return (
          <Tag 
            className={isLong ? 'tag-profit border-none' : 'tag-loss border-none'}
            icon={isLong ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          >
            {isLong ? '多' : '空'}
          </Tag>
        );
      },
    },
    {
      title: '数量',
      key: 'quantity',
      width: 80,
      align: 'right',
      render: (_, record) => {
        if (record.isMergedGroup && record.mergeStats) {
          return (
            <div className="text-right">
              <div className="font-mono font-bold text-primary">
                {record.mergeStats.totalQuantity}
              </div>
              <div className="font-mono text-xs text-secondary">
                峰值: {record.mergeStats.maxConcurrentQty}
              </div>
            </div>
          );
        }
        return <span className="font-mono font-medium text-primary">{record.openQuantity || 1}</span>;
      },
    },
    {
      title: '盈亏',
      key: 'pnl',
      width: 120,
      align: 'right',
      sorter: (a, b) => {
        const pnlA = a.isMergedGroup ? (a.mergeStats?.totalPnL || 0) : getNetPnL(a);
        const pnlB = b.isMergedGroup ? (b.mergeStats?.totalPnL || 0) : getNetPnL(b);
        return pnlA - pnlB;
      },
      render: (_, record) => {
        if (record.isMergedGroup && record.mergeStats) {
          const stats = record.mergeStats;
          const totalPnL = stats.totalPnL || 0;
          return (
            <div className="text-right">
              <div className={`font-mono font-bold text-base ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
              </div>
              <div className="font-mono text-xs text-secondary">
                均: {stats.avgPnL?.toFixed(2)}
              </div>
            </div>
          );
        }
        const pnl = getNetPnL(record);
        return (
          <span className={`font-mono font-bold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '复盘状态',
      key: 'reviewStatus',
      width: 100,
      filters: [
        { text: '已复盘', value: 'reviewed' },
        { text: '待复盘', value: 'pending' },
      ],
      onFilter: (value, record) => {
        if (record.isMergedGroup && record.mergeStats?.trades) {
          const reviewedCount = record.mergeStats.trades.filter(t => 
            (t.reviewTitle && t.reviewTitle.trim()) || (t.reviewContent && t.reviewContent !== '<p></p>')
          ).length;
          const hasReview = reviewedCount > 0;
          return value === 'reviewed' ? hasReview : !hasReview;
        }
        const hasReview = (record.reviewTitle && record.reviewTitle.trim()) || (record.reviewContent && record.reviewContent !== '<p></p>');
        return value === 'reviewed' ? hasReview : !hasReview;
      },
      render: (_, record) => {
        if (record.isMergedGroup && record.mergeStats?.trades) {
          const subTrades = record.mergeStats.trades;
          const reviewedCount = subTrades.filter(t => 
            (t.reviewTitle && t.reviewTitle.trim()) || (t.reviewContent && t.reviewContent !== '<p></p>')
          ).length;
          if (reviewedCount === subTrades.length) {
            return <Tag color="success" icon={<CheckCircleOutlined />} className="border-none">已复盘</Tag>;
          } else if (reviewedCount > 0) {
            return <Tag color="processing" className="border-none">{reviewedCount}/{subTrades.length}</Tag>;
          }
          return <Tag color="warning" icon={<ClockCircleOutlined />} className="border-none">待复盘</Tag>;
        }
        const hasReview = (record.reviewTitle && record.reviewTitle.trim()) || (record.reviewContent && record.reviewContent !== '<p></p>');
        return hasReview ? (
          <Tag color="success" icon={<CheckCircleOutlined />} className="border-none">已复盘</Tag>
        ) : (
          <Tag color="warning" icon={<ClockCircleOutlined />} className="border-none">待复盘</Tag>
        );
      },
    },
    {
      title: '复盘标题',
      dataIndex: 'reviewTitle',
      key: 'reviewTitle',
      width: 200,
      ellipsis: true,
      render: (text, record) => {
        // 合并交易取第一笔有复盘标题的子交易
        if (record.isMergedGroup && record.mergeStats?.trades) {
          const firstReviewed = record.mergeStats.trades.find(t => t.reviewTitle && t.reviewTitle.trim());
          const title = firstReviewed?.reviewTitle;
          return title ? (
            <span className="font-medium text-primary">{title}</span>
          ) : (
            <span className="text-tertiary">-</span>
          );
        }
        return text && text.trim() ? (
          <span className="font-medium text-primary">{text}</span>
        ) : (
          <span className="text-tertiary">-</span>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small" 
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          编辑
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-primary">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => onNavigate && onNavigate('strategies')}
              className="text-secondary hover:text-primary p-0 h-auto"
            />
            <h1 className="text-2xl font-medium tracking-tight text-primary m-0">
              策略复盘中心
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-secondary pl-8">
            {strategy && (
              <>
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: strategy.color }}
                />
                <span className="font-medium">{strategy.name}</span>
                <span className="text-tertiary mx-1">|</span>
                <span className="text-tertiary">管理与回顾您的策略执行情况</span>
              </>
            )}
          </div>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={() => window.location.reload()}
          className="btn-secondary"
        >
          刷新数据
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatItem 
          label="总交易数" 
          value={stats.totalTrades} 
          suffix="笔"
        />
        <StatItem 
          label="复盘进度" 
          value={`${Math.round(stats.reviewProgress)}%`}
          subValue={
            <Progress 
              percent={Math.round(stats.reviewProgress)} 
              showInfo={false} 
              strokeColor="var(--color-brand)" 
              trailColor="var(--bg-tertiary)"
              size="small"
            />
          }
          suffix={<span className="text-xs text-tertiary">({stats.reviewedTrades}/{stats.totalTrades})</span>}
        />
        <StatItem 
          label="总盈亏" 
          value={stats.totalPnL.toFixed(2)}
          prefix={stats.totalPnL >= 0 ? '+' : ''}
          valueColor={stats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
        />
        <StatItem 
          label="胜率" 
          value={stats.winRate.toFixed(1)}
          suffix="%"
        />
        <StatItem 
          label="平均盈亏" 
          value={Math.abs(stats.avgPnL).toFixed(2)}
          prefix={stats.avgPnL >= 0 ? '+' : '-'}
          valueColor={stats.avgPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
        />
      </div>

      {/* 筛选工具栏 */}
      <div className="card flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          {/* 合并显示开关 */}
          <Tooltip title={mergeEnabled ? '点击显示单笔交易' : '点击合并加减仓'}>
            <Button
              icon={mergeEnabled ? <MergeCellsOutlined /> : <UnorderedListOutlined />}
              onClick={() => setMergeEnabled(!mergeEnabled)}
              type={mergeEnabled ? 'primary' : 'default'}
            >
              {mergeEnabled ? '合并显示' : '逐笔显示'}
            </Button>
          </Tooltip>
          
          <div className="h-6 w-px bg-border-primary mx-2" />
          
          <RangePicker 
            placeholder={['开始日期', '结束日期']}
            value={filters.dateRange}
            onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
            className="w-64"
          />
          <Segmented
            value={filters.pnlFilter}
            onChange={(value) => setFilters(prev => ({ ...prev, pnlFilter: value }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '盈利', value: 'profit' },
              { label: '亏损', value: 'loss' },
            ]}
          />
          <Segmented
            value={filters.reviewStatus}
            onChange={(value) => setFilters(prev => ({ ...prev, reviewStatus: value }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '已复盘', value: 'reviewed' },
              { label: '待复盘', value: 'pending' },
            ]}
          />
        </div>
        
        <div className="flex gap-4">
          <Input
            placeholder="搜索品种/复盘内容..."
            prefix={<SearchOutlined className="text-tertiary" />}
            value={filters.searchText}
            onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
            className="w-64"
            allowClear
          />
          {selectedRowKeys.length > 0 && (
            <Button type="primary" onClick={() => setBatchModalVisible(true)}>
              批量编辑 ({selectedRowKeys.length})
            </Button>
          )}
        </div>
      </div>

      {/* 表格 */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-border-primary flex justify-between items-center">
          <h3 className="text-base font-medium text-primary m-0">交易列表</h3>
          <span className="text-xs text-secondary">共 {filteredTrades.length} 笔交易</span>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredTrades}
          pagination={{
            ...pagination,
            total: filteredTrades.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50', '100'],
            className: "p-4"
          }}
          onChange={(newPagination) => setPagination(newPagination)}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          scroll={{ x: 1200 }}
          size="middle"
          rowClassName={(record) => {
            const pnl = record.isMergedGroup 
              ? (record.mergeStats?.totalPnL || 0) 
              : getNetPnL(record);
            return pnl >= 0 ? 'trade-row-profit' : 'trade-row-loss';
          }}
        />
      </div>

      {/* 复盘编辑弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <span className="text-xl">📝</span>
            <span className="font-medium text-lg">交易复盘</span>
            {editingTrade && (
              <div className="flex gap-2 ml-2">
                {editingTrade.isMergedGroup && (
                  <Tag color="blue" icon={<MergeCellsOutlined />} className="border-none">
                    合并 {editingTrade.mergeStats?.tradeCount} 笔
                  </Tag>
                )}
                <Tag className="border-none font-mono font-bold">
                  {editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.instrumentCode 
                    : (editingTrade.instrument || editingTrade.instrumentCode)}
                </Tag>
              </div>
            )}
          </div>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={800}
        okText={editingTrade?.isMergedGroup ? `保存 ${editingTrade.mergeStats?.tradeCount} 笔复盘` : '保存复盘'}
        cancelText="取消"
        className="modern-modal"
      >
        {editingTrade && (
          <div className="space-y-6">
            {/* 合并交易提示 */}
            {editingTrade.isMergedGroup && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
                <MergeCellsOutlined className="text-blue-500 mt-1" />
                <div>
                  <div className="font-medium text-blue-500">合并交易组</div>
                  <div className="text-xs text-secondary mt-1">
                    此复盘将同时应用于组内 {editingTrade.mergeStats?.tradeCount} 笔子交易
                  </div>
                </div>
              </div>
            )}
            
            {/* 交易详情卡片 */}
            <div className="grid grid-cols-4 gap-4 bg-tertiary p-4 rounded-lg border border-border-primary">
              <div>
                <div className="text-xs text-secondary uppercase tracking-wider mb-1">品种</div>
                <div className="font-mono font-bold text-lg text-primary">
                  {editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.instrumentCode 
                    : (editingTrade.instrument || editingTrade.instrumentCode)}
                </div>
              </div>
              <div>
                <div className="text-xs text-secondary uppercase tracking-wider mb-1">方向</div>
                <Tag 
                  className="border-none px-2 py-1 text-sm m-0"
                  color={(editingTrade.isMergedGroup ? editingTrade.mergeStats?.direction : editingTrade.direction) === 'LONG' ? 'success' : 'error'}
                >
                  {(editingTrade.isMergedGroup ? editingTrade.mergeStats?.direction : editingTrade.direction) === 'LONG' ? '做多 ↑' : '做空 ↓'}
                </Tag>
              </div>
              <div>
                <div className="text-xs text-secondary uppercase tracking-wider mb-1">
                  {editingTrade.isMergedGroup ? '时间范围' : '开仓时间'}
                </div>
                <div className="font-mono font-medium text-primary">
                  {editingTrade.isMergedGroup 
                    ? `${dayjs(editingTrade.mergeStats?.firstOpenTime).format('MM/DD HH:mm')}`
                    : dayjs(editingTrade.openTime).format('MM/DD HH:mm:ss')}
                </div>
                {editingTrade.isMergedGroup && (
                  <div className="font-mono text-xs text-secondary">
                    至 {dayjs(editingTrade.mergeStats?.lastCloseTime).format('MM/DD HH:mm')}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-secondary uppercase tracking-wider mb-1">
                  {editingTrade.isMergedGroup ? '总盈亏' : '盈亏'}
                </div>
                <div className={`font-mono font-bold text-xl ${(editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade)) >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {(editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade)) >= 0 ? '+' : ''}
                  ${(editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade))?.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-primary mb-2">复盘标题</div>
                <Input
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="例如：突破做多案例 - 完美执行"
                  className="font-medium text-lg py-2"
                  maxLength={50}
                  showCount
                />
              </div>
              
              <div>
                <div className="text-sm font-medium text-primary mb-2">详细复盘内容</div>
                <RichEditor
                  value={reviewContent}
                  onChange={setReviewContent}
                  placeholder="记录你的交易思路、情绪状态、执行细节..."
                  minHeight={300}
                  maxHeight={500}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 批量编辑弹窗 */}
      <Modal
        title={`批量编辑复盘 (${selectedRowKeys.length} 笔)`}
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={async () => {
          if (!batchReviewContent || batchReviewContent === '<p></p>') {
            message.warning('请填写复盘内容');
            return;
          }
          
          try {
            for (const id of selectedRowKeys) {
              await StorageService.updateTrade(id, { reviewContent: batchReviewContent });
            }
            message.success(`已更新 ${selectedRowKeys.length} 笔交易`);
            setBatchModalVisible(false);
            setSelectedRowKeys([]);
            setBatchReviewContent('');
            // 刷新数据
            setTrades(prev => prev.map(t => 
              selectedRowKeys.includes(t.id) ? { ...t, reviewContent: batchReviewContent } : t
            ));
          } catch (error) {
            console.error('批量更新失败:', error);
            message.error('批量更新失败');
          }
        }}
        okText="批量更新"
        cancelText="取消"
        width={800}
      >
        <RichEditor
          value={batchReviewContent}
          onChange={setBatchReviewContent}
          placeholder="统一的复盘内容..."
          minHeight={300}
          maxHeight={500}
        />
      </Modal>
    </div>
  );
};

export default StrategyReview;