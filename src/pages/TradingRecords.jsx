import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Tag, Space, Popconfirm,
  message, Row, Col
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined,
  HistoryOutlined,
  BookOutlined,
} from '@ant-design/icons';
import StorageService from '../services/storage';

const { TextArea } = Input;

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
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>状态</span>,
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => (
        status === 'active' 
          ? <Tag style={{ background: 'var(--color-profit-bg)', color: 'var(--color-profit)', border: 'none', borderRadius: 2, fontSize: 10, fontWeight: 600, padding: '2px 8px' }}>启用</Tag>
          : <Tag style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', border: 'none', borderRadius: 2, fontSize: 10, fontWeight: 600, padding: '2px 8px' }}>归档</Tag>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>账本名称</span>,
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderOpenOutlined style={{ color: 'var(--color-brand)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{name}</span>
          </div>
          {record.description && (
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 22, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{record.description}</span>
          )}
        </div>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>交易数</span>,
      dataIndex: 'tradeCount',
      key: 'tradeCount',
      width: 100,
      align: 'center',
      render: (count) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{count || 0}</span>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>净盈亏</span>,
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      width: 140,
      align: 'right',
      render: (pnl) => (
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontWeight: 700, 
          fontSize: 14,
          color: pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
        }}>
            {pnl >= 0 ? '+' : ''}{pnl?.toLocaleString() || '0.00'}
          </span>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>胜率</span>,
      dataIndex: 'winRate',
      key: 'winRate',
      width: 100,
      align: 'center',
      render: (rate) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ 
            fontFamily: 'var(--font-mono)', 
            fontWeight: 600, 
            fontSize: 14,
            color: rate >= 50 ? 'var(--color-profit)' : 'var(--color-brand)' 
          }}>
            {rate || 0}%
          </span>
          <div style={{ width: 48, height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: rate >= 50 ? 'var(--color-profit)' : 'var(--color-brand)', width: `${rate || 0}%` }} />
          </div>
        </div>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>操作</span>,
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="primary" 
            size="small" 
            icon={<ImportOutlined />}
            onClick={() => handleImport(record)}
            style={{ 
              background: 'var(--color-brand)', 
              borderColor: 'var(--color-brand)', 
              color: 'var(--bg-primary)', 
              fontWeight: 600, 
              fontSize: 10,
              borderRadius: 4 
            }}
          >
            导入
          </Button>
          <Button 
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ color: 'var(--text-tertiary)' }}
          />
          <Popconfirm
            title={<span style={{ color: 'var(--text-primary)' }}>删除账本？</span>}
            description={<span style={{ color: 'var(--text-secondary)' }}>该账本内所有交易数据将被永久删除。</span>}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true, size: 'small', style: { fontSize: 10, fontWeight: 600 } }}
            cancelButtonProps={{ size: 'small', style: { fontSize: 10, fontWeight: 600 } }}
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: 'var(--color-loss)', opacity: 0.6 }} />
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
      {/* 顶部统计卡片 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            label="账本总数" 
            value={totalStats.totalRecords} 
            icon={<FolderOutlined style={{ color: 'var(--color-brand)' }} />}
            subLabel="数据仓库"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            label="活跃账本" 
            value={totalStats.activeRecords}
            icon={<CheckCircleOutlined style={{ color: 'var(--color-profit)' }} />}
            subLabel="运行中"
            color="var(--color-profit)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            label="总交易数" 
            value={totalStats.totalTrades.toLocaleString()}
            icon={<HistoryOutlined />}
            subLabel="累计样本"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard 
            label="汇总盈亏" 
            value={`${totalStats.totalPnL >= 0 ? '+' : ''}${totalStats.totalPnL.toLocaleString()}`}
            icon={totalStats.totalPnL >= 0 ? <RiseOutlined style={{ color: 'var(--color-profit)' }} /> : <FallOutlined style={{ color: 'var(--color-loss)' }} />}
            subLabel="整体表现"
            color={totalStats.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
          />
        </Col>
      </Row>

      {/* 操作栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 6
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 32, 
            height: 32, 
            borderRadius: 4, 
            background: 'var(--color-brand-bg)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <BookOutlined style={{ color: 'var(--color-brand)' }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>账本管理</span>
          <span style={{ 
            fontSize: 10, 
            color: 'var(--text-tertiary)', 
            background: 'var(--bg-tertiary)', 
            padding: '2px 8px', 
            borderRadius: 2 
          }}>
            {totalStats.totalRecords} 个账本
          </span>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreate}
          style={{ 
            background: 'var(--color-brand)', 
            borderColor: 'var(--color-brand)', 
            color: 'var(--bg-primary)', 
            fontWeight: 600, 
            fontSize: 12,
            borderRadius: 4,
            height: 32
          }}
        >
          新建账本
        </Button>
      </div>

      {/* 主表格区域 */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6,
        overflow: 'hidden'
      }}>
        {records.length === 0 && !loading ? (
          <div style={{ 
            padding: '64px 24px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center' 
          }}>
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
              <FolderOutlined style={{ fontSize: 24, color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>暂无交易账本</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', maxWidth: 240, marginBottom: 24 }}>
              创建第一个账本以开始导入和分析交易数据
            </div>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleCreate}
              style={{ 
                background: 'var(--color-brand)', 
                borderColor: 'var(--color-brand)', 
                color: 'var(--bg-primary)', 
                fontWeight: 600, 
                fontSize: 12,
                borderRadius: 4,
                height: 36,
                paddingLeft: 24,
                paddingRight: 24
              }}
            >
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
              showTotal: (total) => (
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 500, 
                  color: 'var(--text-tertiary)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em' 
                }}>
                  共 {total} 个账本
                </span>
              ),
            }}
            className="binance-table"
          />
        )}
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
              <FolderOpenOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingRecord ? '更新账本' : '新建账本'}
            </span>
          </div>
        }
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="确认保存"
        cancelText="取消"
        width={460}
        destroyOnClose
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
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>账本名称</span>}
            rules={[{ required: true, message: '请输入账本名称' }]}
          >
            <Input 
              placeholder="例如：2026 Q1 资金挑战" 
              style={{ 
                background: 'var(--bg-tertiary)', 
                borderColor: 'var(--border-primary)', 
                color: 'var(--text-primary)',
                borderRadius: 4
              }} 
            />
          </Form.Item>
          <Form.Item
            name="description"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>备注（可选）</span>}
          >
            <TextArea 
              placeholder="说明交易环境、账户类型或目标等..." 
              rows={4}
              maxLength={200}
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
        </Form>
      </Modal>
    </div>
  );
};

export default TradingRecords;
