import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  Popconfirm, message, Empty, Row, Col, Statistic, ColorPicker,
  Typography, Badge, Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  TagOutlined,
  BookOutlined,
  FireOutlined,
  ThunderboltOutlined,
  AimOutlined,
  RocketOutlined,
  SafetyOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// TradingView Style Colors
const TV_COLORS = [
  '#2962ff', '#26a69a', '#ef5350', '#ff9800', '#722ed1',
  '#131722', '#787b86', '#e0e3eb', '#f0f3fa', '#ffffff'
];

// 预设颜色（TradingView 调色板扩展）
const PRESET_COLORS = [
  '#2962ff', '#26a69a', '#ef5350', '#ff9800', '#722ed1',
  '#131722', '#00bcd4', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff5722', '#795548', '#9e9e9e'
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

  useEffect(() => {
    loadStrategies();
  }, []);

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
        : values.color?.toHexString?.() || TV_COLORS[0];

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
      title: <span className="uppercase tracking-widest text-[10px] font-bold">策略模型</span>,
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: record.color }}
          >
            {getCategoryIcon(record.category)}
          </div>
          <div>
            <div className="text-[#131722] font-bold text-sm leading-tight">{name}</div>
            <div className="text-[#787b86] text-[10px] font-bold uppercase tracking-widest mt-0.5">
              {record.category} 系统
            </div>
          </div>
        </div>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">标签预览</span>,
      dataIndex: 'color',
      key: 'preview',
      width: 140,
      render: (color, record) => (
        <Tag 
          color={color}
          bordered={false}
          className="px-3 py-1 text-[11px] font-bold rounded-full border-none"
        >
          {record.name}
        </Tag>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">描述</span>,
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => (
        <Tooltip title={desc}>
          <span className="text-[#787b86] text-xs">
            {desc || '--'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">使用次数</span>,
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.usageCount || 0) - (b.usageCount || 0),
      render: (count) => (
        <div className="flex flex-col items-center">
          <div className="text-[#131722] font-bold text-sm">{count || 0}</div>
          <div className="text-[9px] text-[#787b86] font-bold uppercase tracking-tighter">次</div>
        </div>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">操作</span>,
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            size="small"
            className="text-blue-500 hover:bg-blue-50"
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="删除策略？"
            description="使用该策略的交易将移除标签。"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            className="modern-card"
          >
            <Button type="text" size="small" danger className="hover:bg-red-50" icon={<DeleteOutlined />} />
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
    <div className="space-y-6 animate-in">
      {/* 顶部统计区 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <div className="modern-card p-5 bg-white">
            <div className="text-[#787b86] text-[10px] font-bold uppercase tracking-widest mb-2">策略总数</div>
            <div className="text-2xl font-bold stat-value text-[#131722]">{totalStrategies}</div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-blue-500 uppercase tracking-tighter">
              <BulbOutlined className="mr-1" /> 活跃库
            </div>
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="modern-card p-5 bg-white">
            <div className="text-[#787b86] text-[10px] font-bold uppercase tracking-widest mb-2">累计使用</div>
            <div className="text-2xl font-bold stat-value text-[#131722]">{totalUsage}</div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-[#26a69a] uppercase tracking-tighter">
              <BarChartOutlined className="mr-1" /> 数据样本
            </div>
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="modern-card p-5 bg-white">
            <div className="text-[#787b86] text-[10px] font-bold uppercase tracking-widest mb-2">最常用</div>
            <div className="text-xl font-bold text-[#2962ff] truncate">
              {mostUsed?.name || '暂无'}
            </div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-amber-500 uppercase tracking-tighter">
              <FireOutlined className="mr-1" /> 使用最高
            </div>
          </div>
        </Col>
      </Row>

      {/* 列表控制栏 */}
      <div className="flex justify-between items-center px-4 py-2 bg-white rounded-xl border border-[#e0e3eb]">
        <div className="flex items-center gap-2">
          <BookOutlined className="text-blue-500" />
          <span className="font-bold text-sm text-[#131722]">策略库</span>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          className="shadow-sm font-bold text-xs"
          size="middle"
        >
          新建策略
        </Button>
      </div>

      {/* 列表主体 */}
      <div className="modern-card bg-white p-2">
        <Table
          columns={columns}
          dataSource={strategies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          className="modern-table"
          locale={{
            emptyText: (
              <div className="py-20 flex flex-col items-center">
                <div className="w-16 h-16 bg-[#f0f3fa] rounded-full flex items-center justify-center mb-4">
                  <BulbOutlined className="text-2xl text-blue-300" />
                </div>
                <div className="text-[#131722] font-bold">暂无策略</div>
                <div className="text-[#787b86] text-xs mt-1 mb-4">创建第一个策略模型。</div>
                <Button type="primary" size="middle" onClick={handleCreate} icon={<PlusOutlined />}>
                  立即创建
                </Button>
              </div>
            )
          }}
        />
      </div>

      {/* 说明区 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {STRATEGY_CATEGORIES.map(cat => (
          <div key={cat.value} className="modern-card bg-white p-3 text-center hover:bg-[#f8f9fd] transition-colors cursor-default">
            <div className="text-blue-500 text-lg mb-1">{cat.icon}</div>
            <div className="text-[10px] font-bold text-[#131722] uppercase tracking-tighter">{cat.label}</div>
          </div>
        ))}
      </div>

      {/* 策略表单弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-2 py-2">
            <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center">
              <EditOutlined className="text-blue-500" />
            </div>
            <span className="text-lg font-bold">{editingStrategy ? '更新策略' : '新建策略模型'}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={loading}
        width={480}
        destroyOnClose
        okText="保存"
        cancelText="取消"
        className="trading-view-modal"
      >
        <Form form={form} layout="vertical" className="mt-4 px-2">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label={<span className="text-[10px] font-bold uppercase text-[#787b86]">策略名称</span>}
                rules={[{ required: true, message: '必填' }]}
              >
                <Input placeholder="例如：趋势跟随" maxLength={20} className="font-bold" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="category"
                label={<span className="text-[10px] font-bold uppercase text-[#787b86]">策略类型</span>}
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
            label={<span className="text-[10px] font-bold uppercase text-[#787b86]">颜色标识</span>}
          >
            <div className="flex items-center gap-4 bg-[#f8f9fd] p-3 rounded-lg">
              <ColorPicker presets={[{ label: 'TV 调色板', colors: PRESET_COLORS }]} />
              <div className="text-[10px] font-medium text-[#787b86]">选择独特颜色，以便在交易记录中识别该策略。</div>
            </div>
          </Form.Item>

          <Form.Item
            name="description"
            label={<span className="text-[10px] font-bold uppercase text-[#787b86]">执行规则/逻辑</span>}
          >
            <TextArea 
              rows={4} 
              placeholder="描述入场条件、出场规则与风控..."
              maxLength={500}
              showCount
              className="text-xs"
            />
          </Form.Item>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">实时预览</div>
            <Form.Item noStyle shouldUpdate>
              {() => {
                const name = form.getFieldValue('name') || '策略名称';
                const color = form.getFieldValue('color');
                const colorValue = typeof color === 'string' ? color : color?.toHexString?.() || '#2962ff';
                return (
                  <Tag color={colorValue} className="px-4 py-1 font-bold rounded-full border-none">
                    {name}
                  </Tag>
                );
              }}
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default TradingStrategies;
