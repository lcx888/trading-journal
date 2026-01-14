import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Tag, Space, Popconfirm,
  message, Empty, Statistic, Row, Col, Typography, Tooltip, Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RiseOutlined,
  FallOutlined,
  HistoryOutlined,
  BookOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';

const { Title, Text, Paragraph } = Typography;
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

const TradingRecords = ({ onNavigateToImport }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const allRecords = await StorageService.getAllRecords();
      for (const record of allRecords) {
        await StorageService.refreshRecordStats(record.id);
      }
      const updatedRecords = await StorageService.getAllRecords();
      setRecords(updatedRecords);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await StorageService.updateRecord(editingRecord.id, values);
        message.success('账本更新成功');
      } else {
        await StorageService.createRecord(values);
        message.success('新账本已创建');
      }
      setModalVisible(false);
      loadRecords();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (recordId) => {
    try {
      await StorageService.deleteRecord(recordId);
      message.success('账本已删除');
      loadRecords();
    } catch (error) {
      console.error(error);
    }
  };

  const handleImport = (record) => {
    if (onNavigateToImport) {
      onNavigateToImport(record.id);
    }
  };

  const columns = [
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">状态</span>,
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        status === 'active' 
          ? <Tag color="success" className="rounded-full border-none px-3 py-0.5 text-[10px] font-bold">启用</Tag>
          : <Tag className="rounded-full border-none px-3 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-400">已归档</Tag>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">账本名称</span>,
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex flex-col">
          <div className="font-bold text-[#131722] text-sm flex items-center gap-2">
            <FolderOpenOutlined className="text-[#2962ff]" />
            {name}
          </div>
          {record.description && (
            <div className="text-[#787b86] text-xs mt-0.5 truncate max-w-[300px]">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">交易笔数</span>,
      dataIndex: 'tradeCount',
      key: 'tradeCount',
      width: 120,
      align: 'center',
      render: (count) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#131722]">{count || 0}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">样本</span>
        </div>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">净盈亏</span>,
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      width: 160,
      align: 'right',
      render: (pnl) => (
        <div className="flex flex-col items-end">
          <span className={`font-bold text-sm ${pnl >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
            {pnl >= 0 ? '+' : ''}{pnl?.toLocaleString() || '0.00'}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase">美元</span>
        </div>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">胜率</span>,
      dataIndex: 'winRate',
      key: 'winRate',
      width: 100,
      align: 'center',
      render: (rate) => (
        <div className="flex flex-col items-center">
          <span className={`font-bold text-sm ${rate >= 50 ? 'text-[#26a69a]' : 'text-[#ff9800]'}`}>
            {rate || 0}%
          </span>
          <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-[#26a69a]" style={{ width: `${rate || 0}%` }} />
          </div>
        </div>
      ),
    },
    {
      title: <span className="uppercase tracking-widest text-[10px] font-bold">操作</span>,
      key: 'actions',
      width: 180,
      align: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            size="small" 
            icon={<ImportOutlined />}
            onClick={() => handleImport(record)}
            className="text-[10px] font-bold rounded-lg shadow-none"
          >
            导入
          </Button>
          <Button 
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-slate-400 hover:text-blue-500"
          />
          <Popconfirm
            title="删除账本？"
            description="该账本内所有交易数据将被永久删除。"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, size: 'small', className: 'text-[10px] font-bold' }}
            cancelButtonProps={{ size: 'small', className: 'text-[10px] font-bold' }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} className="opacity-40 hover:opacity-100" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalStats = {
    totalRecords: records.length,
    activeRecords: records.filter(r => r.status === 'active').length,
    totalTrades: records.reduce((sum, r) => sum + (r.tradeCount || 0), 0),
    totalPnL: records.reduce((sum, r) => sum + (r.totalPnL || 0), 0),
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Top Summary Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="modern-card p-5 bg-white">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">账本总数</div>
            <div className="text-2xl font-bold stat-value text-[#131722]">{totalStats.totalRecords}</div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-blue-500">
              <FolderOutlined className="mr-1" /> 数据仓库
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="modern-card p-5 bg-white">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">活跃账本</div>
            <div className="text-2xl font-bold stat-value text-[#131722]">{totalStats.activeRecords}</div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-[#26a69a]">
              <CheckCircleOutlined className="mr-1" /> 运行中
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="modern-card p-5 bg-white">
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">总样本数</div>
            <div className="text-2xl font-bold stat-value text-[#131722]">{totalStats.totalTrades}</div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-slate-400">
              <HistoryOutlined className="mr-1" /> 累计规模
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className={`modern-card p-5 bg-white border-l-4 ${totalStats.totalPnL >= 0 ? 'border-[#26a69a]' : 'border-[#ef5350]'}`}>
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">汇总盈亏</div>
            <div className={`text-2xl font-bold stat-value ${totalStats.totalPnL >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
              {totalStats.totalPnL >= 0 ? '+' : ''}{totalStats.totalPnL?.toLocaleString()}
              <span className="text-[10px] font-normal opacity-60 ml-1">美元</span>
            </div>
            <div className="mt-2 flex items-center text-[10px] font-bold text-slate-400">
              {totalStats.totalPnL >= 0 ? <RiseOutlined className="mr-1" /> : <FallOutlined className="mr-1" />} 
              整体表现
            </div>
          </div>
        </Col>
      </Row>

      {/* Control Bar */}
      <div className="flex justify-between items-center px-6 py-3 bg-white rounded-xl border border-[#e0e3eb]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center">
            <BookOutlined className="text-blue-500" />
          </div>
          <span className="font-bold text-sm text-[#131722] tracking-tight">账本管理</span>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreate}
          className="font-bold text-xs shadow-none px-6"
        >
          新建账本
        </Button>
      </div>

      {/* Main Table Area */}
      <div className="modern-card bg-white p-2">
        {records.length === 0 && !loading ? (
          <div className="py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <FolderOutlined className="text-2xl text-slate-300" />
            </div>
            <div className="text-[#131722] font-bold">暂无交易账本</div>
            <div className="text-[#787b86] text-xs mt-1 mb-6 text-center max-w-[200px]">创建第一个账本以开始导入和分析交易数据。</div>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} className="font-bold text-xs px-8">
              立即创建
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={records}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              hideOnSinglePage: true,
              showTotal: (total) => <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">账本数量：{total}</span>,
            }}
            className="modern-table"
          />
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center">
              <FolderOpenOutlined className="text-blue-500" />
            </div>
            <span className="text-lg font-bold text-[#131722]">{editingRecord ? '更新账本' : '新建账本'}</span>
          </div>
        }
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="确认保存"
        cancelText="取消"
        width={480}
        destroyOnClose
        className="trading-view-modal"
      >
        <Form form={form} layout="vertical" className="mt-6 px-2">
          <Form.Item
            name="name"
            label={<span className="text-[10px] font-bold uppercase text-[#787b86] tracking-widest">账本名称</span>}
            rules={[{ required: true, message: '请输入账本名称' }]}
          >
            <Input placeholder="例如：2026 Q1 资金挑战" className="font-bold" />
          </Form.Item>
          <Form.Item
            name="description"
            label={<span className="text-[10px] font-bold uppercase text-[#787b86] tracking-widest">备注（可选）</span>}
          >
            <TextArea 
              placeholder="说明交易环境、账户类型或目标等..." 
              rows={4}
              maxLength={200}
              showCount
              className="text-xs"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TradingRecords;
