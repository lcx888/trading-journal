import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Button, Card, Tag, Input, Select, DatePicker, Space, 
  Modal, Form, Empty, Spin, Tooltip, Progress, Statistic, Badge,
  message, Tabs, Dropdown, Segmented
} from 'antd';
import { 
  ArrowLeftOutlined, SearchOutlined, FilterOutlined, EditOutlined,
  CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, 
  MergeCellsOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import RichEditor from '../components/RichEditor';
import { processTradesWithMerge, formatDuration } from '../services/tradeMerge';

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MergeCellsOutlined style={{ color: 'var(--color-brand)', fontSize: 12 }} />
                <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                  合并 {stats.tradeCount} 笔
                </Tag>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>
                {dayjs(stats.firstOpenTime).format('MM-DD HH:mm')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                至 {dayjs(stats.lastCloseTime).format('MM-DD HH:mm')}
              </div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {dayjs(time).format('YYYY-MM-DD')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
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
      width: 80,
      render: (instrument, record) => {
        const code = record.isMergedGroup ? record.mergeStats?.instrumentCode : (instrument || record.instrumentCode);
        return <Tag style={{ margin: 0 }}>{code}</Tag>;
      },
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 70,
      render: (direction, record) => {
        const dir = record.isMergedGroup ? record.mergeStats?.direction : direction;
        return (
          <Tag 
            color={dir === 'LONG' ? 'success' : 'error'}
            icon={dir === 'LONG' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          >
            {dir === 'LONG' ? '多' : '空'}
          </Tag>
        );
      },
    },
    {
      title: '数量',
      key: 'quantity',
      width: 70,
      render: (_, record) => {
        if (record.isMergedGroup && record.mergeStats) {
          return (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {record.mergeStats.totalQuantity}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                峰值: {record.mergeStats.maxConcurrentQty}
              </div>
            </div>
          );
        }
        return <span>{record.openQuantity || 1}</span>;
      },
    },
    {
      title: '盈亏',
      key: 'pnl',
      width: 110,
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
            <div>
              <div style={{ 
                fontWeight: 700, 
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
              }}>
                {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                均: ${stats.avgPnL?.toFixed(2)}
              </div>
            </div>
          );
        }
        const pnl = getNetPnL(record);
        return (
          <span style={{ 
            fontWeight: 700, 
            fontFamily: 'var(--font-mono)',
            color: pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
          }}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
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
            return <Tag color="success" icon={<CheckCircleOutlined />}>已复盘</Tag>;
          } else if (reviewedCount > 0) {
            return <Tag color="processing">{reviewedCount}/{subTrades.length}</Tag>;
          }
          return <Tag color="warning" icon={<ClockCircleOutlined />}>待复盘</Tag>;
        }
        const hasReview = (record.reviewTitle && record.reviewTitle.trim()) || (record.reviewContent && record.reviewContent !== '<p></p>');
        return hasReview ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>已复盘</Tag>
        ) : (
          <Tag color="warning" icon={<ClockCircleOutlined />}>待复盘</Tag>
        );
      },
    },
    {
      title: '复盘标题',
      dataIndex: 'reviewTitle',
      key: 'reviewTitle',
      width: 180,
      ellipsis: true,
      render: (text, record) => {
        // 合并交易取第一笔有复盘标题的子交易
        if (record.isMergedGroup && record.mergeStats?.trades) {
          const firstReviewed = record.mergeStats.trades.find(t => t.reviewTitle && t.reviewTitle.trim());
          const title = firstReviewed?.reviewTitle;
          return title ? (
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>-</span>
          );
        }
        return text && text.trim() ? (
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text}</span>
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
        );
      },
    },
    {
      title: '复盘内容',
      dataIndex: 'reviewContent',
      key: 'reviewContent',
      ellipsis: true,
      render: (text, record) => {
        // 合并交易取第一笔有复盘内容的子交易
        if (record.isMergedGroup && record.mergeStats?.trades) {
          const firstReviewed = record.mergeStats.trades.find(t => t.reviewContent && t.reviewContent !== '<p></p>');
          const content = firstReviewed?.reviewContent;
          return content ? (
            <div 
              style={{ maxHeight: 40, overflow: 'hidden', fontSize: 12 }}
              dangerouslySetInnerHTML={{ __html: content.replace(/<[^>]*>/g, ' ').substring(0, 100) }}
            />
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>-</span>
          );
        }
        return text && text !== '<p></p>' ? (
          <div 
            style={{ maxHeight: 40, overflow: 'hidden', fontSize: 12 }}
            dangerouslySetInnerHTML={{ __html: text.replace(/<[^>]*>/g, ' ').substring(0, 100) }}
          />
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 24, 
      background: 'var(--bg-primary)', 
      minHeight: '100vh' 
    }}>
      {/* 头部 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 24 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => onNavigate && onNavigate('strategies')}
          >
            返回策略库
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {strategy && (
              <Tag 
                style={{ 
                  backgroundColor: strategy.color, 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 16, 
                  padding: '4px 16px',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                {strategy.name}
              </Tag>
            )}
            <span style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: 'var(--text-primary)' 
            }}>
              策略复盘中心
            </span>
          </div>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={() => window.location.reload()}
        >
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, 1fr)', 
        gap: 16, 
        marginBottom: 24 
      }}>
        <Card size="small" style={{ background: 'var(--bg-secondary)' }}>
          <Statistic 
            title="总交易数"
            value={stats.totalTrades}
            suffix="笔"
            valueStyle={{ color: 'var(--text-primary)' }}
          />
        </Card>
        <Card size="small" style={{ background: 'var(--bg-secondary)' }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>复盘进度</span>
          </div>
          <Progress 
            percent={Math.round(stats.reviewProgress)} 
            strokeColor="var(--color-brand)"
            format={(percent) => (
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {stats.reviewedTrades}/{stats.totalTrades}
              </span>
            )}
          />
        </Card>
        <Card size="small" style={{ background: 'var(--bg-secondary)' }}>
          <Statistic 
            title="总盈亏"
            value={stats.totalPnL}
            precision={2}
            prefix={stats.totalPnL >= 0 ? '+$' : '-$'}
            valueStyle={{ 
              color: stats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
            }}
          />
        </Card>
        <Card size="small" style={{ background: 'var(--bg-secondary)' }}>
          <Statistic 
            title="胜率"
            value={stats.winRate}
            precision={1}
            suffix="%"
            valueStyle={{ color: 'var(--text-primary)' }}
          />
        </Card>
        <Card size="small" style={{ background: 'var(--bg-secondary)' }}>
          <Statistic 
            title="平均盈亏"
            value={Math.abs(stats.avgPnL)}
            precision={2}
            prefix={stats.avgPnL >= 0 ? '+$' : '-$'}
            valueStyle={{ 
              color: stats.avgPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
            }}
          />
        </Card>
      </div>

      {/* 筛选工具栏 */}
      <Card 
        size="small" 
        style={{ background: 'var(--bg-secondary)', marginBottom: 16 }}
      >
        <Space wrap>
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
          <RangePicker 
            placeholder={['开始日期', '结束日期']}
            value={filters.dateRange}
            onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
            style={{ width: 240 }}
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
          <Input
            placeholder="搜索品种/复盘内容..."
            prefix={<SearchOutlined />}
            value={filters.searchText}
            onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
            style={{ width: 200 }}
            allowClear
          />
          <Button 
            onClick={() => setFilters({
              dateRange: null,
              pnlFilter: 'all',
              reviewStatus: 'all',
              searchText: '',
            })}
          >
            重置筛选
          </Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Card 
        size="small"
        style={{ background: 'var(--bg-secondary)' }}
        title={
          <span style={{ color: 'var(--text-primary)' }}>
            筛选结果：{filteredTrades.length} 笔交易
          </span>
        }
        extra={
          selectedRowKeys.length > 0 && (
            <Button type="primary" onClick={() => setBatchModalVisible(true)}>
              批量编辑 ({selectedRowKeys.length})
            </Button>
          )
        }
      >
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
          }}
          onChange={(newPagination) => setPagination(newPagination)}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>

      {/* 复盘编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>📝</span>
            <span>交易复盘</span>
            {editingTrade && (
              <>
                {editingTrade.isMergedGroup && (
                  <Tag color="blue" icon={<MergeCellsOutlined />}>
                    合并 {editingTrade.mergeStats?.tradeCount} 笔
                  </Tag>
                )}
                <Tag>
                  {editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.instrumentCode 
                    : (editingTrade.instrument || editingTrade.instrumentCode)}
                </Tag>
                <Tag color={
                  (editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade)) >= 0 ? 'success' : 'error'
                }>
                  {(editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade)) >= 0 ? '+' : ''}
                  ${(editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade))?.toFixed(2)}
                </Tag>
              </>
            )}
          </div>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={700}
        okText={editingTrade?.isMergedGroup ? `保存 ${editingTrade.mergeStats?.tradeCount} 笔复盘` : '保存复盘'}
        cancelText="取消"
      >
        {editingTrade && (
          <div>
            {/* 合并交易提示 */}
            {editingTrade.isMergedGroup && (
              <div style={{ 
                padding: 12, 
                background: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: 8, 
                marginBottom: 16,
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6' }}>
                  <MergeCellsOutlined />
                  <span style={{ fontWeight: 600 }}>合并交易组</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  此复盘将同时应用于组内 {editingTrade.mergeStats?.tradeCount} 笔子交易
                </div>
              </div>
            )}
            
            {/* 交易详情 */}
            <div style={{ 
              padding: 16, 
              background: 'var(--bg-secondary)', 
              borderRadius: 8, 
              marginBottom: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>品种</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                  {editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.instrumentCode 
                    : (editingTrade.instrument || editingTrade.instrumentCode)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>方向</div>
                <Tag 
                  color={(editingTrade.isMergedGroup ? editingTrade.mergeStats?.direction : editingTrade.direction) === 'LONG' ? 'success' : 'error'}
                  style={{ marginTop: 4 }}
                >
                  {(editingTrade.isMergedGroup ? editingTrade.mergeStats?.direction : editingTrade.direction) === 'LONG' ? '做多 ↑' : '做空 ↓'}
                </Tag>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  {editingTrade.isMergedGroup ? '时间范围' : '开仓时间'}
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {editingTrade.isMergedGroup 
                    ? `${dayjs(editingTrade.mergeStats?.firstOpenTime).format('MM/DD HH:mm')}`
                    : dayjs(editingTrade.openTime).format('MM/DD HH:mm:ss')}
                </div>
                {editingTrade.isMergedGroup && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    至 {dayjs(editingTrade.mergeStats?.lastCloseTime).format('MM/DD HH:mm')}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  {editingTrade.isMergedGroup ? '总盈亏' : '盈亏'}
                </div>
                <div style={{ 
                  fontWeight: 700, 
                  fontSize: 18,
                  fontFamily: 'var(--font-mono)',
                  color: (editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade)) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                }}>
                  {(editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade)) >= 0 ? '+' : ''}
                  ${(editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.totalPnL 
                    : getNetPnL(editingTrade))?.toFixed(2)}
                </div>
                {editingTrade.isMergedGroup && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    总手: {editingTrade.mergeStats?.totalQuantity}
                  </div>
                )}
              </div>
            </div>

            <Input
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              placeholder="复盘标题（例如：突破做多案例）"
              style={{ 
                marginBottom: 12,
                fontSize: 16,
                fontWeight: 600,
              }}
              maxLength={50}
              showCount
            />
            
            <RichEditor
              value={reviewContent}
              onChange={setReviewContent}
              placeholder="记录你的交易复盘..."
              minHeight={250}
              maxHeight={350}
            />
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
        width={700}
      >
        <RichEditor
          value={batchReviewContent}
          onChange={setBatchReviewContent}
          placeholder="统一的复盘内容..."
          minHeight={200}
          maxHeight={300}
        />
      </Modal>
    </div>
  );
};

export default StrategyReview;
