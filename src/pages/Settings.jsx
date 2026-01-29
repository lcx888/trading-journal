import { useState, useEffect } from 'react';
import { 
  Form, Input, InputNumber, Button, Table, Space, 
  message, Modal, Popconfirm, Tag, Empty, Select, Spin
} from 'antd';
import {
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  GiftOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StorageService from '../services/storage';
import { getMe, changePassword, changeEmail, resendVerification, deleteAccount } from '../services/auth';
import { redeemCode, clearSubscriptionCache, getPlanDisplayInfo } from '../services/subscription';
import { fixHoldingTimes } from '../utils/debugHoldingTime';

// 常用时区列表
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: '香港时间 (UTC+8)' },
  { value: 'Asia/Tokyo', label: '日本时间 (UTC+9)' },
  { value: 'Europe/London', label: '伦敦时间 (UTC+0/+1)' },
  { value: 'America/New_York', label: '纽约时间 (UTC-5/-4)' },
  { value: 'America/Chicago', label: '芝加哥时间 (UTC-6/-5)' },
];

const Settings = ({ onLogout, subscription, onUpgrade }) => {
  const [instruments, setInstruments] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataStats, setDataStats] = useState({ trades: 0, imports: 0 });
  const [traderName, setTraderName] = useState('');
  const [userTimezone, setUserTimezone] = useState('Asia/Shanghai');
  const [dataSourceTimezone, setDataSourceTimezone] = useState('Asia/Shanghai');
  const [userInfo, setUserInfo] = useState(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState(null);
  const [form] = Form.useForm();

  // Modals
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [emailForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [redeemForm] = Form.useForm();

  useEffect(() => { loadData(); }, []);

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
      setDataStats({ trades: trades.length, imports: history.length, instruments: instrumentList.length });
      setUserInfo(user);
      setTraderName(StorageService.getTraderName());
      setUserTimezone(StorageService.getUserTimezone());
      setDataSourceTimezone(StorageService.getDataSourceTimezone());
    } catch (error) {
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTraderNameChange = (name) => {
    StorageService.setTraderName(name);
    message.success('交易员名称已保存');
  };

  const handleTimezoneChange = (tz) => {
    setUserTimezone(tz);
    StorageService.setUserTimezone(tz);
    message.success('时区设置已保存');
  };

  const handleDataSourceTimezoneChange = (tz) => {
    setDataSourceTimezone(tz);
    StorageService.setDataSourceTimezone(tz);
    message.success('数据源时区已保存');
  };

  // 品种管理
  const handleEditInstrument = (instrument) => {
    setEditingInstrument(instrument);
    form.setFieldsValue(instrument);
    setEditModalVisible(true);
  };

  const handleDeleteInstrument = async (code) => {
    try {
      await StorageService.deleteInstrument(code);
      message.success('品种已删除');
      loadData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleSaveInstrument = async () => {
    try {
      const values = await form.validateFields();
      if (editingInstrument) {
        await StorageService.updateInstrument(editingInstrument.code, values);
        message.success('品种已更新');
      } else {
        await StorageService.addInstrument(values);
        message.success('品种已添加');
      }
      setEditModalVisible(false);
      form.resetFields();
      setEditingInstrument(null);
      loadData();
    } catch (e) {
      message.error('保存失败');
    }
  };

  // 账户安全
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

  const handleChangeEmail = async () => {
    try {
      const values = await emailForm.validateFields();
      setSecurityLoading(true);
      await changeEmail(values.newEmail, values.password);
      message.success('验证邮件已发送到新邮箱');
      setEmailModalVisible(false);
      emailForm.resetFields();
    } catch (e) {
      message.error(e.message || '修改失败');
    } finally {
      setSecurityLoading(false);
    }
  };

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

  const handleRedeemCode = async () => {
    try {
      const values = await redeemForm.validateFields();
      setRedeemLoading(true);
      const result = await redeemCode(values.code);
      message.success(result.message || '兑换成功！');
      setRedeemModalVisible(false);
      redeemForm.resetFields();
      clearSubscriptionCache();
      window.location.reload();
    } catch (e) {
      message.error(e.message || '兑换失败');
    } finally {
      setRedeemLoading(false);
    }
  };

  // 系统维护
  const handleFixHoldingTimes = async () => {
    try {
      await fixHoldingTimes();
      message.success('持仓时长已修复');
    } catch (e) {
      message.error('修复失败');
    }
  };

  const handleClearAllData = async () => {
    Modal.confirm({
      title: '确认清空所有数据？',
      content: '此操作将删除所有交易记录、品种配置和导入历史。此操作不可恢复！',
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await StorageService.clearAllData();
          message.success('数据已清空');
          loadData();
        } catch (e) {
          message.error('清空失败');
        }
      },
    });
  };

  // 品种表格列
  const instrumentColumns = [
    { title: '代码', dataIndex: 'code', key: 'code', width: 70, render: v => <span className="font-mono text-[var(--text-primary)]">{v}</span> },
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Tick值', dataIndex: 'tickValue', key: 'tickValue', width: 70, render: v => <span className="font-mono">${v}</span> },
    { title: '手续费', dataIndex: 'feeRate', key: 'feeRate', width: 70, render: v => <span className="font-mono">${v ?? 0}</span> },
    { title: 'ATAS匹配', dataIndex: 'atasPattern', key: 'atasPattern', width: 100, ellipsis: true, render: v => v ? <span className="font-mono text-xs opacity-60">{v}</span> : '-' },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" className="text-[var(--text-tertiary)] hover:text-[var(--color-brand)]" icon={<EditOutlined />} onClick={() => handleEditInstrument(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteInstrument(record.code)} okText="删除" cancelText="取消">
            <Button type="text" size="small" className="text-[var(--text-tertiary)] hover:text-red-500" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 导入记录列
  const historyColumns = [
    { title: '文件名', dataIndex: 'filename', key: 'filename', ellipsis: true },
    { 
      title: '类型', 
      dataIndex: 'fileType', 
      key: 'fileType', 
      width: 70, 
      render: v => {
        const type = v || 'atas';
        return (
          <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
            type === 'jigsaw' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
          }`}>
            {type}
          </span>
        );
      }
    },
    { 
      title: '账本', 
      dataIndex: 'recordName', 
      key: 'recordName', 
      width: 100, 
      ellipsis: true,
      render: v => v || <span className="opacity-40">-</span>
    },
    { 
      title: '笔数', 
      dataIndex: 'tradesCount', 
      key: 'tradesCount', 
      width: 60, 
      render: v => <span className="font-mono">{v ?? 0}</span>
    },
    { 
      title: '盈亏', 
      dataIndex: 'totalPnL', 
      key: 'totalPnL', 
      width: 90, 
      render: v => v != null ? (
        <span className={`font-mono ${v >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      ) : <span className="opacity-40">-</span>
    },
    { 
      title: '导入时间', 
      dataIndex: 'importDate', 
      key: 'importDate', 
      width: 130, 
      render: v => <span className="text-xs opacity-70">{dayjs(v).format('MM-DD HH:mm')}</span>
    },
  ];

  if (loading) return <div className="p-12 text-center"><Spin /></div>;

  const planName = subscription?.plan?.name || 'free';
  const isFreePlan = planName === 'free';

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8">
      {/* 顶部标题 */}
      <div className="border-b border-[var(--border-primary)] pb-6">
        <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)] mb-1">系统设置</h1>
        <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.15em]">Configuration & Preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：主要配置 */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 个人信息 + 时区 */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
            <h3 className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-1 h-3 bg-[var(--color-brand)] rounded-full" />
              个人信息与偏好
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">交易员名称</label>
                <Input
                  value={traderName}
                  onChange={(e) => setTraderName(e.target.value)}
                  onBlur={(e) => handleTraderNameChange(e.target.value)}
                  placeholder="设置您的专属称呼"
                  className="bg-[var(--bg-tertiary)] border-[var(--border-primary)] hover:border-[var(--text-secondary)] focus:border-[var(--color-brand)]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">账户邮箱</label>
                <div className="flex items-center gap-2">
                  <Input value={userInfo?.email || ''} disabled className="bg-[var(--bg-tertiary)] border-[var(--border-primary)] flex-1 opacity-60" />
                  <Button size="small" className="bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]" onClick={() => setEmailModalVisible(true)}>修改</Button>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">交易软件时区</label>
                <Select value={dataSourceTimezone} onChange={handleDataSourceTimezoneChange} className="w-full" options={TIMEZONE_OPTIONS} bordered={false} style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }} />
                <p className="text-[9px] text-[var(--text-tertiary)] mt-1">匹配 ATAS/Jigsaw 导出数据的时区</p>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest block mb-2">显示时区</label>
                <Select value={userTimezone} onChange={handleTimezoneChange} className="w-full" options={TIMEZONE_OPTIONS} bordered={false} style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }} />
                <p className="text-[9px] text-[var(--text-tertiary)] mt-1">网页端数据展示的本地时间</p>
              </div>
            </div>
          </div>

          {/* 品种管理 */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-3 bg-[var(--color-brand)] rounded-full" />
                交易品种管理
              </h3>
              <Button size="small" className="bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]" icon={<PlusOutlined />} onClick={() => { setEditingInstrument(null); form.resetFields(); setEditModalVisible(true); }}>
                添加品种
              </Button>
            </div>
            <Table
              columns={instrumentColumns}
              dataSource={instruments}
              rowKey="code"
              size="small"
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无品种配置" /> }}
            />
          </div>

          {/* 导入记录 */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
            <h3 className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-1 h-3 bg-[var(--color-brand)] rounded-full" />
              导入记录
            </h3>
            <Table
              columns={historyColumns}
              dataSource={importHistory}
              rowKey={(r) => `${r.importDate}-${r.filename}`}
              size="small"
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无导入记录" /> }}
            />
          </div>
        </div>

        {/* 右侧：订阅、安全、维护 */}
        <div className="space-y-8">
          
          {/* 订阅状态 */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
            <h3 className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <CrownOutlined className="text-[var(--color-brand)]" />
              订阅状态
            </h3>
            {(() => {
              const planInfo = getPlanDisplayInfo(planName);
              const plan = subscription?.plan || {};
              const usage = subscription?.usage || {};
              const expireDate = subscription?.expireDate || plan?.expireDate;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span 
                      className="text-lg font-semibold"
                      style={{ color: planInfo.color }}
                    >
                      {planInfo.displayName}
                    </span>
                    {!isFreePlan && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-profit)]/20 text-[var(--color-profit)] uppercase tracking-wider">
                        {subscription?.status || 'active'}
                      </span>
                    )}
                  </div>
                  
                  {/* 用量统计 */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">本月交易导入</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {usage.tradesUsedThisMonth ?? 0} / {plan.maxTradesPerMonth === -1 ? '∞' : (plan.maxTradesPerMonth ?? 50)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">本月AI分析</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {usage.aiAnalysisUsedThisMonth ?? 0} / {plan.maxAiAnalysisPerMonth === -1 ? '∞' : (plan.maxAiAnalysisPerMonth ?? 2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">账本数量</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {dataStats.imports ?? 0} / {plan.maxRecords === -1 ? '∞' : (plan.maxRecords ?? 1)}
                      </span>
                    </div>
                    {expireDate && (
                      <div className="flex justify-between pt-2 border-t border-[var(--border-primary)]">
                        <span className="text-[var(--text-tertiary)]">有效期</span>
                        <span className="text-[var(--text-secondary)]">
                          {dayjs(expireDate).format('YYYY-MM-DD')}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* 功能权限 */}
                  <div className="mb-4 text-[10px] text-[var(--text-tertiary)] space-y-1">
                    <div className="flex items-center gap-1">
                      <CheckCircleOutlined className={plan.hasSmartDiagnosis ? 'text-[var(--color-profit)]' : 'opacity-30'} />
                      <span className={plan.hasSmartDiagnosis ? '' : 'opacity-50'}>智能诊断</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircleOutlined className={plan.hasMonteCarlo ? 'text-[var(--color-profit)]' : 'opacity-30'} />
                      <span className={plan.hasMonteCarlo ? '' : 'opacity-50'}>蒙特卡洛模拟</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircleOutlined className={plan.hasOptimalStopLoss ? 'text-[var(--color-profit)]' : 'opacity-30'} />
                      <span className={plan.hasOptimalStopLoss ? '' : 'opacity-50'}>最优止损分析</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {isFreePlan && (
                      <Button block className="bg-[var(--color-brand)] border-none text-[var(--bg-primary)] font-bold h-10 hover:opacity-90" icon={<RocketOutlined />} onClick={onUpgrade}>
                        升级到 Pro
                      </Button>
                    )}
                    <Button block className="bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]" icon={<GiftOutlined />} onClick={() => setRedeemModalVisible(true)}>
                      兑换序列号
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 数据概览 */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
            <h3 className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider mb-4">数据统计</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-mono text-[var(--text-primary)] font-light">{dataStats.trades}</div>
                <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest">交易笔数</div>
              </div>
              <div>
                <div className="text-xl font-mono text-[var(--text-primary)] font-light">{dataStats.imports}</div>
                <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest">导入次数</div>
              </div>
              <div>
                <div className="text-xl font-mono text-[var(--text-primary)] font-light">{instruments.length}</div>
                <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest">品种配置</div>
              </div>
            </div>
          </div>

          {/* 账户安全 */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
            <h3 className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider mb-4">账户安全</h3>
            {userInfo && !userInfo.emailVerified && (
              <div className="bg-[var(--color-brand-bg)] border border-[var(--color-brand)] rounded p-3 mb-4 flex items-start gap-2">
                <WarningOutlined className="text-[var(--color-brand)] mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs text-[var(--color-brand)] font-medium">邮箱未验证</div>
                  <Button size="small" type="link" onClick={handleResendVerification} loading={securityLoading} className="p-0 h-auto text-xs text-[var(--color-brand)] hover:opacity-80">
                    发送验证邮件
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Button block size="small" className="bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]" onClick={() => setPasswordModalVisible(true)}>修改密码</Button>
            </div>
          </div>

          {/* 系统维护 */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
            <h3 className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <ToolOutlined className="opacity-60" />
              系统维护
            </h3>
            <div className="space-y-2">
              <Button block size="small" className="bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]" onClick={handleFixHoldingTimes}>修复持仓时长</Button>
            </div>
            
            {/* 危险操作 - 极简显示 */}
            <div className="mt-6 pt-4 border-t border-[var(--border-primary)]">
              <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest mb-3 opacity-40">Danger Zone</div>
              <div className="flex gap-2">
                <button 
                  onClick={handleClearAllData}
                  className="flex-1 text-[10px] text-[var(--text-tertiary)] hover:text-red-500/80 py-2 transition-colors border border-[var(--border-primary)] rounded hover:border-red-500/30"
                >
                  清空数据
                </button>
                <button 
                  onClick={() => setDeleteModalVisible(true)}
                  className="flex-1 text-[10px] text-[var(--text-tertiary)] hover:text-red-500/80 py-2 transition-colors border border-[var(--border-primary)] rounded hover:border-red-500/30"
                >
                  注销账户
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 品种编辑弹窗 */}
      <Modal
        title={editingInstrument ? '编辑品种' : '添加品种'}
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); form.resetFields(); setEditingInstrument(null); }}
        onOk={handleSaveInstrument}
        okText="保存"
        cancelText="取消"
        width={480}
        className="minimal-modal"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="code" label={<span className="text-[10px] uppercase tracking-widest opacity-60">品种代码</span>} rules={[{ required: true }]} className="mb-3">
              <Input disabled={!!editingInstrument} placeholder="如 ES, NQ, GC" className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
            </Form.Item>
            <Form.Item name="name" label={<span className="text-[10px] uppercase tracking-widest opacity-60">品种名称</span>} rules={[{ required: true }]} className="mb-3">
              <Input placeholder="如 E-mini S&P 500" className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="tickValue" label={<span className="text-[10px] uppercase tracking-widest opacity-60">每Tick价值 ($)</span>} rules={[{ required: true }]} className="mb-3">
              <InputNumber min={0} step={0.01} className="w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)]" placeholder="如 12.5" />
            </Form.Item>
            <Form.Item name="feeRate" label={<span className="text-[10px] uppercase tracking-widest opacity-60">单边手续费 ($)</span>} rules={[{ required: true }]} className="mb-3">
              <InputNumber min={0} step={0.01} className="w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)]" placeholder="如 2.5" />
            </Form.Item>
          </div>
          <Form.Item 
            name="atasPattern" 
            label={<span className="text-[10px] uppercase tracking-widest opacity-60">ATAS匹配模式</span>} 
            className="mb-0"
            tooltip="用于自动识别ATAS导入文件中的品种代码"
          >
            <Input placeholder="如 ^GC[A-Z]\\d$ （可选）" className="font-mono bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改邮箱 */}
      <Modal title="修改邮箱" open={emailModalVisible} onCancel={() => setEmailModalVisible(false)} footer={null} className="minimal-modal">
        <Form form={emailForm} layout="vertical" onFinish={handleChangeEmail} className="mt-4">
          <Form.Item name="newEmail" label={<span className="text-[10px] uppercase tracking-widest opacity-60">新邮箱地址</span>} rules={[{ required: true, type: 'email' }]}>
            <Input className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
          </Form.Item>
          <Form.Item name="password" label={<span className="text-[10px] uppercase tracking-widest opacity-60">登录密码</span>} rules={[{ required: true }]}>
            <Input.Password className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
          </Form.Item>
          <Button block className="bg-[var(--color-brand)] border-none text-[var(--bg-primary)] font-bold h-10 mt-4" htmlType="submit" loading={securityLoading}>确认修改</Button>
        </Form>
      </Modal>

      {/* 修改密码 */}
      <Modal title="修改密码" open={passwordModalVisible} onCancel={() => setPasswordModalVisible(false)} footer={null} className="minimal-modal">
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword} className="mt-4">
          <Form.Item name="currentPassword" label={<span className="text-[10px] uppercase tracking-widest opacity-60">当前密码</span>} rules={[{ required: true }]}>
            <Input.Password className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
          </Form.Item>
          <Form.Item name="newPassword" label={<span className="text-[10px] uppercase tracking-widest opacity-60">新密码</span>} rules={[{ required: true, min: 6 }]}>
            <Input.Password className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
          </Form.Item>
          <Button block className="bg-[var(--color-brand)] border-none text-[var(--bg-primary)] font-bold h-10 mt-4" htmlType="submit" loading={securityLoading}>确认修改</Button>
        </Form>
      </Modal>

      {/* 兑换序列号 */}
      <Modal title="兑换序列号" open={redeemModalVisible} onCancel={() => setRedeemModalVisible(false)} footer={null} className="minimal-modal">
        <Form form={redeemForm} layout="vertical" onFinish={handleRedeemCode} className="mt-4">
          <Form.Item name="code" label={<span className="text-[10px] uppercase tracking-widest opacity-60">兑换码</span>} rules={[{ required: true }]}>
            <Input placeholder="XXXX-XXXX-XXXX-XXXX" className="font-mono bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
          </Form.Item>
          <Button block className="bg-[var(--color-brand)] border-none text-[var(--bg-primary)] font-bold h-10 mt-4" htmlType="submit" loading={redeemLoading}>立即兑换</Button>
        </Form>
      </Modal>

      {/* 注销账户 */}
      <Modal title={<span className="text-red-500 font-light">注销账户</span>} open={deleteModalVisible} onCancel={() => setDeleteModalVisible(false)} footer={null} className="minimal-modal">
        <div className="mt-4">
          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded text-[11px] text-red-500/80 mb-6 leading-relaxed">
            警告：此操作不可逆。注销后，您的所有数据将被永久删除。
          </div>
          <Form form={deleteForm} layout="vertical" onFinish={handleDeleteAccount}>
            <Form.Item name="password" label={<span className="text-[10px] uppercase tracking-widest opacity-60">请输入密码确认</span>} rules={[{ required: true }]}>
              <Input.Password className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
            </Form.Item>
            <Form.Item name="confirmText" label={<span className="text-[10px] uppercase tracking-widest opacity-60">请输入 "DELETE" 确认</span>} rules={[{ required: true, pattern: /^DELETE$/, message: '请输入 DELETE' }]}>
              <Input className="bg-[var(--bg-tertiary)] border-[var(--border-primary)]" />
            </Form.Item>
            <Button block danger type="primary" className="h-10 mt-4 font-bold" htmlType="submit" loading={securityLoading}>确认永久注销</Button>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
