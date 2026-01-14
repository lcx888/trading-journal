import { useState, useEffect } from 'react';
import { 
  Card, Form, Input, InputNumber, Button, Table, Space, 
  message, Modal, Popconfirm, Divider, Statistic, Row, Col, Tag, Typography, Empty
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  ArrowRightOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import { isUSDaylightSavingTime, isEUDaylightSavingTime, formatCSTTime } from '../utils/timezone';
import { fixHoldingTimes } from '../utils/debugHoldingTime';

const { Text } = Typography;
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

const Settings = () => {
  const [instruments, setInstruments] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState(null);
  const [form] = Form.useForm();
  const [dataStats, setDataStats] = useState({ trades: 0, imports: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instrumentList, history, trades] = await Promise.all([
        StorageService.getInstruments(),
        StorageService.getImportHistory(),
        StorageService.getAllTrades(),
      ]);
      setInstruments(instrumentList);
      setImportHistory(history);
      setDataStats({
        trades: trades.length,
        imports: history.length,
      });
    } catch (error) {
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstrument = () => {
    setEditingInstrument(null);
    form.resetFields();
    setEditModalVisible(true);
  };

  const handleEditInstrument = (instrument) => {
    setEditingInstrument(instrument);
    form.setFieldsValue(instrument);
    setEditModalVisible(true);
  };

  const handleSaveInstrument = async () => {
    try {
      const values = await form.validateFields();
      let newInstruments;
      if (editingInstrument) {
        newInstruments = instruments.map(i => i.code === editingInstrument.code ? { ...i, ...values } : i);
      } else {
        if (instruments.some(i => i.code === values.code)) {
          message.error('品种代码已存在');
          return;
        }
        newInstruments = [...instruments, values];
      }
      await StorageService.saveInstruments(newInstruments);
      setInstruments(newInstruments);
      setEditModalVisible(false);
      message.success('配置已保存');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteInstrument = async (code) => {
    const newInstruments = instruments.filter(i => i.code !== code);
    await StorageService.saveInstruments(newInstruments);
    setInstruments(newInstruments);
    message.success('配置已删除');
  };

  const handleClearAllData = () => {
    Modal.confirm({
      title: '清除所有数据？',
      icon: <ExclamationCircleOutlined className="text-red-500" />,
      content: '将永久删除所有交易记录与导入历史，且无法恢复。',
      okText: '永久清除',
      okType: 'danger',
      cancelText: '取消',
      className: 'trading-view-modal',
      onOk: async () => {
        await StorageService.clearAllTrades();
        message.success('本地数据已清空');
        loadData();
      },
    });
  };

  const handleFixHoldingTimes = async () => {
    Modal.confirm({
      title: '修复数据结构',
      icon: <ToolOutlined className="text-blue-500" />,
      content: '是否基于成交时间重新计算所有交易的持仓时长？',
      okText: '执行修复',
      cancelText: '取消',
      className: 'trading-view-modal',
      onOk: async () => {
        try {
          const result = await fixHoldingTimes();
          if (result.success) {
            message.success(result.message);
            loadData();
          } else {
            message.error(result.message);
          }
        } catch (error) {
          message.error(`修复失败：${error.message}`);
        }
      },
    });
  };


  const instrumentColumns = [
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">代码</span>,
      dataIndex: 'code',
      key: 'code',
      render: (c) => <Tag className="rounded bg-blue-50 text-blue-600 border-none font-bold text-[11px] px-2">{c}</Tag>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">名称</span>,
      dataIndex: 'name',
      key: 'name',
      render: (n) => <span className="font-bold text-[#131722] text-xs">{n}</span>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">手续费</span>,
      dataIndex: 'feeRate',
      key: 'feeRate',
      render: (r) => <span className="font-mono text-[11px]">${r}</span>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">每跳价值</span>,
      dataIndex: 'tickValue',
      key: 'tickValue',
      render: (v) => <span className="font-mono text-[11px]">${v}</span>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ATAS 匹配</span>,
      dataIndex: 'atasPattern',
      key: 'atasPattern',
      render: (p) => <code className="text-[9px] bg-slate-50 text-slate-400 px-1 rounded">{p}</code>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">操作</span>,
      key: 'action',
      align: 'right',
      render: (_, r) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} className="text-slate-300 hover:text-blue-500" onClick={() => handleEditInstrument(r)} />
          <Popconfirm title="删除品种？" onConfirm={() => handleDeleteInstrument(r.code)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} className="opacity-40 hover:opacity-100" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">导入时间</span>,
      dataIndex: 'importDate',
      key: 'importDate',
      render: (d) => <div className="text-[11px] font-medium text-slate-500">{dayjs(d).format('MM/DD HH:mm')}</div>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">源文件</span>,
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
      render: (f) => <span className="text-[11px] font-bold text-slate-700">{f}</span>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">数量</span>,
      dataIndex: 'tradesCount',
      key: 'tradesCount',
      align: 'center',
      render: (c) => <div className="text-[11px] font-mono">{c}</div>,
    },
    {
      title: <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">盈亏（美元）</span>,
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      align: 'right',
      render: (p) => (
        <span className={`font-mono font-bold text-[11px] ${p >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
          {p >= 0 ? '+' : ''}{p?.toFixed(2)}
        </span>
      ),
    },
  ];

  const now = new Date();
  const isUSDST = isUSDaylightSavingTime(now);
  const isEUDST = isEUDaylightSavingTime(now);

  return (
    <div className="space-y-6 animate-in">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16} className="space-y-6">
          {/* Instruments Config */}
          <div className="modern-card bg-white p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <GlobalOutlined className="text-blue-500" />
                <span className="font-bold text-[#131722] tracking-tight">品种配置</span>
              </div>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddInstrument} className="font-bold text-[10px] uppercase shadow-none px-4">新增品种</Button>
            </div>
            <Table
              columns={instrumentColumns}
              dataSource={instruments}
              rowKey="code"
              loading={loading}
              pagination={false}
              size="small"
              className="modern-table"
            />
          </div>

          {/* Import History */}
          <div className="modern-card bg-white p-6">
            <div className="flex items-center gap-2 mb-6">
              <HistoryOutlined className="text-[#26a69a]" />
              <span className="font-bold text-[#131722] tracking-tight">导入记录</span>
            </div>
            <Table
              columns={historyColumns}
              dataSource={importHistory}
              rowKey={(record) => `${record.importDate}-${record.filename}`}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              size="small"
              className="modern-table"
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无导入记录" /> }}
            />
          </div>
        </Col>

        <Col xs={24} lg={8} className="space-y-6">
          {/* Timezone Info Terminal Style */}
          <div className="modern-card bg-[#131722] p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <ClockCircleOutlined style={{ fontSize: '100px' }} />
            </div>
            <div className="relative z-10">
              <div className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">环境信息</div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-slate-400 text-xs font-medium">核心时区</span>
                  <span className="text-xs font-mono font-bold">UTC+8 (CST)</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-slate-400 text-xs font-medium">本地时间</span>
                  <span className="text-xs font-mono font-bold text-blue-400">{formatCSTTime(now, true)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-slate-400 text-xs font-medium">美东夏令时</span>
                  <Tag className={`rounded border-none text-[9px] font-black ${isUSDST ? 'bg-[#26a69a] text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {isUSDST ? '生效' : '未生效'}
                  </Tag>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-medium">欧洲夏令时</span>
                  <Tag className={`rounded border-none text-[9px] font-black ${isEUDST ? 'bg-[#26a69a] text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {isEUDST ? '生效' : '未生效'}
                  </Tag>
                </div>
              </div>

              <div className="mt-6 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 text-blue-400 text-[9px] font-bold uppercase mb-1">
                  <InfoCircleOutlined /> 自动校正
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  系统会将 ATAS（UTC+0）自动转换为本地 CST，并根据全球夏令时自动调整交易时段。
                </div>
              </div>
            </div>
          </div>

          {/* Stats Widgets */}
          <div className="modern-card bg-white p-5">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">数据库统计</div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold stat-value text-[#131722]">{dataStats.trades}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">交易记录</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold stat-value text-[#131722]">{dataStats.imports}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">导入次数</div>
              </div>
            </div>
          </div>

          {/* Maintenance Actions */}
          <div className="modern-card bg-white p-6">
            <div className="flex items-center gap-2 mb-6">
              <SafetyCertificateOutlined className="text-blue-500" />
              <span className="font-bold text-[#131722] tracking-tight">系统维护</span>
            </div>
            <div className="space-y-3">
              <Button block className="h-10 text-left px-4 group hover:border-blue-400 rounded-lg transition-all" onClick={handleFixHoldingTimes}>
                <div className="flex justify-between items-center w-full">
                  <div>
                    <div className="text-xs font-bold text-[#131722]">修复持仓时长</div>
                    <div className="text-[9px] text-slate-400 font-medium">重新计算持仓时间</div>
                  </div>
                  <ArrowRightOutlined className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </div>
              </Button>
              <Button block danger className="h-10 text-left px-4 group rounded-lg" onClick={handleClearAllData}>
                <div className="flex justify-between items-center w-full">
                  <div>
                    <div className="text-xs font-bold">数据清空</div>
                    <div className="text-[9px] opacity-60 font-medium">清空本地存储</div>
                  </div>
                  <DeleteOutlined className="opacity-40 group-hover:opacity-100 transition-all" />
                </div>
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Edit Modal */}
      <Modal
        title={<div className="flex items-center gap-2 py-2"><EditOutlined className="text-blue-500" /><span className="text-lg font-bold">{editingInstrument ? '更新品种' : '新增品种'}</span></div>}
        open={editModalVisible}
        onOk={handleSaveInstrument}
        onCancel={() => setEditModalVisible(false)}
        okText="确认保存"
        cancelText="取消"
        width={480}
        destroyOnClose
        className="trading-view-modal"
      >
        <Form form={form} layout="vertical" className="mt-6">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">品种代码</span>} rules={[{ required: true }]}>
                <Input placeholder="例如：ES、NQ、GC" disabled={!!editingInstrument} className="font-bold font-mono" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">品种名称</span>} rules={[{ required: true }]}>
                <Input placeholder="例如：标普500期货" className="font-medium" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="feeRate" label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">手续费/边 ($)</span>} rules={[{ required: true }]}>
                <InputNumber min={0} step={0.01} className="w-full font-mono" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tickValue" label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">每跳价值 ($)</span>} rules={[{ required: true }]}>
                <InputNumber min={0} step={0.1} className="w-full font-mono" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="initialCapital" label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">初始资金 ($)</span>} rules={[{ required: true }]}>
            <InputNumber min={0} step={1000} className="w-full font-mono" />
          </Form.Item>
          <Form.Item name="atasPattern" label={<span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">ATAS 正则匹配</span>}>
            <Input placeholder="例如：GC.*@NYMEX" className="font-mono text-xs" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;
