import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space,
  Popconfirm, message, Row, Col, ColorPicker, Tooltip, Drawer, Empty, Spin
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import RichEditor from '../components/RichEditor';

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

const TradingStrategies = ({ onNavigate }) => {
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
    setReviewContent(trade.reviewContent || '');
    setReviewModalVisible(true);
  };
  
  // 保存复盘
  const handleSaveReview = async () => {
    if (!editingTrade) return;
    setSavingReview(true);
    try {
      await StorageService.updateTrade(editingTrade.id, { reviewContent });
      message.success('复盘保存成功');
      setReviewModalVisible(false);
      // 更新本地状态
      setStrategyTrades(prev => prev.map(t => 
        t.id === editingTrade.id ? { ...t, reviewContent } : t
      ));
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
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>策略模型</span>,
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 8, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: record.color,
              color: '#fff'
            }}
          >
            {getCategoryIcon(record.category)}
          </div>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{name}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
              {record.category} 系统
            </div>
          </div>
        </div>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>标签预览</span>,
      dataIndex: 'color',
      key: 'preview',
      width: 140,
      render: (color, record) => (
        <Tag 
          style={{ 
            backgroundColor: color, 
            color: '#fff', 
            border: 'none', 
            borderRadius: 12, 
            padding: '2px 12px',
            fontSize: 11,
            fontWeight: 600
          }}
        >
          {record.name}
        </Tag>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>描述</span>,
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => (
        <Tooltip title={desc}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {desc || '--'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>使用次数</span>,
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.usageCount || 0) - (b.usageCount || 0),
      render: (count) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          {count || 0}
        </span>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>操作</span>,
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看关联订单">
            <Button 
              type="text" 
              size="small"
              style={{ color: 'var(--color-brand)' }}
              icon={<EyeOutlined />} 
              onClick={() => handleViewTrades(record)}
            />
          </Tooltip>
          <Button 
            type="text" 
            size="small"
            style={{ color: 'var(--text-tertiary)' }}
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={<span style={{ color: 'var(--text-primary)' }}>删除策略？</span>}
            description={<span style={{ color: 'var(--text-secondary)' }}>使用该策略的交易将移除标签。</span>}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, size: 'small' }}
            cancelButtonProps={{ size: 'small' }}
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: 'var(--color-loss)', opacity: 0.6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 统计数据
  const totalStrategies = strategies.length;
  const totalUsage = strategies.reduce((sum, s) => sum + (s.usageCount || 0), 0);
  const mostUsed = strategies.reduce((max, s) => (s.usageCount || 0) > (max?.usageCount || 0) ? s : max, null);

  // 统计卡片组件
  const StatCard = ({ label, value, icon, color, subLabel }) => (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 6,
      padding: 16,
    }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ 
        fontSize: 24, 
        fontWeight: 700, 
        fontFamily: 'var(--font-mono)', 
        color: color || 'var(--text-primary)',
        letterSpacing: '-0.5px'
      }}>
        {value}
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500 }}>
        {icon}
        <span>{subLabel}</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部统计区 */}
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <StatCard 
            label="策略总数" 
            value={totalStrategies} 
            icon={<BulbOutlined style={{ color: 'var(--color-brand)' }} />}
            subLabel="活跃库"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard 
            label="累计使用" 
            value={totalUsage}
            icon={<BarChartOutlined style={{ color: 'var(--color-profit)' }} />}
            subLabel="数据样本"
            color="var(--color-profit)"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard 
            label="最常用" 
            value={mostUsed?.name || '暂无'}
            icon={<FireOutlined style={{ color: 'var(--color-brand)' }} />}
            subLabel="使用最高"
            color="var(--color-brand)"
          />
        </Col>
      </Row>

      {/* 列表控制栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: isMobile ? '10px 12px' : '12px 16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 6
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
          {!isMobile && (
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 4, 
              background: 'var(--color-brand-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ThunderboltOutlined style={{ color: 'var(--color-brand)' }} />
            </div>
          )}
          <span style={{ fontWeight: 600, fontSize: isMobile ? 13 : 14, color: 'var(--text-primary)' }}>策略库</span>
          <span style={{ 
            fontSize: isMobile ? 9 : 10, 
            color: 'var(--text-tertiary)', 
            background: 'var(--bg-tertiary)', 
            padding: '2px 8px', 
            borderRadius: 2 
          }}>
            {totalStrategies} 个
          </span>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          size={isMobile ? 'small' : 'middle'}
          style={{ 
            background: 'var(--color-brand)', 
            borderColor: 'var(--color-brand)', 
            color: 'var(--bg-primary)', 
            fontWeight: 600, 
            fontSize: isMobile ? 11 : 12,
            borderRadius: 4,
            height: isMobile ? 28 : 32
          }}
        >
          {isMobile ? '新建' : '新建策略'}
        </Button>
      </div>

      {/* 列表主体 */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6,
        overflow: 'hidden'
      }}>
        <Table
          columns={columns}
          dataSource={strategies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          className="binance-table"
          locale={{
            emptyText: (
              <div style={{ padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                  width: 64, 
                  height: 64, 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: 16
                }}>
                  <BulbOutlined style={{ fontSize: 24, color: 'var(--text-tertiary)' }} />
                </div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>暂无策略</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 24 }}>创建第一个策略模型</div>
                <Button 
                  type="primary" 
                  onClick={handleCreate} 
                  icon={<PlusOutlined />}
                  style={{ 
                    background: 'var(--color-brand)', 
                    borderColor: 'var(--color-brand)', 
                    color: 'var(--bg-primary)', 
                    fontWeight: 600,
                    borderRadius: 4
                  }}
                >
                  立即创建
                </Button>
              </div>
            )
          }}
        />
      </div>

      {/* 策略分类展示 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(8, 1fr)', 
        gap: isMobile ? 8 : 12 
      }}>
        {STRATEGY_CATEGORIES.map(cat => (
          <div 
            key={cat.value} 
            style={{ 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-primary)', 
              borderRadius: 6, 
              padding: isMobile ? 8 : 12, 
              textAlign: 'center',
              transition: 'all 0.2s',
              cursor: 'default'
            }}
          >
            <div style={{ color: 'var(--color-brand)', fontSize: isMobile ? 14 : 18, marginBottom: isMobile ? 2 : 4 }}>{cat.icon}</div>
            <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cat.label}</div>
          </div>
        ))}
      </div>

      {/* 策略表单弹窗 */}
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
              <ThunderboltOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingStrategy ? '更新策略' : '新建策略模型'}
            </span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={loading}
        width={isMobile ? '100vw' : 480}
        style={isMobile ? { top: 0, paddingBottom: 0, maxWidth: '100vw' } : undefined}
        destroyOnClose
        okText="保存"
        cancelText="取消"
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
        <Form form={form} layout="vertical" style={{ marginTop: isMobile ? 16 : 24 }}>
          <Row gutter={isMobile ? 8 : 16}>
            <Col span={isMobile ? 24 : 16}>
              <Form.Item
                name="name"
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>策略名称</span>}
                rules={[{ required: true, message: '必填' }]}
              >
                <Input 
                  placeholder="例如：趋势跟随" 
                  maxLength={20} 
                  style={{ 
                    background: 'var(--bg-tertiary)', 
                    borderColor: 'var(--border-primary)', 
                    color: 'var(--text-primary)',
                    borderRadius: 4
                  }} 
                />
              </Form.Item>
            </Col>
            <Col span={isMobile ? 24 : 8}>
              <Form.Item
                name="category"
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>策略类型</span>}
              >
                <Select>
                  {STRATEGY_CATEGORIES.map(cat => (
                    <Select.Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="color"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>颜色标识</span>}
          >
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center', 
              gap: isMobile ? 8 : 16, 
              background: 'var(--bg-tertiary)', 
              padding: isMobile ? 10 : 12, 
              borderRadius: 6 
            }}>
              <ColorPicker presets={[{ label: '调色板', colors: PRESET_COLORS }]} />
              <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--text-secondary)' }}>选择独特颜色，以便在交易记录中识别该策略。</div>
            </div>
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>执行规则/逻辑</span>}
          >
            <TextArea 
              rows={4} 
              placeholder="描述入场条件、出场规则与风控..."
              maxLength={500}
              showCount
              style={{ 
                background: 'var(--bg-tertiary)', 
                borderColor: 'var(--border-primary)', 
                color: 'var(--text-primary)',
                borderRadius: 4,
                fontSize: 13
              }}
            />
          </Form.Item>

          <div style={{ 
            marginTop: 24, 
            padding: 16, 
            background: 'var(--color-brand-bg)', 
            borderRadius: 8, 
            border: '1px solid var(--border-primary)' 
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>实时预览</div>
            <Form.Item noStyle shouldUpdate>
              {() => {
                const name = form.getFieldValue('name') || '策略名称';
                const color = form.getFieldValue('color');
                const colorValue = typeof color === 'string' ? color : color?.toHexString?.() || '#eab308';
                return (
                  <Tag style={{ 
                    backgroundColor: colorValue, 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 12, 
                    padding: '4px 16px',
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {name}
                  </Tag>
                );
              }}
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 关联订单抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {selectedStrategy && (
                <Tag 
                  style={{ 
                    backgroundColor: selectedStrategy.color, 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 12, 
                    padding: '2px 12px',
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  {selectedStrategy.name}
                </Tag>
              )}
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                ({strategyTrades.length})
              </span>
            </div>
            {strategyTrades.length > 0 && (
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  setDrawerVisible(false);
                  onNavigate && onNavigate('strategy-review', { strategyId: selectedStrategy?.id });
                }}
              >
                全部复盘
              </Button>
            )}
          </div>
        }
        placement="right"
        width={isMobile ? '100%' : 480}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        bodyStyle={{ padding: 0, background: 'var(--bg-primary)' }}
        headerStyle={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}
      >
        {tradesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spin />
          </div>
        ) : strategyTrades.length === 0 ? (
          <div style={{ padding: 48 }}>
            <Empty 
              description={
                <span style={{ color: 'var(--text-secondary)' }}>
                  暂无使用该策略的订单
                </span>
              } 
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* 统计摘要 */}
            <div style={{ 
              padding: 16, 
              background: 'var(--bg-secondary)', 
              borderBottom: '1px solid var(--border-primary)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>总盈亏</div>
                <div style={{ 
                  fontSize: 16, 
                  fontWeight: 700, 
                  fontFamily: 'var(--font-mono)',
                  color: strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                }}>
                  {strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) >= 0 ? '+' : ''}
                  ${strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>胜率</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {strategyTrades.length > 0 
                    ? ((strategyTrades.filter(t => getNetPnL(t) > 0).length / strategyTrades.length) * 100).toFixed(0) 
                    : 0}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>平均盈亏</div>
                <div style={{ 
                  fontSize: 16, 
                  fontWeight: 700, 
                  fontFamily: 'var(--font-mono)',
                  color: (strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) / strategyTrades.length) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                }}>
                  ${(strategyTrades.reduce((sum, t) => sum + getNetPnL(t), 0) / strategyTrades.length).toFixed(2)}
                </div>
              </div>
            </div>

            {/* 订单列表 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {strategyTrades.map((trade, index) => {
                const netPnL = getNetPnL(trade);
                const isProfit = netPnL >= 0;
                const hasReview = trade.reviewContent && trade.reviewContent !== '<p></p>';
                
                return (
                  <div 
                    key={trade.id || index}
                    style={{ 
                      margin: '8px 12px',
                      padding: '12px 16px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 8,
                      border: '1px solid var(--border-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleOpenReview(trade)}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--color-brand)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    {/* 头部：基本信息 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: hasReview ? 12 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: 6, 
                          background: isProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isProfit ? (
                            <RiseOutlined style={{ color: 'var(--color-profit)', fontSize: 14 }} />
                          ) : (
                            <FallOutlined style={{ color: 'var(--color-loss)', fontSize: 14 }} />
                          )}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                              {trade.instrumentCode}
                            </span>
                            <Tag style={{ 
                              fontSize: 9, 
                              padding: '0 5px', 
                              borderRadius: 2,
                              background: trade.direction === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                              color: trade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)',
                              border: 'none',
                              margin: 0
                            }}>
                              {trade.direction === 'LONG' ? '多' : '空'}
                            </Tag>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                            {dayjs(trade.openTime).format('YYYY-MM-DD HH:mm')}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          fontSize: 15, 
                          fontWeight: 700, 
                          fontFamily: 'var(--font-mono)',
                          color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)'
                        }}>
                          {isProfit ? '+' : ''}${netPnL.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          <CalendarOutlined /> 查看复盘
                        </div>
                      </div>
                    </div>
                    
                    {/* 复盘内容 */}
                    {hasReview && (
                      <div 
                        style={{ 
                          background: 'var(--bg-tertiary)', 
                          borderRadius: 6, 
                          padding: '10px 12px',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                          maxHeight: 100,
                          overflow: 'hidden'
                        }}
                        dangerouslySetInnerHTML={{ __html: trade.reviewContent }}
                      />
                    )}
                    
                    {/* 无复盘提示 */}
                    {!hasReview && (
                      <div style={{ 
                        fontSize: 11, 
                        color: 'var(--text-tertiary)', 
                        fontStyle: 'italic',
                        marginTop: 8 
                      }}>
                        暂无复盘记录，点击添加
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Drawer>

      {/* 复盘编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16 }}>📝</span>
            <span>编辑复盘</span>
            {editingTrade && (
              <Tag color={getNetPnL(editingTrade) >= 0 ? 'success' : 'error'}>
                {getNetPnL(editingTrade) >= 0 ? '+' : ''}${getNetPnL(editingTrade).toFixed(2)}
              </Tag>
            )}
          </div>
        }
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleSaveReview}
        confirmLoading={savingReview}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        {editingTrade && (
          <div>
            {/* 交易基本信息 */}
            <div style={{ 
              padding: 12, 
              background: 'var(--bg-secondary)', 
              borderRadius: 8, 
              marginBottom: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              fontSize: 12
            }}>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>品种</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editingTrade.instrument}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>方向</div>
                <div style={{ 
                  fontWeight: 600, 
                  color: editingTrade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)' 
                }}>
                  {editingTrade.direction === 'LONG' ? '做多' : '做空'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>时间</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {dayjs(editingTrade.openTime).format('MM/DD HH:mm')}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>盈亏</div>
                <div style={{ 
                  fontWeight: 600, 
                  color: getNetPnL(editingTrade) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
                }}>
                  {getNetPnL(editingTrade) >= 0 ? '+' : ''}${getNetPnL(editingTrade).toFixed(2)}
                </div>
              </div>
            </div>

            <RichEditor
              value={reviewContent}
              onChange={setReviewContent}
              placeholder="记录你的交易复盘..."
              minHeight={200}
              maxHeight={350}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TradingStrategies;
