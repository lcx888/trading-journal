import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space,
  Popconfirm, message, Row, Col, ColorPicker, Tooltip, Drawer, Spin, Empty
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
  RightOutlined,
  CloseOutlined,
  SaveOutlined,
  FileTextOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';

const { TextArea } = Input;

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

const TradingStrategies = () => {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [form] = Form.useForm();
  
  // 策略详情抽屉状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [strategyTrades, setStrategyTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [editingReflection, setEditingReflection] = useState(null); // { tradeId, text }
  const [savingReflection, setSavingReflection] = useState(false);
  
  // 移动端检测
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadStrategies();
  }, []);
  
  // 打开策略详情
  const openStrategyDetail = async (strategy) => {
    setSelectedStrategy(strategy);
    setDrawerVisible(true);
    setTradesLoading(true);
    try {
      const trades = await StorageService.getStrategyTrades(strategy.id);
      setStrategyTrades(trades);
    } catch (error) {
      console.error('加载策略交易失败:', error);
      message.error('加载交易列表失败');
    } finally {
      setTradesLoading(false);
    }
  };
  
  // 保存交易反思
  const saveReflection = async () => {
    if (!editingReflection) return;
    setSavingReflection(true);
    try {
      await StorageService.updateTradeReflection(editingReflection.tradeId, editingReflection.text);
      // 更新本地状态
      setStrategyTrades(prev => prev.map(t => 
        t.id === editingReflection.tradeId 
          ? { ...t, reflection: editingReflection.text } 
          : t
      ));
      message.success('反思已保存');
      setEditingReflection(null);
    } catch (error) {
      console.error('保存反思失败:', error);
      message.error('保存失败');
    } finally {
      setSavingReflection(false);
    }
  };
  
  // 计算策略统计
  const strategyStats = strategyTrades.length > 0 ? {
    totalTrades: strategyTrades.length,
    totalPnL: strategyTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    winCount: strategyTrades.filter(t => (t.pnl || 0) > 0).length,
    winRate: (strategyTrades.filter(t => (t.pnl || 0) > 0).length / strategyTrades.length * 100).toFixed(0),
    reflectionCount: strategyTrades.filter(t => t.reflection).length,
  } : null;

  const loadStrategies = async () => {
    setLoading(true);
    try {
      const updatedStrategies = await StorageService.refreshStrategyUsageCounts();
      setStrategies(updatedStrategies);
    } catch (error) {
      console.error('加载策略失败:', error);
      message.error('加载策略失败');
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
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => openStrategyDetail(record)}
        >
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
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{name}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
              {record.category} 系统
            </div>
          </div>
          <RightOutlined style={{ color: 'var(--text-tertiary)', fontSize: 10 }} />
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
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
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
      
      {/* 策略详情抽屉 */}
      <Drawer
        title={null}
        placement="right"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedStrategy(null);
          setStrategyTrades([]);
          setEditingReflection(null);
        }}
        width={isMobile ? '100%' : 560}
        closable={false}
        styles={{ body: { padding: 0, background: 'var(--bg-primary)' } }}
      >
        {selectedStrategy && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 抽屉头部 */}
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 10, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: selectedStrategy.color,
                  color: '#fff',
                  fontSize: 18
                }}>
                  {getCategoryIcon(selectedStrategy.category)}
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>
                    {selectedStrategy.name}
                  </div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 2 }}>
                    {selectedStrategy.category} 系统 · {selectedStrategy.usageCount || 0} 笔交易
                  </div>
                </div>
              </div>
              <Button 
                type="text" 
                icon={<CloseOutlined />} 
                onClick={() => setDrawerVisible(false)}
                style={{ color: 'var(--text-tertiary)' }}
              />
            </div>
            
            {/* 策略描述 */}
            {selectedStrategy.description && (
              <div style={{ 
                padding: '16px 24px', 
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-primary)',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  策略规则
                </div>
                {selectedStrategy.description}
              </div>
            )}
            
            {/* 统计卡片 */}
            {strategyStats && (
              <div style={{ 
                padding: '16px 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                borderBottom: '1px solid var(--border-primary)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>总盈亏</div>
                  <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    fontFamily: 'var(--font-mono)',
                    color: strategyStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                  }}>
                    {strategyStats.totalPnL >= 0 ? '+' : ''}{strategyStats.totalPnL.toFixed(0)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>胜率</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {strategyStats.winRate}%
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>交易数</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {strategyStats.totalTrades}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>已反思</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-brand)' }}>
                    {strategyStats.reflectionCount}
                  </div>
                </div>
              </div>
            )}
            
            {/* 交易列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
              <div style={{ 
                padding: '12px 24px', 
                fontSize: 10, 
                fontWeight: 600, 
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-primary)',
                position: 'sticky',
                top: 0,
                background: 'var(--bg-primary)',
                zIndex: 1
              }}>
                关联交易 · 点击添加反思
              </div>
              
              {tradesLoading ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Spin />
                </div>
              ) : strategyTrades.length === 0 ? (
                <div style={{ padding: 40 }}>
                  <Empty description="暂无使用此策略的交易" />
                </div>
              ) : (
                <div>
                  {strategyTrades.map((trade, index) => (
                    <div 
                      key={trade.id}
                      style={{ 
                        padding: '16px 24px',
                        borderBottom: '1px solid var(--border-primary)',
                        background: editingReflection?.tradeId === trade.id ? 'var(--bg-secondary)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* 交易信息行 */}
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          if (editingReflection?.tradeId === trade.id) {
                            setEditingReflection(null);
                          } else {
                            setEditingReflection({ tradeId: trade.id, text: trade.reflection || '' });
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: 8, 
                            background: (trade.pnl || 0) >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {(trade.pnl || 0) >= 0 
                              ? <RiseOutlined style={{ color: 'var(--color-profit)' }} />
                              : <FallOutlined style={{ color: 'var(--color-loss)' }} />
                            }
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                                {trade.instrumentCode || 'N/A'}
                              </span>
                              <span style={{ 
                                fontSize: 10, 
                                padding: '1px 6px', 
                                borderRadius: 4,
                                background: trade.direction === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                color: trade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)',
                                fontWeight: 600
                              }}>
                                {trade.direction === 'LONG' ? '多' : '空'}
                              </span>
                              {trade.reflection && (
                                <FileTextOutlined style={{ color: 'var(--color-brand)', fontSize: 12 }} />
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {trade.openTime ? dayjs(trade.openTime).format('MM-DD HH:mm') : '--'}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontWeight: 700, 
                            fontSize: 14,
                            color: (trade.pnl || 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                          }}>
                            {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      {/* 反思编辑区域 */}
                      {editingReflection?.tradeId === trade.id && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-primary)' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand)', marginBottom: 8, textTransform: 'uppercase' }}>
                            交易反思
                          </div>
                          <Input.TextArea
                            value={editingReflection.text}
                            onChange={e => setEditingReflection({ ...editingReflection, text: e.target.value })}
                            placeholder="记录这笔交易的入场逻辑、执行情况、经验教训..."
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            style={{ 
                              background: 'var(--bg-tertiary)', 
                              borderColor: 'var(--border-primary)',
                              borderRadius: 8,
                              fontSize: 13
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            <Button 
                              size="small" 
                              onClick={() => setEditingReflection(null)}
                              style={{ fontSize: 11 }}
                            >
                              取消
                            </Button>
                            <Button 
                              type="primary" 
                              size="small"
                              icon={<SaveOutlined />}
                              loading={savingReflection}
                              onClick={saveReflection}
                              style={{ 
                                background: 'var(--color-brand)', 
                                borderColor: 'var(--color-brand)',
                                color: '#000',
                                fontWeight: 600,
                                fontSize: 11
                              }}
                            >
                              保存
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* 已保存的反思预览（非编辑状态） */}
                      {trade.reflection && editingReflection?.tradeId !== trade.id && (
                        <div style={{ 
                          marginTop: 10, 
                          padding: '10px 12px', 
                          background: 'rgba(212, 175, 55, 0.05)',
                          borderRadius: 6,
                          borderLeft: '3px solid var(--color-brand)',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5
                        }}>
                          {trade.reflection}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* 策略反思汇总 */}
            {strategyStats && strategyStats.reflectionCount > 0 && (
              <div style={{ 
                padding: '16px 24px',
                borderTop: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)'
              }}>
                <div style={{ 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: 'var(--color-brand)', 
                  marginBottom: 8,
                  textTransform: 'uppercase'
                }}>
                  策略知识库 · {strategyStats.reflectionCount} 条反思
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  点击上方交易查看或编辑反思内容
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default TradingStrategies;
