import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Select, message, Button, Input, Space, Row, Col, Empty, Tabs, Modal, InputNumber, Popconfirm, Tooltip, Form, DatePicker } from 'antd';
import { 
  UserOutlined, 
  ReloadOutlined, 
  SearchOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  StopOutlined,
  MailOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  HistoryOutlined,
  GiftOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { apiRequest } from '../services/api';
import dayjs from 'dayjs';

const ROLE_OPTIONS = [
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '管理员' },
  { value: 'superadmin', label: '超级管理员' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '禁用' },
];

const Admin = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchText, setSearchText] = useState('');
  
  // 订阅管理状态
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [editSubModal, setEditSubModal] = useState({ visible: false, subscription: null });
  const [addSubModal, setAddSubModal] = useState({ visible: false, userId: '' });

  // 兑换码管理状态
  const [redemptionCodes, setRedemptionCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [generateCodeModal, setGenerateCodeModal] = useState(false);
  const [generateForm] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await apiRequest('/admin/users');
      setUsers(result);
    } catch (e) {
      message.error(e.message || '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    setLoadingSubs(true);
    try {
      const [subs, plansData, history] = await Promise.all([
        apiRequest('/admin/subscriptions'),
        apiRequest('/admin/plans'),
        apiRequest('/admin/subscription-history'),
      ]);
      setSubscriptions(subs);
      setPlans(plansData);
      setSubscriptionHistory(history);
    } catch (e) {
      console.error('加载订阅数据失败:', e);
    } finally {
      setLoadingSubs(false);
    }
  };

  // 加载兑换码
  const loadRedemptionCodes = async () => {
    setLoadingCodes(true);
    try {
      const codes = await apiRequest('/admin/redemption-codes');
      setRedemptionCodes(codes);
    } catch (e) {
      console.error('加载兑换码失败:', e);
    } finally {
      setLoadingCodes(false);
    }
  };

  // 生成兑换码
  const handleGenerateCodes = async () => {
    try {
      const values = await generateForm.validateFields();
      const result = await apiRequest('/admin/redemption-codes/generate', {
        method: 'POST',
        body: {
          planName: values.planName,
          durationDays: values.durationDays,
          count: values.count || 1,
          maxUses: values.maxUses || 1,
          expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
          note: values.note || null,
        },
      });
      message.success(`成功生成 ${result.count} 个兑换码`);
      setGenerateCodeModal(false);
      generateForm.resetFields();
      loadRedemptionCodes();
    } catch (e) {
      message.error(e.message || '生成兑换码失败');
    }
  };

  // 删除兑换码
  const handleDeleteCode = async (id) => {
    try {
      await apiRequest(`/admin/redemption-codes/${id}`, { method: 'DELETE' });
      message.success('兑换码已删除');
      loadRedemptionCodes();
    } catch (e) {
      message.error(e.message || '删除失败');
    }
  };

  // 切换兑换码状态
  const handleToggleCodeStatus = async (id, isActive) => {
    try {
      await apiRequest(`/admin/redemption-codes/${id}`, { 
        method: 'PATCH', 
        body: { isActive: !isActive } 
      });
      message.success(isActive ? '已禁用' : '已启用');
      loadRedemptionCodes();
    } catch (e) {
      message.error(e.message || '更新失败');
    }
  };

  // 复制兑换码到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'subscriptions') {
      loadSubscriptions();
    } else if (activeTab === 'redemption') {
      loadRedemptionCodes();
      // 也需要加载 plans 用于生成兑换码
      if (plans.length === 0) {
        apiRequest('/admin/plans').then(setPlans).catch(console.error);
      }
    }
  }, [activeTab]);

  const updateUser = async (id, updates) => {
    try {
      await apiRequest(`/admin/users/${id}`, { method: 'PATCH', body: updates });
      message.success('已更新');
      loadUsers();
    } catch (e) {
      message.error(e.message || '更新失败');
    }
  };

  // 订阅管理函数
  const createSubscription = async (userId, planName, billingCycle) => {
    try {
      await apiRequest('/subscription/create', { 
        method: 'POST', 
        body: { userId, planName, billingCycle } 
      });
      message.success('订阅创建成功');
      loadSubscriptions();
      setAddSubModal({ visible: false, userId: '' });
    } catch (e) {
      message.error(e.message || '创建订阅失败');
    }
  };

  const updateSubscription = async (userId, updates) => {
    try {
      await apiRequest(`/admin/subscriptions/${userId}`, { 
        method: 'PATCH', 
        body: updates 
      });
      message.success('订阅更新成功');
      loadSubscriptions();
      setEditSubModal({ visible: false, subscription: null });
    } catch (e) {
      message.error(e.message || '更新订阅失败');
    }
  };

  const deleteSubscription = async (userId) => {
    try {
      await apiRequest(`/admin/subscriptions/${userId}`, { method: 'DELETE' });
      message.success('订阅已删除');
      loadSubscriptions();
    } catch (e) {
      message.error(e.message || '删除订阅失败');
    }
  };

  const updatePlan = async (planId, updates) => {
    try {
      await apiRequest(`/admin/plans/${planId}`, { 
        method: 'PATCH', 
        body: updates 
      });
      message.success('计划更新成功');
      loadSubscriptions();
    } catch (e) {
      message.error(e.message || '更新计划失败');
    }
  };

  // 统计数据
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const adminCount = users.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
    const activeCount = users.filter(u => u.status === 'active').length;
    const verifiedCount = users.filter(u => u.emailVerified).length;
    return { totalUsers, adminCount, activeCount, verifiedCount };
  }, [users]);

  // 过滤用户
  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    return users.filter(u => u.email?.toLowerCase().includes(searchText.toLowerCase()));
  }, [users, searchText]);

  // 获取角色图标
  const getRoleIcon = (role) => {
    if (role === 'superadmin') return <CrownOutlined style={{ color: 'var(--color-brand)' }} />;
    if (role === 'admin') return <SafetyCertificateOutlined style={{ color: 'var(--color-profit)' }} />;
    return <UserOutlined style={{ color: 'var(--text-tertiary)' }} />;
  };

  // 获取角色标签样式
  const getRoleTagStyle = (role) => {
    if (role === 'superadmin') {
      return { background: 'var(--color-brand-bg)', color: 'var(--color-brand)', border: 'none' };
    }
    if (role === 'admin') {
      return { background: 'var(--color-profit-bg)', color: 'var(--color-profit)', border: 'none' };
    }
    return { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none' };
  };


  const columns = [
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>用户</span>,
      dataIndex: 'email',
      key: 'email',
      render: (email, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 36, 
            height: 36, 
            borderRadius: '50%', 
            background: record.role === 'superadmin' ? 'var(--color-brand)' : record.role === 'admin' ? 'var(--color-profit)' : 'var(--bg-tertiary)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: record.role === 'user' ? 'var(--text-secondary)' : 'var(--bg-primary)',
            fontWeight: 700,
            fontSize: 14
          }}>
            {email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {record.emailVerified ? (
                <Tag style={{ background: 'var(--color-profit-bg)', color: 'var(--color-profit)', border: 'none', fontSize: 9, margin: 0, padding: '0 6px' }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />已验证
                </Tag>
              ) : (
                <Tag style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand)', border: 'none', fontSize: 9, margin: 0, padding: '0 6px' }}>
                  <MailOutlined style={{ marginRight: 4 }} />未验证
                </Tag>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>角色</span>,
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role, record) => (
        <Select
          value={role}
          size="small"
          options={ROLE_OPTIONS}
          onChange={(value) => updateUser(record.id, { role: value })}
          style={{ width: 130 }}
          popupClassName="dark-select-popup"
        />
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>状态</span>,
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status, record) => (
        <Select
          value={status}
          size="small"
          options={STATUS_OPTIONS}
          onChange={(value) => updateUser(record.id, { status: value })}
          style={{ width: 100 }}
          popupClassName="dark-select-popup"
        />
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>创建时间</span>,
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClockCircleOutlined style={{ color: 'var(--text-tertiary)', fontSize: 12 }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {dayjs(v).format('YYYY-MM-DD HH:mm')}
          </span>
        </div>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>标记</span>,
      key: 'tag',
      width: 120,
      render: (_, record) => (
        <Tag style={getRoleTagStyle(record.role)}>
          {getRoleIcon(record.role)}
          <span style={{ marginLeft: 6 }}>
            {record.role === 'superadmin' ? '超管' : record.role === 'admin' ? '管理员' : '用户'}
          </span>
        </Tag>
      ),
    },
  ];

  // 卡片样式
  const cardStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: 24,
  };

  // 统计卡片样式
  const statCardStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  };

  // 订阅管理表格列
  const subscriptionColumns = [
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>用户</span>,
      dataIndex: 'user',
      key: 'user',
      render: (user) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{user?.email}</div>
        </div>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>计划</span>,
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => {
        const colors = {
          free: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
          pro: { bg: 'var(--color-brand-bg)', color: 'var(--color-brand)' },
          team: { bg: 'rgba(124, 58, 237, 0.15)', color: '#a855f7' },
        };
        const style = colors[plan?.name] || colors.free;
        return <Tag style={{ background: style.bg, color: style.color, border: 'none' }}>{plan?.displayName}</Tag>;
      },
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>状态</span>,
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          active: { bg: 'var(--color-profit-bg)', color: 'var(--color-profit)' },
          cancelled: { bg: 'var(--color-loss-bg)', color: 'var(--color-loss)' },
          expired: { bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' },
          trial: { bg: 'var(--color-brand-bg)', color: 'var(--color-brand)' },
        };
        const style = colors[status] || colors.active;
        const labels = { active: '活跃', cancelled: '已取消', expired: '已过期', trial: '试用' };
        return <Tag style={{ background: style.bg, color: style.color, border: 'none' }}>{labels[status] || status}</Tag>;
      },
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>周期</span>,
      dataIndex: 'billingCycle',
      key: 'billingCycle',
      render: (cycle) => <span style={{ color: 'var(--text-secondary)' }}>{cycle === 'yearly' ? '年付' : '月付'}</span>,
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>开始时间</span>,
      dataIndex: 'currentPeriodStart',
      key: 'currentPeriodStart',
      render: (date) => (
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {date ? dayjs(date).format('YYYY-MM-DD') : '-'}
        </span>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>到期时间</span>,
      dataIndex: 'currentPeriodEnd',
      key: 'currentPeriodEnd',
      render: (date) => (
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {date ? dayjs(date).format('YYYY-MM-DD') : '-'}
        </span>
      ),
    },
    {
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>操作</span>,
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={8}>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => setEditSubModal({ visible: true, subscription: record })}
              style={{ color: 'var(--text-secondary)' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此订阅？"
            onConfirm={() => deleteSubscription(record.userId)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button 
                type="text" 
                size="small" 
                icon={<DeleteOutlined />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 计划管理表格列
  const planColumns = [
    {
      title: '计划名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (name, record) => {
        const icons = { free: '🆓', pro: '⭐', team: '🚀' };
        return <span>{icons[record.name] || ''} {name}</span>;
      },
    },
    { title: '月费 ($)', dataIndex: 'priceMonthly', key: 'priceMonthly' },
    { title: '年费 ($)', dataIndex: 'priceYearly', key: 'priceYearly' },
    { title: '最大账本', dataIndex: 'maxRecords', key: 'maxRecords', render: v => v === -1 ? '无限' : v },
    { title: '每月交易', dataIndex: 'maxTradesPerMonth', key: 'maxTradesPerMonth', render: v => v === -1 ? '无限' : v },
    { title: 'AI 分析/月', dataIndex: 'maxAiAnalysisPerMonth', key: 'maxAiAnalysisPerMonth', render: v => v === -1 ? '无限' : v },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active, record) => (
        <Select
          size="small"
          value={active}
          onChange={(v) => updatePlan(record.id, { isActive: v })}
          options={[
            { value: true, label: '启用' },
            { value: false, label: '禁用' },
          ]}
          style={{ width: 80 }}
        />
      ),
    },
  ];

  // 渲染用户管理内容
  const renderUsersTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TeamOutlined style={{ fontSize: 22, color: 'var(--color-brand)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{stats.totalUsers}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>总用户数</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-profit-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SafetyCertificateOutlined style={{ fontSize: 22, color: 'var(--color-profit)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{stats.adminCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>管理员</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-profit-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircleOutlined style={{ fontSize: 22, color: 'var(--color-profit)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{stats.activeCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>活跃用户</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MailOutlined style={{ fontSize: 22, color: 'var(--color-brand)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{stats.verifiedCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>已验证邮箱</div>
            </div>
          </div>
        </Col>
      </Row>

      {/* 用户表格 */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CrownOutlined style={{ color: 'var(--color-brand)', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>用户管理</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>管理系统用户角色与状态</div>
            </div>
          </div>
          <Space size={12}>
            <Input
              placeholder="搜索邮箱..."
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200, background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)', borderRadius: 4 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading} style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 4 }}>
              刷新
            </Button>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredUsers}
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          className="binance-table"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--text-tertiary)' }}>暂无用户数据</span>} /> }}
        />
      </div>
          </div>
  );

  // 渲染订阅管理内容
  const renderSubscriptionsTab = () => {
    const subStats = {
      total: subscriptions.length,
      active: subscriptions.filter(s => s.status === 'active').length,
      pro: subscriptions.filter(s => s.plan?.name === 'pro').length,
      elite: subscriptions.filter(s => s.plan?.name === 'elite').length,
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* 订阅统计 */}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarOutlined style={{ fontSize: 22, color: 'var(--color-brand)' }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{subStats.total}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>总订阅数</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-profit-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 22, color: 'var(--color-profit)' }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{subStats.active}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>活跃订阅</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>⭐</span>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{subStats.pro}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>专业版</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(124, 58, 237, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>👑</span>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{subStats.elite}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>精英版</div>
              </div>
            </div>
          </Col>
        </Row>

        {/* 订阅列表 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarOutlined style={{ color: 'var(--color-brand)', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>订阅管理</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>管理用户订阅状态与计划</div>
              </div>
            </div>
            <Space size={12}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setAddSubModal({ visible: true, userId: '' })}
              >
                添加订阅
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSubscriptions} loading={loadingSubs}>
                刷新
              </Button>
            </Space>
          </div>
          <Table
            rowKey="id"
            columns={subscriptionColumns}
            dataSource={subscriptions}
            loading={loadingSubs}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            className="binance-table"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--text-tertiary)' }}>暂无订阅数据</span>} /> }}
          />
        </div>

        {/* 计划配置 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CrownOutlined style={{ color: 'var(--text-secondary)', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>计划配置</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>管理订阅计划与定价</div>
            </div>
          </div>
          <Table
            rowKey="id"
            columns={planColumns}
            dataSource={plans}
            loading={loadingSubs}
            pagination={false}
            className="binance-table"
            size="small"
          />
        </div>

        {/* 订阅历史 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HistoryOutlined style={{ color: 'var(--text-secondary)', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>操作历史</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>订阅变更记录</div>
            </div>
          </div>
          <Table
            rowKey="id"
            columns={[
              { title: '用户 ID', dataIndex: 'userId', key: 'userId', ellipsis: true, width: 200 },
              { 
                title: '操作', 
                dataIndex: 'action', 
                key: 'action',
                render: (action) => {
                  const labels = { created: '创建', upgraded: '升级', downgraded: '降级', renewed: '续费', cancelled: '取消' };
                  return labels[action] || action;
                }
              },
              { title: '金额 ($)', dataIndex: 'amount', key: 'amount' },
              { 
                title: '时间', 
                dataIndex: 'createdAt', 
                key: 'createdAt',
                render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm')
              },
            ]}
            dataSource={subscriptionHistory}
            loading={loadingSubs}
            pagination={{ pageSize: 5, hideOnSinglePage: true }}
            className="binance-table"
            size="small"
          />
        </div>
      </div>
    );
  };

  // 渲染兑换码管理内容
  const renderRedemptionTab = () => {
    const codeStats = {
      total: redemptionCodes.length,
      active: redemptionCodes.filter(c => c.isActive && c.usedCount < c.maxUses).length,
      used: redemptionCodes.reduce((sum, c) => sum + c.usedCount, 0),
      expired: redemptionCodes.filter(c => !c.isActive || (c.expiresAt && new Date(c.expiresAt) < new Date())).length,
    };

    const codeColumns = [
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>兑换码</span>,
        dataIndex: 'code',
        key: 'code',
        render: (code) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ 
              fontSize: 12, 
              fontFamily: 'var(--font-mono)', 
              fontWeight: 600, 
              color: 'var(--color-brand)',
              background: 'var(--color-brand-bg)',
              padding: '4px 8px',
              borderRadius: 4,
              letterSpacing: '0.05em',
            }}>
              {code}
            </code>
            <Tooltip title="复制">
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(code)}
                style={{ color: 'var(--text-tertiary)' }}
              />
            </Tooltip>
          </div>
        ),
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>计划</span>,
        dataIndex: 'planName',
        key: 'planName',
        width: 100,
        render: (planName) => {
          const colors = {
            free: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
            pro: { bg: 'var(--color-brand-bg)', color: 'var(--color-brand)' },
            elite: { bg: 'rgba(124, 58, 237, 0.15)', color: '#a855f7' },
          };
          const style = colors[planName] || colors.pro;
          const labels = { free: '免费版', pro: '专业版', elite: '精英版' };
          return <Tag style={{ background: style.bg, color: style.color, border: 'none' }}>{labels[planName] || planName}</Tag>;
        },
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>时长</span>,
        dataIndex: 'durationDays',
        key: 'durationDays',
        width: 80,
        render: (days) => <span style={{ color: 'var(--text-secondary)' }}>{days} 天</span>,
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>使用次数</span>,
        key: 'usage',
        width: 100,
        render: (_, record) => (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <span style={{ color: record.usedCount >= record.maxUses ? 'var(--color-loss)' : 'var(--color-profit)' }}>{record.usedCount}</span>
            <span style={{ color: 'var(--text-tertiary)' }}> / {record.maxUses}</span>
          </span>
        ),
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>状态</span>,
        key: 'status',
        width: 80,
        render: (_, record) => {
          const isExpired = record.expiresAt && new Date(record.expiresAt) < new Date();
          const isUsedUp = record.usedCount >= record.maxUses;
          
          let status = { label: '有效', bg: 'var(--color-profit-bg)', color: 'var(--color-profit)' };
          if (!record.isActive) {
            status = { label: '已禁用', bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' };
          } else if (isExpired) {
            status = { label: '已过期', bg: 'var(--color-loss-bg)', color: 'var(--color-loss)' };
          } else if (isUsedUp) {
            status = { label: '已用完', bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' };
          }
          
          return <Tag style={{ background: status.bg, color: status.color, border: 'none' }}>{status.label}</Tag>;
        },
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>过期时间</span>,
        dataIndex: 'expiresAt',
        key: 'expiresAt',
        width: 120,
        render: (date) => (
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {date ? dayjs(date).format('YYYY-MM-DD') : '永不过期'}
          </span>
        ),
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>备注</span>,
        dataIndex: 'note',
        key: 'note',
        ellipsis: true,
        render: (note) => <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{note || '-'}</span>,
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>创建时间</span>,
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 120,
        render: (date) => (
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {dayjs(date).format('YYYY-MM-DD HH:mm')}
          </span>
        ),
      },
      {
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>操作</span>,
        key: 'actions',
        width: 120,
        render: (_, record) => (
          <Space size={4}>
            <Tooltip title={record.isActive ? '禁用' : '启用'}>
              <Button 
                type="text" 
                size="small" 
                icon={record.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                onClick={() => handleToggleCodeStatus(record.id, record.isActive)}
                style={{ color: record.isActive ? 'var(--color-loss)' : 'var(--color-profit)' }}
              />
            </Tooltip>
            <Popconfirm
              title="确定删除此兑换码？"
              onConfirm={() => handleDeleteCode(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* 兑换码统计 */}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GiftOutlined style={{ fontSize: 22, color: 'var(--color-brand)' }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{codeStats.total}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>总兑换码</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-profit-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 22, color: 'var(--color-profit)' }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{codeStats.active}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>可用</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HistoryOutlined style={{ fontSize: 22, color: 'var(--color-brand)' }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{codeStats.used}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>已使用次数</div>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={statCardStyle}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StopOutlined style={{ fontSize: 22, color: 'var(--text-tertiary)' }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{codeStats.expired}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>已失效</div>
              </div>
            </div>
          </Col>
        </Row>

        {/* 兑换码列表 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--color-brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GiftOutlined style={{ color: 'var(--color-brand)', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>兑换码管理</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>生成和管理订阅兑换码</div>
              </div>
            </div>
            <Space size={12}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setGenerateCodeModal(true)}
              >
                生成兑换码
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadRedemptionCodes} loading={loadingCodes}>
                刷新
              </Button>
            </Space>
          </div>
          <Table
            rowKey="id"
            columns={codeColumns}
            dataSource={redemptionCodes}
            loading={loadingCodes}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            className="binance-table"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: 'var(--text-tertiary)' }}>暂无兑换码</span>} /> }}
            scroll={{ x: 1000 }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'users', label: <span><UserOutlined /> 用户管理</span>, children: renderUsersTab() },
          { key: 'subscriptions', label: <span><DollarOutlined /> 订阅管理</span>, children: renderSubscriptionsTab() },
          { key: 'redemption', label: <span><GiftOutlined /> 兑换码</span>, children: renderRedemptionTab() },
        ]}
      />

      {/* 添加订阅模态框 */}
      <Modal
        title="添加订阅"
        open={addSubModal.visible}
        onCancel={() => setAddSubModal({ visible: false, userId: '' })}
        footer={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>选择用户</label>
            <Select
              placeholder="选择用户"
              style={{ width: '100%' }}
              value={addSubModal.userId || undefined}
              onChange={(v) => setAddSubModal(prev => ({ ...prev, userId: v }))}
              options={users.map(u => ({ value: u.id, label: u.email }))}
              showSearch
              filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>选择计划</label>
            <Select
              placeholder="选择计划"
              style={{ width: '100%' }}
              options={plans.filter(p => p.name !== 'free').map(p => ({ value: p.name, label: p.displayName }))}
              onChange={(planName) => {
                if (addSubModal.userId) {
                  createSubscription(addSubModal.userId, planName, 'monthly');
                } else {
                  message.warning('请先选择用户');
                }
              }}
            />
          </div>
        </div>
      </Modal>

      {/* 编辑订阅模态框 */}
      <Modal
        title="编辑订阅"
        open={editSubModal.visible}
        onCancel={() => setEditSubModal({ visible: false, subscription: null })}
        footer={null}
      >
        {editSubModal.subscription && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>用户</label>
              <Input value={editSubModal.subscription.user?.email} disabled />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>计划</label>
              <Select
                style={{ width: '100%' }}
                defaultValue={editSubModal.subscription.plan?.name}
                options={plans.map(p => ({ value: p.name, label: p.displayName }))}
                onChange={(planName) => updateSubscription(editSubModal.subscription.userId, { planName })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>状态</label>
              <Select
                style={{ width: '100%' }}
                defaultValue={editSubModal.subscription.status}
                options={[
                  { value: 'active', label: '活跃' },
                  { value: 'cancelled', label: '已取消' },
                  { value: 'expired', label: '已过期' },
                  { value: 'trial', label: '试用' },
                ]}
                onChange={(status) => updateSubscription(editSubModal.subscription.userId, { status })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>延长天数</label>
              <Space>
                <InputNumber 
                  placeholder="天数" 
                  min={1} 
                  style={{ width: 100 }}
                  onChange={(days) => {
                    if (days > 0) {
                      updateSubscription(editSubModal.subscription.userId, { extendDays: days });
                    }
                  }}
                />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>输入天数后自动延长</span>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* 生成兑换码模态框 */}
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
              <GiftOutlined style={{ color: 'var(--color-brand)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>生成兑换码</span>
          </div>
        }
        open={generateCodeModal}
        onOk={handleGenerateCodes}
        onCancel={() => { setGenerateCodeModal(false); generateForm.resetFields(); }}
        okText="生成"
        cancelText="取消"
        destroyOnClose
        width={480}
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
        <Form form={generateForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="planName"
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>订阅计划</span>}
                rules={[{ required: true, message: '请选择订阅计划' }]}
              >
                <Select
                  placeholder="选择计划"
                  options={plans.filter(p => p.name !== 'free').map(p => ({ value: p.name, label: p.displayName }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="durationDays"
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>订阅时长 (天)</span>}
                rules={[{ required: true, message: '请输入订阅时长' }]}
              >
                <InputNumber min={1} max={3650} style={{ width: '100%' }} placeholder="例如：30" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="count"
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>生成数量</span>}
                initialValue={1}
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maxUses"
                label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>每码使用次数</span>}
                initialValue={1}
              >
                <InputNumber min={1} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="expiresAt"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>过期时间 (可选)</span>}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              placeholder="留空则永不过期"
              showTime={false}
            />
          </Form.Item>
          <Form.Item
            name="note"
            label={<span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>备注 (可选)</span>}
          >
            <Input placeholder="例如：活动赠送、测试用" />
          </Form.Item>
          <div style={{ 
            padding: 12, 
            background: 'var(--bg-tertiary)', 
            borderRadius: 6, 
            border: '1px solid var(--border-primary)',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            💡 提示：生成的兑换码格式为 XXXX-XXXX-XXXX，用户可在设置页面进行兑换。
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Admin;
