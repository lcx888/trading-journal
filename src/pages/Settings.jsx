import { useState, useEffect } from 'react';
import { 
  Form, Input, InputNumber, Button, Table, Space, 
  message, Modal, Popconfirm, Row, Col, Tag, Empty, Select
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
  LockOutlined,
  MailOutlined,
  WarningOutlined,
  SettingOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import { isUSDaylightSavingTime, isEUDaylightSavingTime, formatCSTTime } from '../utils/timezone';
import { fixHoldingTimes } from '../utils/debugHoldingTime';
import { changePassword, changeEmail, deleteAccount, resendVerification, getMe } from '../services/auth';
import { CrownOutlined, RocketOutlined, CheckCircleOutlined, ThunderboltOutlined, GiftOutlined } from '@ant-design/icons';
import { redeemCode, clearSubscriptionCache } from '../services/subscription';

const { TextArea } = Input;

// 常用时区列表
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)', offset: '+08:00' },
  { value: 'Asia/Hong_Kong', label: '香港时间 (UTC+8)', offset: '+08:00' },
  { value: 'Asia/Singapore', label: '新加坡时间 (UTC+8)', offset: '+08:00' },
  { value: 'Asia/Tokyo', label: '日本时间 (UTC+9)', offset: '+09:00' },
  { value: 'Asia/Seoul', label: '韩国时间 (UTC+9)', offset: '+09:00' },
  { value: 'Asia/Dubai', label: '迪拜时间 (UTC+4)', offset: '+04:00' },
  { value: 'Europe/London', label: '伦敦时间 (UTC+0/+1)', offset: '+00:00' },
  { value: 'Europe/Paris', label: '巴黎时间 (UTC+1/+2)', offset: '+01:00' },
  { value: 'Europe/Berlin', label: '柏林时间 (UTC+1/+2)', offset: '+01:00' },
  { value: 'America/New_York', label: '纽约时间 (UTC-5/-4)', offset: '-05:00' },
  { value: 'America/Chicago', label: '芝加哥时间 (UTC-6/-5)', offset: '-06:00' },
  { value: 'America/Los_Angeles', label: '洛杉矶时间 (UTC-8/-7)', offset: '-08:00' },
  { value: 'America/Toronto', label: '多伦多时间 (UTC-5/-4)', offset: '-05:00' },
  { value: 'Australia/Sydney', label: '悉尼时间 (UTC+10/+11)', offset: '+10:00' },
  { value: 'Pacific/Auckland', label: '奥克兰时间 (UTC+12/+13)', offset: '+12:00' },
];

