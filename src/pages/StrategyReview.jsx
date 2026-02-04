import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Button, Tag, Input, DatePicker, Space, 
  Drawer, Spin, Tooltip, Progress, message, Segmented, Divider, Grid
} from 'antd';
import { 
  ArrowLeftOutlined, SearchOutlined, EditOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined, 
  MergeCellsOutlined, UnorderedListOutlined,
  FileTextOutlined, CalendarOutlined, NumberOutlined,
  CloseOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import RichEditor from '../components/RichEditor';
import { processTradesWithMerge } from '../services/tradeMerge';

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

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
  const screens = useBreakpoint();
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
      title: '复盘档案',
      dataIndex: 'reviewTitle',
      key: 'reviewTitle',
      width: 400,
      render: (text, record) => {
        let title = text;
        let content = record.reviewContent;
        let hasReview = false;

        // 处理合并交易的标题显示
        if (record.isMergedGroup && record.mergeStats?.trades) {
          const firstReviewed = record.mergeStats.trades.find(t => t.reviewTitle && t.reviewTitle.trim());
          const firstContent = record.mergeStats.trades.find(t => t.reviewContent && t.reviewContent !== '<p></p>');
          title = firstReviewed?.reviewTitle;
          content = firstContent?.reviewContent;
          hasReview = !!(title || content);
        } else {
          hasReview = !!(text && text.trim()) || (content && content !== '<p></p>');
        }

        return (
          <div className="py-1">
            <div className="flex items-center gap-2 mb-1">
              {hasReview ? (
                <span className="font-medium text-base text-primary hover:text-brand transition-colors cursor-pointer" onClick={() => handleEdit(record)}>
                  {title || '无标题复盘'}
                </span>
              ) : (
                <span className="text-tertiary italic cursor-pointer hover:text-brand" onClick={() => handleEdit(record)}>
                  点击添加复盘...
                </span>
              )}
              {record.isMergedGroup && (
                <Tag className="border-none bg-blue-500/10 text-blue-500 m-0 text-[10px]">
                  合并{record.mergeStats?.tradeCount}笔
                </Tag>
              )}
            </div>
            {content && content !== '<p></p>' && (
              <div 
                className="text-xs text-secondary truncate-2 max-w-[380px]"
                dangerouslySetInnerHTML={{ __html: content.replace(/<[^>]*>/g, ' ').substring(0, 100) }}
              />
            )}
          </div>
        );
      },
    },
    {
      title: '交易背景',
      key: 'context',
      width: 200,
      render: (_, record) => {
        const isMerged = record.isMergedGroup;
        const stats = isMerged ? record.mergeStats : null;
        
        const time = isMerged ? stats.firstOpenTime : record.openTime;
        const code = isMerged ? stats.instrumentCode : record.instrumentCode;
        const dir = isMerged ? stats.direction : record.direction;
        const qty = isMerged ? stats.totalQuantity : (record.openQuantity || 1);
        
        const isLong = dir === 'LONG';

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-primary">{code}</span>
              <span className={`text-xs font-medium ${isLong ? 'text-profit' : 'text-loss'}`}>
                {isLong ? '做多' : '做空'}
              </span>
              <span className="text-xs text-tertiary font-mono">
                {qty}手
              </span>
            </div>
            <div className="text-xs text-secondary font-mono">
              {dayjs(time).format('YYYY-MM-DD HH:mm')}
            </div>
          </div>
        );
      },
    },
    {
      title: '结果',
      key: 'result',
      width: 150,
      align: 'right',
      sorter: (a, b) => {
        const pnlA = a.isMergedGroup ? (a.mergeStats?.totalPnL || 0) : getNetPnL(a);
        const pnlB = b.isMergedGroup ? (b.mergeStats?.totalPnL || 0) : getNetPnL(b);
        return pnlA - pnlB;
      },
      render: (_, record) => {
        const pnl = record.isMergedGroup 
          ? (record.mergeStats?.totalPnL || 0) 
          : getNetPnL(record);
        
        return (
          <div>
            <div className={`font-mono font-bold text-base ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
            </div>
            {record.isMergedGroup && (
               <div className="text-[10px] text-tertiary font-mono">
                 均: {record.mergeStats?.avgPnL?.toFixed(2)}
               </div>
            )}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'right',
      render: (_, record) => (
        <Button 
          type="text" 
          size="small" 
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
          className="text-secondary hover:text-brand"
        />
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
    <div className="max-w-[1600px] mx-auto p-6 min-h-screen">
      {/* 极简头部 */}
      <div className="flex items-end justify-between mb-8 pb-4 border-b border-border-primary">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => onNavigate && onNavigate('strategies')}
              className="text-secondary hover:text-primary p-0"
            />
            <h1 className="text-3xl font-light text-primary m-0 tracking-tight">
              {strategy?.name || '策略复盘'}
            </h1>
            {strategy && (
              <span 
                className="w-2 h-2 rounded-full mt-2" 
                style={{ backgroundColor: strategy.color }}
              />
            )}
          </div>
          <div className="flex items-center gap-6 text-sm text-secondary font-mono">
            <span>总交易: <span className="text-primary">{stats.totalTrades}</span></span>
            <span>复盘率: <span className="text-brand">{Math.round(stats.reviewProgress)}%</span></span>
            <span>胜率: <span className="text-primary">{stats.winRate.toFixed(1)}%</span></span>
            <span>总盈亏: <span className={stats.totalPnL >= 0 ? 'text-profit' : 'text-loss'}>
              {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}
            </span></span>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Input
            placeholder="搜索复盘档案..."
            prefix={<SearchOutlined className="text-tertiary" />}
            value={filters.searchText}
            onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
            className="w-64 bg-transparent border-border-primary hover:border-border-hover focus:border-brand"
            allowClear
            bordered={false}
            style={{ borderBottom: '1px solid var(--border-primary)', borderRadius: 0 }}
          />
          <Tooltip title={mergeEnabled ? '切换至逐笔显示' : '切换至合并显示'}>
            <Button
              type="text"
              icon={mergeEnabled ? <MergeCellsOutlined /> : <UnorderedListOutlined />}
              onClick={() => setMergeEnabled(!mergeEnabled)}
              className={mergeEnabled ? 'text-brand' : 'text-secondary'}
            />
          </Tooltip>
          <Button 
            type="text"
            icon={<ReloadOutlined />} 
            onClick={() => window.location.reload()}
            className="text-secondary hover:text-primary"
          />
        </div>
      </div>

      {/* 档案列表 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredTrades}
        pagination={{
          ...pagination,
          total: filteredTrades.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => <span className="text-tertiary">共 {total} 条档案</span>,
          pageSizeOptions: ['20', '50', '100'],
          className: "py-4"
        }}
        onChange={(newPagination) => setPagination(newPagination)}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 800 }}
        size="middle"
        className="archive-table"
        rowClassName="archive-row hover:bg-bg-tertiary transition-colors cursor-pointer"
        onRow={(record) => ({
          onClick: () => handleEdit(record),
        })}
      />

      {/* 复盘编辑抽屉 */}
      <Drawer
        title={null}
        footer={null}
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        width={screens.md ? '85%' : '100%'}
        placement="right"
        className="archive-drawer"
        styles={{ body: { padding: 0, overflow: 'hidden' } }}
        closeIcon={null}
        maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
      >
        {editingTrade && (
          <div className="flex h-full">
            {/* 左侧：交易数据 (侧边栏风格) */}
            <div className="w-80 bg-bg-secondary border-r border-border-primary p-6 flex flex-col gap-6 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-tertiary uppercase tracking-wider">交易档案</div>
                  <Button 
                    type="text" 
                    icon={<CloseOutlined />} 
                    onClick={() => setEditModalVisible(false)}
                    className="text-tertiary hover:text-primary"
                  />
                </div>
                <div className="font-mono text-2xl font-bold text-primary mb-2">
                  {editingTrade.isMergedGroup 
                    ? editingTrade.mergeStats?.instrumentCode 
                    : (editingTrade.instrument || editingTrade.instrumentCode)}
                </div>
                <div className="flex items-center gap-2">
                  <Tag 
                    className="border-none px-2 py-0.5 m-0 font-bold text-sm"
                    color={(editingTrade.isMergedGroup ? editingTrade.mergeStats?.direction : editingTrade.direction) === 'LONG' ? 'success' : 'error'}
                  >
                    {(editingTrade.isMergedGroup ? editingTrade.mergeStats?.direction : editingTrade.direction) === 'LONG' ? '做多' : '做空'}
                  </Tag>
                  <span className="text-secondary text-sm font-mono bg-bg-tertiary px-2 py-0.5 rounded">
                    {editingTrade.isMergedGroup ? editingTrade.mergeStats?.totalQuantity : (editingTrade.openQuantity || 1)}手
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-bg-tertiary rounded-lg border border-border-primary">
                  <div className="text-xs text-tertiary mb-1">盈亏结果</div>
                  <div className={`font-mono text-3xl font-bold ${(editingTrade.isMergedGroup 
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

                <div>
                  <div className="text-xs text-tertiary mb-1">时间</div>
                  <div className="font-mono text-base text-primary">
                    {editingTrade.isMergedGroup 
                      ? dayjs(editingTrade.mergeStats?.firstOpenTime).format('YYYY-MM-DD')
                      : dayjs(editingTrade.openTime).format('YYYY-MM-DD')}
                  </div>
                  <div className="font-mono text-sm text-secondary">
                    {editingTrade.isMergedGroup 
                      ? `${dayjs(editingTrade.mergeStats?.firstOpenTime).format('HH:mm')} - ${dayjs(editingTrade.mergeStats?.lastCloseTime).format('HH:mm')}`
                      : dayjs(editingTrade.openTime).format('HH:mm:ss')}
                  </div>
                </div>
              </div>

              {editingTrade.isMergedGroup && (
                <div className="mt-auto bg-blue-500/5 p-4 rounded-lg border border-blue-500/10">
                  <div className="flex items-center gap-2 text-blue-500 mb-2">
                    <MergeCellsOutlined />
                    <span className="text-sm font-bold">合并交易组</span>
                  </div>
                  <div className="text-xs text-blue-400/80 leading-relaxed">
                    包含 {editingTrade.mergeStats?.tradeCount} 笔子交易。
                    <br/>
                    保存复盘将同步更新组内所有记录。
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：复盘内容 (文档风格) */}
            <div className="flex-1 flex flex-col bg-bg-primary h-full overflow-hidden">
              <div className="p-8 border-b border-border-primary flex justify-between items-start flex-shrink-0">
                <Input.TextArea
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="在此输入复盘标题..."
                  className="text-3xl font-bold bg-transparent border-none focus:shadow-none p-0 resize-none !text-primary placeholder:text-tertiary/30"
                  autoSize
                  maxLength={100}
                />
                <div className="flex gap-3 ml-8">
                  <Button size="large" onClick={() => setEditModalVisible(false)}>取消</Button>
                  <Button size="large" type="primary" onClick={handleSave} loading={saving} className="bg-brand text-bg-primary font-semibold px-8">保存档案</Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto">
                  <RichEditor
                    value={reviewContent}
                    onChange={setReviewContent}
                    placeholder="开始撰写复盘..."
                    minHeight={500}
                    className="border-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <style jsx global>{`
        .archive-table .ant-table-thead > tr > th {
          background: transparent !important;
          border-bottom: 1px solid var(--border-primary) !important;
          color: var(--text-tertiary) !important;
          font-weight: 400 !important;
          font-size: 12px !important;
        }
        .archive-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid var(--border-primary) !important;
          padding: 16px 16px !important;
        }
        .archive-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }
        .archive-row:hover > td {
          background: var(--bg-tertiary) !important;
        }
      `}</style>
    </div>
  );
};

export default StrategyReview;