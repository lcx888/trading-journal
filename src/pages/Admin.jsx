import { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Select, message, Button, Input, Space, Row, Col, Empty } from 'antd';
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
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchText, setSearchText] = useState('');

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

  useEffect(() => {
    loadUsers();
  }, []);

  const updateUser = async (id, updates) => {
    try {
      await apiRequest(`/admin/users/${id}`, { method: 'PATCH', body: updates });
      message.success('已更新');
      loadUsers();
    } catch (e) {
      message.error(e.message || '更新失败');
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

  // 获取状态标签样式
  const getStatusTagStyle = (status) => {
    if (status === 'active') {
      return { background: 'var(--color-profit-bg)', color: 'var(--color-profit)', border: 'none' };
    }
    return { background: 'var(--color-loss-bg)', color: 'var(--color-loss)', border: 'none' };
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 统计卡片区域 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 8, 
              background: 'var(--color-brand-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <TeamOutlined style={{ fontSize: 22, color: 'var(--color-brand)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {stats.totalUsers}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>总用户数</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 8, 
              background: 'var(--color-profit-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <SafetyCertificateOutlined style={{ fontSize: 22, color: 'var(--color-profit)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {stats.adminCount}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>管理员</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 8, 
              background: 'var(--color-profit-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <CheckCircleOutlined style={{ fontSize: 22, color: 'var(--color-profit)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {stats.activeCount}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>活跃用户</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div style={statCardStyle}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 8, 
              background: 'var(--color-brand-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <MailOutlined style={{ fontSize: 22, color: 'var(--color-brand)' }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {stats.verifiedCount}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>已验证邮箱</div>
            </div>
          </div>
        </Col>
      </Row>

      {/* 用户管理表格 */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
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
              style={{ 
                width: 200, 
                background: 'var(--bg-tertiary)', 
                borderColor: 'var(--border-primary)',
                borderRadius: 4
              }}
              allowClear
            />
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadUsers}
              loading={loading}
              style={{ 
                borderColor: 'var(--border-primary)', 
                color: 'var(--text-secondary)',
                borderRadius: 4
              }}
            >
              刷新
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredUsers}
          loading={loading}
          pagination={{ 
            pageSize: 10, 
            hideOnSinglePage: true,
            showTotal: (total) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>共 {total} 条</span>
          }}
          className="binance-table"
          locale={{ 
            emptyText: (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description={<span style={{ color: 'var(--text-tertiary)' }}>暂无用户数据</span>} 
              />
            ) 
          }}
        />
      </div>

      {/* 权限说明 */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ 
            width: 32, 
            height: 32, 
            borderRadius: 4, 
            background: 'var(--bg-tertiary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <SafetyCertificateOutlined style={{ color: 'var(--text-secondary)' }} />
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>权限说明</span>
        </div>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <div style={{ 
              padding: 16, 
              background: 'var(--bg-tertiary)', 
              borderRadius: 6,
              borderLeft: '3px solid var(--text-tertiary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <UserOutlined style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>普通用户</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.8 }}>
                <li>可查看个人交易数据</li>
                <li>可使用 AI 分析功能</li>
                <li>可导入交易记录</li>
              </ul>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ 
              padding: 16, 
              background: 'var(--color-profit-bg)', 
              borderRadius: 6,
              borderLeft: '3px solid var(--color-profit)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <SafetyCertificateOutlined style={{ color: 'var(--color-profit)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>管理员</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.8 }}>
                <li>拥有普通用户所有权限</li>
                <li>可查看用户列表</li>
                <li>可管理普通用户状态</li>
              </ul>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ 
              padding: 16, 
              background: 'var(--color-brand-bg)', 
              borderRadius: 6,
              borderLeft: '3px solid var(--color-brand)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CrownOutlined style={{ color: 'var(--color-brand)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>超级管理员</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.8 }}>
                <li>拥有管理员所有权限</li>
                <li>可设置用户角色</li>
                <li>可管理所有用户</li>
              </ul>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Admin;
