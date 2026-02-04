import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space,
  Popconfirm, message, Row, Col, ColorPicker, Tooltip, Drawer, Empty, Spin, Grid
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  BookOutlined,
  FireOutlined,
  ThunderboltOutlined,
  AimOutlined,
  RocketOutlined,
  SafetyOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  BarChartOutlined,
  EyeOutlined,
  RiseOutlined,
  FallOutlined,
  CalendarOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  CloseOutlined,
  MergeCellsOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import RichEditor from '../components/RichEditor';

const { useBreakpoint } = Grid;

// 预设颜色（币安风格调色板）
const PRESET_COLORS = [
  '#eab308', '#10b981', '#f43f5e', '#3b82f6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#EAB308', '#EF4444', '#3B82F6', '#A855F7'
];

// 策略分类
const STRATEGY_CATEGORIES = [
  { value: '趋势', label: '趋势策略', icon: <RocketOutlined /> },
  { value: '突破', label: '突破策略', icon: <ThunderboltOutlined /> },
  { value: '反转', label: '反转策略', icon: <ReloadOutlined /> },
  { value: '区间', label: '区间策略', icon: <AimOutlined /> },
  { value: '剥头皮', label: '剥头皮策略', icon: <FireOutlined /> },
  { value: '套利', label: '套利策略', icon: <SafetyOutlined /> },
  { value: '实验', label: '实验策略', icon: <ExperimentOutlined /> },
  { value: '通用', label: '通用策略', icon: <BookOutlined /> },
];

// 统计指标组件
const StatItem = ({ label, value, subValue, valueColor, prefix, suffix }) => (
  <div className="flex flex-col justify-between h-full hover:translate-y-[-2px] transition-transform duration-200">
    <div className="text-xs text-secondary uppercase tracking-wider mb-1">{label}</div>
    <div className="flex items-baseline gap-1">
      {prefix && <span className="text-lg text-secondary font-mono">{prefix}</span>}
      <div 
        className="text-2xl font-light font-mono tracking-tight"
        style={{ color: valueColor || 'var(--text-primary)' }}
      >
        {value}
      </div>
      {suffix && <span className="text-sm text-secondary font-mono ml-1">{suffix}</span>}
    </div>
    {subValue && <div className="mt-1 text-xs text-tertiary">{subValue}</div>}
  </div>
);

