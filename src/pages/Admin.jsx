import { useEffect, useState } from 'react';
import { Card, Table, Tag, Select, message, Button } from 'antd';
import { apiRequest } from '../services/api';

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

  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (v) => <span className="font-bold text-[#131722]">{v}</span>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role, record) => (
        <Select
          value={role}
          size="small"
          options={ROLE_OPTIONS}
          onChange={(value) => updateUser(record.id, { role: value })}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status, record) => (
        <Select
          value={status}
          size="small"
          options={STATUS_OPTIONS}
          onChange={(value) => updateUser(record.id, { status: value })}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v) => <span className="text-xs text-slate-500">{new Date(v).toLocaleString()}</span>,
    },
    {
      title: '标记',
      key: 'tag',
      render: (_, record) => (
        <Tag color={record.role === 'admin' || record.role === 'superadmin' ? 'blue' : 'default'}>
          {record.role === 'admin' ? '管理员' : record.role === 'superadmin' ? '超级管理员' : '用户'}
        </Tag>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in">
      <Card className="modern-card" bordered={false}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-[#131722]">用户管理</div>
          <Button size="small" onClick={loadUsers}>刷新</Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      </Card>
    </div>
  );
};

export default Admin;