const Settings = ({ onLogout, subscription, onUpgrade }) => {
  const [instruments, setInstruments] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState(null);
  const [form] = Form.useForm();
  const [dataStats, setDataStats] = useState({ trades: 0, imports: 0 });
  
  // 用户时区设置
  const [userTimezone, setUserTimezone] = useState('Asia/Shanghai');
  const [dataSourceTimezone, setDataSourceTimezone] = useState('Asia/Shanghai');
  
  // 账户安全相关状态
  const [userInfo, setUserInfo] = useState(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [passwordForm] = Form.useForm();
  const [emailForm] = Form.useForm();
  const [deleteForm] = Form.useForm();

  // 兑换码状态
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instrumentList, history, trades, user] = await Promise.all([
        StorageService.getInstruments(),
        StorageService.getImportHistory(),
        StorageService.getAllTrades(),
        getMe().catch(() => null),
      ]);
      setInstruments(instrumentList);
      setImportHistory(history);
      setDataStats({
        trades: trades.length,
        imports: history.length,
      });
      setUserInfo(user);
      
      // 加载用户时区设置
      const savedTimezone = StorageService.getUserTimezone();
      setUserTimezone(savedTimezone);
      
      // 加载数据源时区设置
      const savedDataSourceTimezone = StorageService.getDataSourceTimezone();
      setDataSourceTimezone(savedDataSourceTimezone);
    } catch (error) {
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存用户时区设置
  const handleTimezoneChange = (timezone) => {
    setUserTimezone(timezone);
    StorageService.setUserTimezone(timezone);
    message.success('时区设置已保存');
  };

  // 保存数据源时区设置
  const handleDataSourceTimezoneChange = (timezone) => {
    setDataSourceTimezone(timezone);
    StorageService.setDataSourceTimezone(timezone);
    message.success('数据源时区已保存，新导入的数据将使用此时区');
  };

  // 修改密码
  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setSecurityLoading(true);
      await changePassword(values.currentPassword, values.newPassword);
      message.success('密码修改成功');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (e) {
      message.error(e.message || '修改失败');
    } finally {
      setSecurityLoading(false);
    }
  };

  // 修改邮箱
  const handleChangeEmail = async () => {
    try {
      const values = await emailForm.validateFields();
      setSecurityLoading(true);
      await changeEmail(values.newEmail, values.password);
      message.success('验证邮件已发送到新邮箱，请查收确认');
      setEmailModalVisible(false);
      emailForm.resetFields();
    } catch (e) {
      message.error(e.message || '修改失败');
    } finally {
      setSecurityLoading(false);
    }
  };

  // 重新发送验证邮件
  const handleResendVerification = async () => {
    try {
      setSecurityLoading(true);
      await resendVerification();
      message.success('验证邮件已发送');
    } catch (e) {
      message.error(e.message || '发送失败');
    } finally {
      setSecurityLoading(false);
    }
  };

  // 注销账户
  const handleDeleteAccount = async () => {
    try {
      const values = await deleteForm.validateFields();
      setSecurityLoading(true);
      await deleteAccount(values.password, values.confirmText);
      message.success('账户已注销');
      onLogout?.();
    } catch (e) {
      message.error(e.message || '注销失败');
    } finally {
      setSecurityLoading(false);
    }
  };

  // 兑换码兑换
  const handleRedeemCode = async () => {
    try {
      const values = await redeemForm.validateFields();
      setRedeemLoading(true);
      const result = await redeemCode(values.code);
      message.success(result.message || '兑换成功！');
      setRedeemModalVisible(false);
      redeemForm.resetFields();
      // 清除缓存并刷新页面以更新订阅状态
      clearSubscriptionCache();
      window.location.reload();
    } catch (e) {
      message.error(e.response?.data?.message || e.message || '兑换失败');
    } finally {
      setRedeemLoading(false);
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
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 6, 
            background: 'var(--color-loss-bg)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <WarningOutlined style={{ color: 'var(--color-loss)', fontSize: 18 }} />
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>清除所有数据？</span>
        </div>
      ),
      icon: null,
      content: <span style={{ color: 'var(--text-secondary)', marginLeft: 48 }}>将永久删除所有交易记录与导入历史，且无法恢复。</span>,
      okText: '永久清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await StorageService.clearAllTrades();
        message.success('本地数据已清空');
        loadData();
      },
    });
  };

  const handleFixHoldingTimes = async () => {
    Modal.confirm({
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 6, 
            background: 'var(--color-brand-bg)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <ToolOutlined style={{ color: 'var(--color-brand)', fontSize: 18 }} />
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>修复数据结构</span>
        </div>
      ),
      icon: null,
      content: <span style={{ color: 'var(--text-secondary)', marginLeft: 48 }}>是否基于成交时间重新计算所有交易的持仓时长？</span>,
      okText: '执行修复',
      cancelText: '取消',
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
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>代码</span>,
      dataIndex: 'code',
      key: 'code',
      render: (c) => (
        <Tag style={{ 
          background: 'var(--color-brand-bg)', 
          color: 'var(--color-brand)', 
          border: 'none', 
          fontWeight: 600, 
          fontSize: 11, 
          padding: '2px 8px' 
        }}>
          {c}
        </Tag>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>名称</span>,
      dataIndex: 'name',
      key: 'name',
      render: (n) => <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{n}</span>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>手续费</span>,
      dataIndex: 'feeRate',
      key: 'feeRate',
      render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>${r}</span>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>每跳价值</span>,
      dataIndex: 'tickValue',
      key: 'tickValue',
      render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>${v}</span>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ATAS 匹配</span>,
      dataIndex: 'atasPattern',
      key: 'atasPattern',
      render: (p) => <code style={{ fontSize: 9, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 2 }}>{p}</code>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>操作</span>,
      key: 'action',
      align: 'right',
      render: (_, r) => (
        <Space>
          <Button 
            type="text" 
            size="small" 
            icon={<EditOutlined />} 
            style={{ color: 'var(--text-tertiary)' }} 
            onClick={() => handleEditInstrument(r)} 
          />
          <Popconfirm 
            title={<span style={{ color: 'var(--text-primary)' }}>删除品种？</span>} 
            onConfirm={() => handleDeleteInstrument(r.code)}
            okButtonProps={{ danger: true, size: 'small' }}
            cancelButtonProps={{ size: 'small' }}
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: 'var(--color-loss)', opacity: 0.6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>导入时间</span>,
      dataIndex: 'importDate',
      key: 'importDate',
      render: (d) => <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{dayjs(d).format('MM/DD HH:mm')}</span>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>源文件</span>,
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: true,
      render: (f) => <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{f}</span>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>数量</span>,
      dataIndex: 'tradesCount',
      key: 'tradesCount',
      align: 'center',
      render: (c) => <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{c}</span>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>盈亏</span>,
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      align: 'right',
      render: (p) => (
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontWeight: 600, 
          fontSize: 11, 
          color: p >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
        }}>
          {p >= 0 ? '+' : ''}{p?.toFixed(2)}
        </span>
      ),
    },
  ];

  const now = new Date();
  const isUSDST = isUSDaylightSavingTime(now);
  const isEUDST = isEUDaylightSavingTime(now);

  // 卡片样式
  const cardStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: 24,
  };

  // 操作按钮样式
  const ActionButton = ({ onClick, title, desc, danger, icon }) => (
    <Button 
      block 
      onClick={onClick}
      style={{ 
        height: 56, 
        textAlign: 'left', 
        padding: '0 16px', 
        borderRadius: 6, 
        borderColor: danger ? 'var(--color-loss)' : 'var(--border-primary)', 
        background: danger ? 'var(--color-loss-bg)' : 'var(--bg-tertiary)',
        color: 'var(--text-primary)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: danger ? 'var(--color-loss)' : 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{desc}</div>
        </div>
        {icon || <ArrowRightOutlined style={{ color: 'var(--text-tertiary)' }} />}
      </div>
    </Button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Row gutter={24}>
        <Col xs={24} lg={16} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 品种配置 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
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
                  <GlobalOutlined style={{ color: 'var(--color-brand)' }} />
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>品种配置</span>
              </div>
              <Button 
                type="primary" 
                size="small" 
                icon={<PlusOutlined />} 
                onClick={handleAddInstrument}
                style={{ 
                  background: 'var(--color-brand)', 
                  borderColor: 'var(--color-brand)', 
                  color: 'var(--bg-primary)', 
                  fontWeight: 600, 
                  fontSize: 11,
                  borderRadius: 4
                }}
              >
                新增品种
              </Button>
            </div>
            <Table
              columns={instrumentColumns}
              dataSource={instruments}
              rowKey="code"
              loading={loading}
              pagination={false}
              size="small"
              className="binance-table"
            />
          </div>

          {/* 导入记录 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 4, 
                background: 'var(--color-profit-bg)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <HistoryOutlined style={{ color: 'var(--color-profit)' }} />
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>导入记录</span>
            </div>
            <Table
              columns={historyColumns}
              dataSource={importHistory}
              rowKey={(record) => `${record.importDate}-${record.filename}`}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              size="small"
              className="binance-table"
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--text-tertiary)' }}>暂无导入记录</span>} /> }}
            />
          </div>
        </Col>

        <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 时区设置 */}
          <div style={{ 
            background: 'var(--bg-primary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: 6, 
            padding: 24, 
            position: 'relative', 
            overflow: 'hidden' 
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, padding: 16, opacity: 0.05, pointerEvents: 'none' }}>
              <EnvironmentOutlined style={{ fontSize: 100 }} />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 4, 
                  background: 'var(--color-brand-bg)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <EnvironmentOutlined style={{ color: 'var(--color-brand)' }} />
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>时区设置</span>
              </div>
              
              {/* 数据源时区（交易软件的时区）*/}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  交易软件时区 <Tag style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand)', border: 'none', fontSize: 9, marginLeft: 4 }}>重要</Tag>
                </div>
                <Select
                  value={dataSourceTimezone}
                  onChange={handleDataSourceTimezoneChange}
                  style={{ width: '100%' }}
                  options={TIMEZONE_OPTIONS}
                  optionRender={(option) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{option.data.label}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{option.data.offset}</span>
                    </div>
                  )}
                />
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  设置您交易软件（如 ATAS、Jigsaw）导出数据使用的时区
                </div>
              </div>

              {/* 用户本地时区 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  您的本地时区
                </div>
                <Select
                  value={userTimezone}
                  onChange={handleTimezoneChange}
                  style={{ width: '100%' }}
                  options={TIMEZONE_OPTIONS}
                  optionRender={(option) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{option.data.label}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{option.data.offset}</span>
                    </div>
                  )}
                />
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  用于显示和市场时段判断
                </div>
              </div>

              <div style={{ padding: 12, background: 'var(--color-brand-bg)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-brand)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  <InfoCircleOutlined /> 时区转换说明
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <div>• 导入数据时，系统会将交易软件时区的时间转换为您的本地时区</div>
                  <div>• 例如：ATAS 使用纽约时间 → 自动转换为北京时间</div>
                  <div>• 正确设置可确保市场时段（亚盘/欧盘/美盘）统计准确</div>
                </div>
              </div>
            </div>
          </div>

          {/* 环境信息 */}
          <div style={{ 
            background: 'var(--bg-primary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: 6, 
            padding: 24, 
            position: 'relative', 
            overflow: 'hidden' 
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, padding: 16, opacity: 0.05, pointerEvents: 'none' }}>
              <ClockCircleOutlined style={{ fontSize: 100 }} />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ color: 'var(--color-brand)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 16 }}>环境信息</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>当前时区</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {TIMEZONE_OPTIONS.find(t => t.value === userTimezone)?.label.split(' ')[0] || userTimezone}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>本地时间</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-brand)' }}>{formatCSTTime(now, true)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>美东夏令时</span>
                  <Tag style={{ 
                    background: isUSDST ? 'var(--color-profit-bg)' : 'var(--bg-tertiary)', 
                    color: isUSDST ? 'var(--color-profit)' : 'var(--text-tertiary)', 
                    border: 'none', 
                    fontSize: 9, 
                    fontWeight: 600 
                  }}>
                    {isUSDST ? '生效' : '未生效'}
                  </Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>欧洲夏令时</span>
                  <Tag style={{ 
                    background: isEUDST ? 'var(--color-profit-bg)' : 'var(--bg-tertiary)', 
                    color: isEUDST ? 'var(--color-profit)' : 'var(--text-tertiary)', 
                    border: 'none', 
                    fontSize: 9, 
                    fontWeight: 600 
                  }}>
                    {isEUDST ? '生效' : '未生效'}
                  </Tag>
                </div>
              </div>

              <div style={{ marginTop: 24, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-brand)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  <InfoCircleOutlined /> 时段识别
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                  系统根据交易时间自动识别市场时段，并根据全球夏令时自动调整。
                </div>
              </div>
            </div>
          </div>

          {/* 数据库统计 */}
          <div style={cardStyle}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>数据库统计</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{dataStats.trades}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>交易记录</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{dataStats.imports}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>导入次数</div>
              </div>
            </div>
          </div>

          {/* 订阅管理 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 4, 
                background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2), rgba(180, 83, 9, 0.1))', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <CrownOutlined style={{ color: '#d97706' }} />
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>订阅管理</span>
            </div>
            
            {/* 当前订阅状态 */}
            {(() => {
              const plan = subscription?.plan || {};
              const planName = plan.name || 'free';
              const isFreePlan = planName === 'free';
              const usage = subscription?.usage || {};
              
              const planInfo = {
                free: { 
                  displayName: 'Free 免费版', 
                  color: '#6b7280',
                  bgColor: 'rgba(107, 114, 128, 0.1)',
                  features: ['1 个账本', '每月 100 笔交易', '3 次 AI 分析'],
                },
                pro: { 
                  displayName: 'Pro 专业版', 
                  color: '#d97706',
                  bgColor: 'rgba(217, 119, 6, 0.1)',
                  features: ['无限账本', '无限交易', '无限 AI 分析', '智能诊断系统'],
                },
                elite: { 
                  displayName: 'Elite 精英版', 
                  color: '#a855f7',
                  bgColor: 'rgba(168, 85, 247, 0.1)',
                  features: ['所有 Pro 功能', 'API 接口', '优先支持', 'VIP 服务'],
                },
                team: { 
                  displayName: 'Team 团队版', 
                  color: '#7c3aed',
                  bgColor: 'rgba(124, 58, 237, 0.1)',
                  features: ['所有 Pro 功能', '多人协作', 'API 接口', '优先支持'],
                },
              };
              
              const currentPlan = planInfo[planName] || planInfo.free;
              
              return (
                <>
                  {/* 当前计划卡片 */}
                  <div style={{ 
                    padding: 16, 
                    background: currentPlan.bgColor, 
                    borderRadius: 8, 
                    border: `1px solid ${currentPlan.color}30`,
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>当前计划</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: currentPlan.color }}>{currentPlan.displayName}</div>
                      </div>
                      <Tag style={{ 
                        background: currentPlan.color, 
                        color: '#fff', 
                        border: 'none',
                        fontWeight: 600,
                      }}>
                        {isFreePlan ? 'FREE' : 'ACTIVE'}
                      </Tag>
                    </div>
                    
                    {/* 使用量统计 */}
                    {isFreePlan && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div style={{ padding: 10, background: 'var(--bg-primary)', borderRadius: 6 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>本月交易</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                            {usage.tradesUsedThisMonth || 0} / {plan.maxTradesPerMonth || 100}
                          </div>
                          <div style={{ 
                            height: 4, 
                            background: 'var(--bg-tertiary)', 
                            borderRadius: 2, 
                            marginTop: 6,
                            overflow: 'hidden',
                          }}>
                            <div style={{ 
                              width: `${Math.min(100, ((usage.tradesUsedThisMonth || 0) / (plan.maxTradesPerMonth || 100)) * 100)}%`, 
                              height: '100%', 
                              background: '#d97706',
                              borderRadius: 2,
                            }} />
                          </div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--bg-primary)', borderRadius: 6 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>AI 分析</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                            {usage.aiAnalysisUsedThisMonth || 0} / {plan.maxAiAnalysisPerMonth || 3}
                          </div>
                          <div style={{ 
                            height: 4, 
                            background: 'var(--bg-tertiary)', 
                            borderRadius: 2, 
                            marginTop: 6,
                            overflow: 'hidden',
                          }}>
                            <div style={{ 
                              width: `${Math.min(100, ((usage.aiAnalysisUsedThisMonth || 0) / (plan.maxAiAnalysisPerMonth || 3)) * 100)}%`, 
                              height: '100%', 
                              background: '#3b82f6',
                              borderRadius: 2,
                            }} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 功能列表 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {currentPlan.features.map((feature, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 4, 
                          fontSize: 11, 
                          color: 'var(--text-secondary)',
                        }}>
                          <CheckCircleOutlined style={{ fontSize: 10, color: 'var(--color-profit)' }} />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {isFreePlan ? (
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        onClick={onUpgrade}
                        style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                          border: 'none',
                          height: 40,
                          fontWeight: 600,
                        }}
                      >
                          升级到 Pro · $49/月
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={onUpgrade}
                          style={{ flex: 1, borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                        >
                          管理订阅
                        </Button>
                        <Button
                          icon={<ThunderboltOutlined />}
                          onClick={onUpgrade}
                          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                        >
                          升级
                        </Button>
                      </>
                    )}
                    </div>
                    {/* 兑换码入口 */}
                    <Button
                      icon={<GiftOutlined />}
                      onClick={() => setRedeemModalVisible(true)}
                      style={{ 
                        width: '100%',
                        borderColor: 'var(--border-primary)', 
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-tertiary)',
                      }}
                    >
                      使用兑换码
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 账户安全 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 4, 
                background: 'var(--color-brand-bg)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <LockOutlined style={{ color: 'var(--color-brand)' }} />
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>账户安全</span>
            </div>
            
            {/* 用户信息 */}
            {userInfo && (
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    background: 'var(--color-brand)', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'var(--bg-primary)', 
                    fontWeight: 700 
                  }}>
                    {userInfo.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{userInfo.email}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <Tag style={{ 
                        background: userInfo.emailVerified ? 'var(--color-profit-bg)' : 'var(--color-brand-bg)', 
                        color: userInfo.emailVerified ? 'var(--color-profit)' : 'var(--color-brand)', 
                        border: 'none', 
                        fontSize: 9, 
                        margin: 0 
                      }}>
                        {userInfo.emailVerified ? '已验证' : '未验证'}
                      </Tag>
                      <Tag style={{ 
                        background: 'var(--bg-tertiary)', 
                        color: 'var(--text-secondary)', 
                        border: '1px solid var(--border-primary)', 
                        fontSize: 9, 
                        margin: 0 
                      }}>
                        {userInfo.role}
                      </Tag>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 邮箱未验证提示 */}
            {userInfo && !userInfo.emailVerified && (
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-brand-bg)', border: '1px solid var(--border-primary)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <WarningOutlined style={{ color: 'var(--color-brand)', marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)' }}>邮箱未验证</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8 }}>请验证邮箱以确保账户安全</div>
                    <Button 
                      size="small" 
                      loading={securityLoading} 
                      onClick={handleResendVerification}
                      style={{ 
                        borderColor: 'var(--color-brand)', 
                        color: 'var(--color-brand)',
                        borderRadius: 4
                      }}
                    >
                      重新发送验证邮件
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ActionButton onClick={() => setPasswordModalVisible(true)} title="修改密码" desc="更新账户登录密码" />
              <ActionButton onClick={() => setEmailModalVisible(true)} title="修改邮箱" desc="更换账户绑定邮箱" />
              <ActionButton onClick={() => setDeleteModalVisible(true)} title="注销账户" desc="永久删除账户和数据" danger icon={<DeleteOutlined style={{ color: 'var(--color-loss)', opacity: 0.6 }} />} />
            </div>
          </div>

          {/* 系统维护 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 4, 
                background: 'var(--color-brand-bg)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <SettingOutlined style={{ color: 'var(--color-brand)' }} />
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>系统维护</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ActionButton onClick={handleFixHoldingTimes} title="修复持仓时长" desc="重新计算持仓时间" />
              <ActionButton onClick={handleClearAllData} title="数据清空" desc="清空服务器数据" danger icon={<DeleteOutlined style={{ color: 'var(--color-loss)', opacity: 0.6 }} />} />
            </div>
          </div>
        </Col>
      </Row>

      {/* 编辑品种弹窗 */}
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
              <EditOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingInstrument ? '更新品种' : '新增品种'}
            </span>
          </div>
        }
        open={editModalVisible}
        onOk={handleSaveInstrument}
        onCancel={() => setEditModalVisible(false)}
        okText="确认保存"
        cancelText="取消"
        width={480}
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="code" 
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>品种代码</span>} 
                rules={[{ required: true }]}
              >
                <Input 
                  placeholder="例如：ES、NQ、GC" 
                  disabled={!!editingInstrument} 
                  style={{ 
                    background: 'var(--bg-tertiary)', 
                    borderColor: 'var(--border-primary)', 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    borderRadius: 4
                  }} 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="name" 
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>品种名称</span>} 
                rules={[{ required: true }]}
              >
                <Input 
                  placeholder="例如：标普500期货"
                  style={{ 
                    background: 'var(--bg-tertiary)', 
                    borderColor: 'var(--border-primary)', 
                    color: 'var(--text-primary)',
                    borderRadius: 4
                  }} 
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="feeRate" 
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>手续费/边 ($)</span>} 
                rules={[{ required: true }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="tickValue" 
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>每跳价值 ($)</span>} 
                rules={[{ required: true }]}
              >
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item 
            name="initialCapital" 
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>初始资金 ($)</span>} 
            rules={[{ required: true }]}
          >
            <InputNumber min={0} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item 
            name="atasPattern" 
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ATAS 正则匹配</span>}
          >
            <Input 
              placeholder="例如：GC.*@NYMEX"
              style={{ 
                background: 'var(--bg-tertiary)', 
                borderColor: 'var(--border-primary)', 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                borderRadius: 4
              }} 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码弹窗 */}
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
              <LockOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>修改密码</span>
          </div>
        }
        open={passwordModalVisible}
        onOk={handleChangePassword}
        onCancel={() => { setPasswordModalVisible(false); passwordForm.resetFields(); }}
        okText="确认修改"
        cancelText="取消"
        confirmLoading={securityLoading}
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
        <Form form={passwordForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="currentPassword"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>当前密码</span>}
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="输入当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>新密码</span>}
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' }
            ]}
          >
            <Input.Password placeholder="至少 6 位字符" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>确认新密码</span>}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改邮箱弹窗 */}
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
              <MailOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>修改邮箱</span>
          </div>
        }
        open={emailModalVisible}
        onOk={handleChangeEmail}
        onCancel={() => { setEmailModalVisible(false); emailForm.resetFields(); }}
        okText="发送验证"
        cancelText="取消"
        confirmLoading={securityLoading}
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
        <Form form={emailForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="newEmail"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>新邮箱</span>}
            rules={[
              { required: true, message: '请输入新邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: 'var(--text-tertiary)' }} />} placeholder="name@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>当前密码</span>}
            rules={[{ required: true, message: '请输入密码验证身份' }]}
          >
            <Input.Password placeholder="输入密码验证身份" />
          </Form.Item>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: 12, borderRadius: 6 }}>
            验证邮件将发送到新邮箱，点击邮件中的链接完成更换。
          </div>
        </Form>
      </Modal>

      {/* 注销账户弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', color: 'var(--color-loss)' }}>
            <WarningOutlined style={{ fontSize: 20 }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>注销账户</span>
          </div>
        }
        open={deleteModalVisible}
        onOk={handleDeleteAccount}
        onCancel={() => { setDeleteModalVisible(false); deleteForm.resetFields(); }}
        okText="确认注销"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={securityLoading}
        destroyOnClose
      >
        <div style={{ background: 'var(--color-loss-bg)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: 'var(--color-loss)', marginBottom: 8 }}>⚠️ 警告：此操作不可撤销</div>
          <ul style={{ fontSize: 13, color: 'var(--color-loss)', margin: 0, paddingLeft: 20 }}>
            <li>所有交易数据将被永久删除</li>
            <li>所有账本和策略将被清除</li>
            <li>账户将无法恢复</li>
          </ul>
        </div>
        <Form form={deleteForm} layout="vertical">
          <Form.Item
            name="password"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>输入密码</span>}
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="输入密码确认身份" />
          </Form.Item>
          <Form.Item
            name="confirmText"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>输入"确认注销"以确认</span>}
            rules={[
              { required: true, message: '请输入确认文字' },
              { pattern: /^确认注销$/, message: '请输入"确认注销"' }
            ]}
          >
            <Input placeholder='请输入"确认注销"' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 兑换码弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 6, 
              background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2), rgba(180, 83, 9, 0.1))', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <GiftOutlined style={{ color: '#d97706', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>使用兑换码</span>
          </div>
        }
        open={redeemModalVisible}
        onOk={handleRedeemCode}
        onCancel={() => { setRedeemModalVisible(false); redeemForm.resetFields(); }}
        okText="兑换"
        cancelText="取消"
        confirmLoading={redeemLoading}
        destroyOnClose
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            border: 'none',
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
        <Form form={redeemForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>兑换码</span>}
            rules={[{ required: true, message: '请输入兑换码' }]}
          >
            <Input 
              prefix={<GiftOutlined style={{ color: 'var(--text-tertiary)' }} />} 
              placeholder="请输入兑换码，例如：XXXX-XXXX-XXXX" 
              style={{ 
                fontFamily: 'var(--font-mono)', 
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
              maxLength={20}
            />
          </Form.Item>
          <div style={{ 
            padding: 12, 
            background: 'var(--bg-tertiary)', 
            borderRadius: 6, 
            border: '1px solid var(--border-primary)',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            💡 兑换码将为您的账户添加相应的订阅时长。如果您已有订阅，将在现有时长基础上延长。
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Settings;