const TradingStrategies = ({ onNavigate }) => {
  const screens = useBreakpoint();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [form] = Form.useForm();
  
  // 关联订单抽屉
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyTrades, setStrategyTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [instruments, setInstruments] = useState([]);
  
  // 复盘编辑弹窗
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  
  // 移动端检测
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    loadStrategies();
    loadInstruments();
  }, []);
  
  const loadInstruments = async () => {
    try {
      const data = await StorageService.getInstruments();
      setInstruments(data || []);
    } catch (error) {
      console.error('加载品种配置失败:', error);
      setInstruments([]);
    }
  };
  
  // 计算净盈亏
  const getNetPnL = (trade) => {
    const pnl = trade.pnl || 0;
    const instrument = instruments.find(i => i.code === trade.instrumentCode);
    const feeRate = instrument?.feeRate || 0;
    const quantity = Math.abs(trade.openQuantity || trade.quantity || 1);
    const fee = feeRate * quantity * 2;
    return pnl - fee;
  };
  
  // 查看策略关联的订单
  const handleViewTrades = async (strategy) => {
    setSelectedStrategy(strategy);
    setDrawerVisible(true);
    setTradesLoading(true);
    
    try {
      const allTrades = await StorageService.getAllTrades();
      // 筛选使用该策略的交易（strategyIds 是数组）
      const filtered = allTrades.filter(t => 
        t.strategyIds && Array.isArray(t.strategyIds) && t.strategyIds.includes(strategy.id)
      );
      // 按时间倒序
      filtered.sort((a, b) => new Date(b.openTime) - new Date(a.openTime));
      setStrategyTrades(filtered);
    } catch (error) {
      console.error('加载交易失败:', error);
      message.error('加载交易失败');
    } finally {
      setTradesLoading(false);
    }
  };
  
  // 打开复盘编辑弹窗
  const handleOpenReview = (trade) => {
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
    
    setReviewModalVisible(true);
  };
  
  // 保存复盘
  const handleSaveReview = async () => {
    if (!editingTrade) return;
    setSavingReview(true);
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
        setStrategyTrades(prev => prev.map(t => 
          subTradeIds.includes(t.id) ? { ...t, reviewTitle, reviewContent } : t
        ));
      } else {
        // 单笔交易
        await StorageService.updateTrade(editingTrade.id, updateData);
        message.success('复盘保存成功');
        setStrategyTrades(prev => prev.map(t => 
          t.id === editingTrade.id ? { ...t, reviewTitle, reviewContent } : t
        ));
      }
      
      setReviewModalVisible(false);
    } catch (error) {
      console.error('保存复盘失败:', error);
      message.error('保存失败');
    } finally {
      setSavingReview(false);
    }
  };

  const loadStrategies = async () => {
    setLoading(true);
    try {
      const updatedStrategies = await StorageService.refreshStrategyUsageCounts();
      setStrategies(updatedStrategies || []);
    } catch (error) {
      console.error('加载策略失败:', error);
      message.error('加载策略失败');
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingStrategy(null);
    form.resetFields();
    form.setFieldsValue({
      color: PRESET_COLORS[0],
      category: '通用',
    });
    setModalVisible(true);
  };

  const handleEdit = (strategy) => {
    setEditingStrategy(strategy);
    form.setFieldsValue({
      name: strategy.name,
      description: strategy.description,
      color: strategy.color,
      category: strategy.category,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const colorValue = typeof values.color === 'string' 
        ? values.color 
        : values.color?.toHexString?.() || PRESET_COLORS[0];

      if (editingStrategy) {
        await StorageService.updateStrategy(editingStrategy.id, {
          name: values.name,
          description: values.description,
          color: colorValue,
          category: values.category,
        });
        message.success('策略更新成功');
      } else {
        await StorageService.createStrategy({
          name: values.name,
          description: values.description,
          color: colorValue,
          category: values.category,
        });
        message.success('策略创建成功');
      }
      setModalVisible(false);
      loadStrategies();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleDelete = async (strategyId) => {
    try {
      await StorageService.deleteStrategy(strategyId);
      message.success('策略已删除');
      loadStrategies();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const getCategoryIcon = (category) => {
    const found = STRATEGY_CATEGORIES.find(c => c.value === category);
    return found?.icon || <BookOutlined />;
  };

  const columns = [
    {
      title: '策略档案',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded flex items-center justify-center text-white"
            style={{ backgroundColor: record.color }}
          >
            {getCategoryIcon(record.category)}
          </div>
          <div>
            <div className="font-medium text-primary text-sm">{name}</div>
            <div className="text-xs text-tertiary mt-0.5">{record.category}</div>
          </div>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => (
        <span className="text-secondary text-xs">
          {desc || <span className="text-tertiary italic">无描述</span>}
        </span>
      ),
    },
    {
      title: '使用情况',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 120,
      align: 'right',
      sorter: (a, b) => (a.usageCount || 0) - (b.usageCount || 0),
      render: (count) => (
        <div className="text-right">
          <span className="font-mono font-bold text-primary">{count || 0}</span>
          <span className="text-xs text-tertiary ml-1">次</span>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看档案">
            <Button 
              type="text" 
              size="small"
              icon={<FolderOpenOutlined />} 
              onClick={() => handleViewTrades(record)}
              className="text-secondary hover:text-brand"
            />
          </Tooltip>
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
            className="text-secondary hover:text-primary"
          />
          <Popconfirm
            title="删除策略？"
            description="关联交易将保留，但移除此策略标签。"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, size: 'small' }}
          >
            <Button 
              type="text" 
              size="small" 
              icon={<DeleteOutlined />} 
              className="text-secondary hover:text-loss"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 统计数据
  const totalStrategies = strategies.length;
  const totalUsage = strategies.reduce((sum, s) => sum + (s.usageCount || 0), 0);
  const mostUsed = strategies.reduce((max, s) => (s.usageCount || 0) > (max?.usageCount || 0) ? s : max, null);

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 min-h-screen">
      {/* 头部 */}
      <div className="flex items-end justify-between border-b border-border-primary pb-4">
        <div>
          <h1 className="text-3xl font-light text-primary m-0 tracking-tight mb-2">
            策略库
          </h1>
          <div className="text-sm text-secondary font-mono flex gap-6">
            <span>总计: <span className="text-primary">{totalStrategies}</span></span>
            <span>累计执行: <span className="text-brand">{totalUsage}</span> 次</span>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button 
            type="text"
            icon={<ReloadOutlined />} 
            onClick={loadStrategies}
            className="text-secondary hover:text-primary"
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            className="bg-brand text-bg-primary font-semibold border-none hover:opacity-90"
          >
            新建策略
          </Button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 rounded bg-bg-secondary/50 border-l-2 border-brand">
          <StatItem 
            label="策略模型总数" 
            value={totalStrategies} 
            suffix="个"
            subValue="活跃使用的交易系统"
          />
        </div>
        <div className="p-4 rounded bg-bg-secondary/50 border-l-2 border-profit">
          <StatItem 
            label="累计执行次数" 
            value={totalUsage}
            suffix="次"
            valueColor="var(--color-profit)"
            subValue="所有策略的历史交易总和"
          />
        </div>
        <div className="p-4 rounded bg-bg-secondary/50 border-l-2 border-purple-500">
          <StatItem 
            label="最常用策略" 
            value={mostUsed?.name || '暂无'}
            valueColor="#a855f7"
            subValue={`已执行 ${mostUsed?.usageCount || 0} 次`}
          />
        </div>
      </div>

      {/* 策略列表 */}
      <div className="bg-bg-secondary rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border-primary flex justify-between items-center">
          <div className="font-medium text-primary">策略档案列表</div>
          <div className="text-xs text-tertiary">按使用频率排序</div>
        </div>
        <Table
          columns={columns}
          dataSource={strategies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true, className: "p-4" }}
          className="archive-table"
          rowClassName="archive-row hover:bg-bg-tertiary transition-colors"
          locale={{
            emptyText: (
              <div className="py-12 flex flex-col items-center">
                <div className="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mb-4">
                  <BulbOutlined className="text-2xl text-tertiary" />
                </div>
                <div className="text-primary font-medium mb-2">暂无策略模型</div>
                <div className="text-secondary text-xs mb-6">建立你的第一个交易系统档案</div>
                <Button type="primary" onClick={handleCreate} className="bg-brand text-bg-primary border-none">
                  立即创建
                </Button>
              </div>
            )
          }}
        />
      </div>

      {/* 策略表单抽屉 */}
      <Drawer
        title={
          <div className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <span className="font-medium text-lg text-primary">
              {editingStrategy ? '编辑策略档案' : '新建策略档案'}
            </span>
          </div>
        }
        placement="right"
        width={500}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        className="archive-drawer"
        footer={
          <div className="flex justify-end gap-3 pt-4 border-t border-border-primary">
            <Button onClick={() => setModalVisible(false)} className="text-secondary hover:text-primary">
              取消
            </Button>
            <Button 
              type="primary" 
              onClick={handleSave} 
              loading={loading}
              className="bg-brand text-bg-primary font-semibold border-none hover:opacity-90"
            >
              保存档案
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item
            name="name"
            label={<span className="text-secondary text-xs uppercase tracking-wider font-semibold">策略名称</span>}
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input 
              placeholder="例如：趋势跟随系统" 
              maxLength={20} 
              className="bg-bg-tertiary border-border-primary text-primary"
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item 
              name="category" 
              label={<span className="text-secondary text-xs uppercase tracking-wider font-semibold">策略类型</span>}
            >
              <Select className="bg-bg-tertiary">
                {STRATEGY_CATEGORIES.map(cat => (
                  <Select.Option key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      {cat.icon}
                      <span>{cat.label}</span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item 
              name="color" 
              label={<span className="text-secondary text-xs uppercase tracking-wider font-semibold">标识颜色</span>}
            >
              <div className="flex items-center gap-3 bg-bg-tertiary p-2 rounded border border-border-primary h-[32px]">
                <ColorPicker presets={[{ label: '推荐', colors: PRESET_COLORS }]} size="small" />
                <span className="text-xs text-secondary">用于图表区分</span>
              </div>
            </Form.Item>
          </div>

          <Form.Item 
            name="description" 
            label={<span className="text-secondary text-xs uppercase tracking-wider font-semibold">执行逻辑 / 规则</span>}
          >
            <Input.TextArea 
              rows={8} 
              placeholder="描述入场条件、出场规则与风控要求..."
              maxLength={1000}
              showCount
              className="bg-bg-tertiary border-border-primary text-primary"
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 关联订单抽屉 */}
      <Drawer
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <FolderOpenOutlined className="text-brand text-lg" />
              <div>
                <div className="font-medium text-primary">{selectedStrategy?.name}</div>
                <div className="text-xs text-secondary font-normal">关联交易档案 ({strategyTrades.length})</div>
              </div>
            </div>
            {strategyTrades.length > 0 && (
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  setDrawerVisible(false);
                  onNavigate && onNavigate('strategy-review', { strategyId: selectedStrategy?.id });
                }}
                className="bg-brand text-bg-primary border-none"
              >
                进入复盘中心
              </Button>
            )}
          </div>
        }
        placement="right"
        width={isMobile ? '100%' : 500}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        className="archive-drawer"
      >
        {tradesLoading ? (
          <div className="flex justify-center items-center h-64">
            <Spin />
          </div>
        ) : strategyTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-secondary">
            <FileTextOutlined className="text-4xl mb-4 opacity-20" />
            <div>暂无关联交易记录</div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* 统计摘要 */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-bg-secondary border-b border-border-primary">
              <div>
                <div className="text-xs text-tertiary mb-1">总盈亏</div>
                <div className={`font-mono font-bold ${strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) >= 0 ? '+' : ''}
                  ${strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-tertiary mb-1">胜率</div>
                <div className="font-mono font-bold text-primary">
                  {strategyTrades.length > 0 
                    ? ((strategyTrades.filter(t => getNetPnL(t) > 0).length / strategyTrades.length) * 100).toFixed(0) 
                    : 0}%
                </div>
              </div>
              <div>
                <div className="text-xs text-tertiary mb-1">平均盈亏</div>
                <div className={`font-mono font-bold ${(strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) / strategyTrades.length) >= 0 ? 'text-profit' : 'text-loss'}`}>
                  ${(strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) / strategyTrades.length).toFixed(2)}
                </div>
              </div>
            </div>

            {/* 订单列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {strategyTrades.map((trade, index) => {
                const netPnL = getNetPnL(trade);
                const isProfit = netPnL >= 0;
                const hasReview = (trade.reviewTitle && trade.reviewTitle.trim()) || (trade.reviewContent && trade.reviewContent !== '<p></p>');
                
                return (
                  <div 
                    key={trade.id || index}
                    className="p-3 bg-bg-secondary rounded border border-border-primary hover:border-brand transition-colors cursor-pointer group"
                    onClick={() => handleOpenReview(trade)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.direction === 'LONG' ? 'bg-profit-bg text-profit' : 'bg-loss-bg text-loss'}`}>
                          {trade.direction === 'LONG' ? '多' : '空'}
                        </span>
                        <span className="font-mono font-bold text-primary">{trade.instrumentCode}</span>
                        <span className="text-xs text-tertiary font-mono">{dayjs(trade.openTime).format('MM-DD HH:mm')}</span>
                      </div>
                      <div className={`font-mono font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {isProfit ? '+' : ''}${netPnL.toFixed(2)}
                      </div>
                    </div>
                    
                    {hasReview ? (
                      <div className="text-xs text-secondary truncate pl-2 border-l-2 border-brand/30">
                        {trade.reviewTitle || '无标题复盘'}
                      </div>
                    ) : (
                      <div className="text-xs text-tertiary italic pl-2 border-l-2 border-transparent group-hover:border-tertiary/30">
                        点击添加复盘...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Drawer>

      {/* 复盘编辑抽屉 (档案风格) */}
      <Drawer
        title={null}
        footer={null}
        open={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        width={screens.md ? 'calc(100vw - 240px)' : '100%'}
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
                    onClick={() => setReviewModalVisible(false)}
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
                  <Button size="large" onClick={() => setReviewModalVisible(false)}>取消</Button>
                  <Button size="large" type="primary" onClick={handleSaveReview} loading={savingReview} className="bg-brand text-bg-primary font-semibold px-8">保存档案</Button>
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

export default TradingStrategies;