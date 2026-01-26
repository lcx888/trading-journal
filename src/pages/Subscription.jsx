import { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Modal, 
  message, 
  Progress, 
  Alert,
  Divider,
  Row,
  Col,
  Statistic,
  Tooltip,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CrownOutlined,
  RocketOutlined,
  ShopOutlined,
  GiftOutlined,
  ArrowUpOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { 
  SUBSCRIPTION_PLANS, 
  getSubscriptionPlan, 
  isSubscriptionActive,
  formatPrice,
  getSubscriptionLimits,
} from '../services/subscription';
import { getMe } from '../services/auth';
import api from '../services/api';

const Subscription = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [usageStats, setUsageStats] = useState({
    records: 0,
    trades: 0,
    aiAnalysis: 0,
    monteCarlo: 0,
    stopLoss: 0,
  });

  useEffect(() => {
    loadUserData();
    loadUsageStats();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await getMe();
      setUser(userData);
    } catch (error) {
      message.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async () => {
    try {
      // TODO: 从服务器获取使用统计
      // const stats = await api.get('/subscription/usage');
      // setUsageStats(stats);
    } catch (error) {
      console.error('加载使用统计失败:', error);
    }
  };

  const currentPlan = getSubscriptionPlan(user);
  const isActive = isSubscriptionActive(user);
  const limits = getSubscriptionLimits(user);

  const plans = [
    {
      key: 'free',
      name: '免费版',
      icon: <GiftOutlined />,
      price: 0,
      popular: false,
    },
    {
      key: 'basic',
      name: '基础版',
      icon: <ShopOutlined />,
      price: 99,
      yearlyPrice: 899,
      popular: true,
    },
    {
      key: 'pro',
      name: '专业版',
      icon: <RocketOutlined />,
      price: 299,
      yearlyPrice: 2699,
      popular: false,
    },
    {
      key: 'enterprise',
      name: '企业版',
      icon: <CrownOutlined />,
      price: 999,
      yearlyPrice: 9999,
      popular: false,
    },
  ];

  const handleUpgrade = (planKey) => {
    setSelectedPlan(planKey);
    setUpgradeModalVisible(true);
  };

  const handleConfirmUpgrade = async () => {
    try {
      // TODO: 调用支付接口
      message.info('支付功能开发中，请联系客服');
      setUpgradeModalVisible(false);
    } catch (error) {
      message.error('升级失败：' + error.message);
    }
  };

  const getUsagePercentage = (used, limit) => {
    if (limit === -1) return 0; // 无限
    if (limit === 0) return 100;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageStatus = (used, limit) => {
    if (limit === -1) return 'success';
    const percentage = getUsagePercentage(used, limit);
    if (percentage >= 90) return 'exception';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  if (loading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#fff] mb-2">订阅管理</h1>
        <p className="text-[#888]">管理您的订阅计划和使用情况</p>
      </div>

      {/* 当前订阅状态 */}
      <Card className="mb-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{currentPlan.name === '免费版' ? <GiftOutlined /> : 
                currentPlan.name === '基础版' ? <ShopOutlined /> :
                currentPlan.name === '专业版' ? <RocketOutlined /> : <CrownOutlined />}</span>
              <div>
                <h2 className="text-xl font-bold text-[#fff] mb-1">{currentPlan.name}</h2>
                <div className="flex items-center gap-2">
                  <Tag color={isActive ? 'green' : 'red'}>
                    {isActive ? '已激活' : '已过期'}
                  </Tag>
                  {user?.subscriptionExpiresAt && (
                    <span className="text-sm text-[#888]">
                      到期时间：{new Date(user.subscriptionExpiresAt).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {currentPlan.price > 0 && (
              <p className="text-[#888] mt-2">
                当前价格：{formatPrice(currentPlan.price)}/月
                {currentPlan.name !== '企业版' && (
                  <span className="ml-2 text-[#666]">
                    （年付：{formatPrice(currentPlan.yearlyPrice || currentPlan.price * 12)}/年，节省 24%）
                  </span>
                )}
              </p>
            )}
          </div>
          {currentPlan.name !== '企业版' && (
            <Button 
              type="primary" 
              icon={<ArrowUpOutlined />}
              onClick={() => {
                const nextPlan = plans.find(p => p.key !== user?.subscriptionPlan && p.price > currentPlan.price);
                if (nextPlan) handleUpgrade(nextPlan.key);
              }}
            >
              升级计划
            </Button>
          )}
        </div>
      </Card>

      {/* 使用情况 */}
      <Card className="mb-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <h3 className="text-lg font-semibold text-[#fff] mb-4">使用情况</h3>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card size="small" style={{ background: '#0a0a0c', border: '1px solid #1a1a1f' }}>
              <Statistic
                title="账本数量"
                value={usageStats.records}
                suffix={`/ ${limits.maxRecords === -1 ? '∞' : limits.maxRecords}`}
                valueStyle={{ color: '#fff' }}
              />
              {limits.maxRecords !== -1 && (
                <Progress
                  percent={getUsagePercentage(usageStats.records, limits.maxRecords)}
                  status={getUsageStatus(usageStats.records, limits.maxRecords)}
                  size="small"
                  showInfo={false}
                  className="mt-2"
                />
              )}
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small" style={{ background: '#0a0a0c', border: '1px solid #1a1a1f' }}>
              <Statistic
                title="交易记录"
                value={usageStats.trades}
                suffix={`/ ${limits.maxTrades === -1 ? '∞' : limits.maxTrades}`}
                valueStyle={{ color: '#fff' }}
              />
              {limits.maxTrades !== -1 && (
                <Progress
                  percent={getUsagePercentage(usageStats.trades, limits.maxTrades)}
                  status={getUsageStatus(usageStats.trades, limits.maxTrades)}
                  size="small"
                  showInfo={false}
                  className="mt-2"
                />
              )}
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card size="small" style={{ background: '#0a0a0c', border: '1px solid #1a1a1f' }}>
              <Statistic
                title="AI 分析（本月）"
                value={usageStats.aiAnalysis}
                suffix={`/ ${limits.aiAnalysisPerMonth === -1 ? '∞' : limits.aiAnalysisPerMonth}`}
                valueStyle={{ color: '#fff' }}
              />
              {limits.aiAnalysisPerMonth !== -1 && (
                <Progress
                  percent={getUsagePercentage(usageStats.aiAnalysis, limits.aiAnalysisPerMonth)}
                  status={getUsageStatus(usageStats.aiAnalysis, limits.aiAnalysisPerMonth)}
                  size="small"
                  showInfo={false}
                  className="mt-2"
                />
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 订阅计划对比 */}
      <Card style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <h3 className="text-lg font-semibold text-[#fff] mb-4">订阅计划对比</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const planConfig = SUBSCRIPTION_PLANS[plan.key];
            const isCurrent = user?.subscriptionPlan === plan.key;
            const isUpgrade = plan.price > currentPlan.price;
            
            return (
              <Card
                key={plan.key}
                className={`relative ${plan.popular ? 'border-[#c9a227]' : ''}`}
                style={{ 
                  background: isCurrent ? '#0a0a0c' : '#111114',
                  border: plan.popular ? '2px solid #c9a227' : '1px solid #1a1a1f',
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Tag color="#c9a227" className="px-3">推荐</Tag>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-2 right-2">
                    <Tag color="green">当前计划</Tag>
                  </div>
                )}
                
                <div className="text-center mb-4">
                  <div className="text-3xl mb-2">{plan.icon}</div>
                  <h3 className="text-lg font-bold text-[#fff] mb-2">{plan.name}</h3>
                  <div className="mb-1">
                    <span className="text-2xl font-bold text-[#fff]">
                      {formatPrice(plan.price)}
                    </span>
                    <span className="text-[#888]">/月</span>
                  </div>
                  {plan.yearlyPrice && (
                    <div className="text-sm text-[#666]">
                      年付：{formatPrice(plan.yearlyPrice)}/年
                      <span className="text-[#c9a227] ml-1">节省 24%</span>
                    </div>
                  )}
                </div>

                <Divider style={{ borderColor: '#1a1a1f', margin: '16px 0' }} />

                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    {planConfig.features.maxRecords === -1 ? (
                      <CheckCircleOutlined className="text-[#10b981]" />
                    ) : (
                      <span className="text-[#888]">{planConfig.features.maxRecords}</span>
                    )}
                    <span className="text-[#888]">账本</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {planConfig.features.maxTrades === -1 ? (
                      <CheckCircleOutlined className="text-[#10b981]" />
                    ) : (
                      <span className="text-[#888]">{planConfig.features.maxTrades}</span>
                    )}
                    <span className="text-[#888]">交易记录</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {planConfig.features.aiAnalysisPerMonth === -1 ? (
                      <CheckCircleOutlined className="text-[#10b981]" />
                    ) : (
                      <span className="text-[#888]">{planConfig.features.aiAnalysisPerMonth}</span>
                    )}
                    <span className="text-[#888]">AI 分析/月</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {planConfig.features.hasAdvancedMetrics ? (
                      <CheckCircleOutlined className="text-[#10b981]" />
                    ) : (
                      <CloseCircleOutlined className="text-[#666]" />
                    )}
                    <span className="text-[#888]">高级指标</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {planConfig.features.hasCustomReports ? (
                      <CheckCircleOutlined className="text-[#10b981]" />
                    ) : (
                      <CloseCircleOutlined className="text-[#666]" />
                    )}
                    <span className="text-[#888]">自定义报告</span>
                  </div>
                  {plan.key === 'enterprise' && (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircleOutlined className="text-[#10b981]" />
                        <span className="text-[#888]">API 接口</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircleOutlined className="text-[#10b981]" />
                        <span className="text-[#888]">团队协作</span>
                      </div>
                    </>
                  )}
                </div>

                {!isCurrent && (
                  <Button
                    type={isUpgrade ? 'primary' : 'default'}
                    block
                    onClick={() => handleUpgrade(plan.key)}
                  >
                    {isUpgrade ? '升级' : '选择'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </Card>

      {/* 升级确认弹窗 */}
      <Modal
        title="确认升级"
        open={upgradeModalVisible}
        onOk={handleConfirmUpgrade}
        onCancel={() => setUpgradeModalVisible(false)}
        okText="确认支付"
        cancelText="取消"
      >
        {selectedPlan && (
          <div>
            <p className="mb-4">您将升级到：<strong>{SUBSCRIPTION_PLANS[selectedPlan].name}</strong></p>
            <p className="text-[#888]">支付功能开发中，请联系客服完成升级。</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Subscription;
