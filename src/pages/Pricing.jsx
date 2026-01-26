import React, { useState, useEffect } from 'react';
import { Button, Card, Tag, Switch, Spin, message, Modal, Tooltip } from 'antd';
import { 
  Check, 
  X, 
  Sparkles, 
  Zap, 
  Users, 
  Shield, 
  BarChart3, 
  Brain, 
  FileDown, 
  Code2,
  Crown,
  ArrowRight,
  Clock,
  Infinity as InfinityIcon
} from 'lucide-react';
import { getPlans, getSubscriptionStatus, createSubscription, cancelSubscription, getPlanDisplayInfo } from '../services/subscription';

const Pricing = ({ onNavigate }) => {
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData, subscriptionData] = await Promise.all([
        getPlans(),
        getSubscriptionStatus(true),
      ]);
      setPlans(plansData);
      setCurrentSubscription(subscriptionData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planName) => {
    if (planName === 'free') {
      message.info('您已在使用免费版');
      return;
    }

    // 暂时显示联系方式，后续接入支付
    Modal.confirm({
      title: '升级订阅',
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ marginBottom: 16 }}>
            感谢您选择 <strong>{planName === 'pro' ? '专业版' : '团队版'}</strong>！
          </p>
          <p style={{ marginBottom: 16 }}>
            价格：<strong>${billingCycle === 'yearly' 
              ? plans.find(p => p.name === planName)?.priceYearly 
              : plans.find(p => p.name === planName)?.priceMonthly}/{billingCycle === 'yearly' ? '年' : '月'}</strong>
          </p>
          <p style={{ color: '#666', marginBottom: 8 }}>
            支付功能即将上线，请联系我们手动开通：
          </p>
          <p style={{ color: '#d97706', fontWeight: 500 }}>
            📧 support@metworthai.com
          </p>
        </div>
      ),
      okText: '我知道了',
      cancelText: '取消',
      onOk: () => {
        message.success('感谢您的关注！我们会尽快与您联系。');
      },
    });
  };

  const handleCancelSubscription = () => {
    Modal.confirm({
      title: '确认取消订阅',
      content: '取消后，您的订阅将在当前周期结束后失效，届时将切换回免费版。',
      okText: '确认取消',
      okButtonProps: { danger: true },
      cancelText: '保留订阅',
      onOk: async () => {
        try {
          await cancelSubscription();
          message.success('订阅已取消');
          loadData();
        } catch (error) {
          message.error('取消订阅失败');
        }
      },
    });
  };

  const features = [
    { key: 'maxRecords', label: '账本数量', icon: <BarChart3 size={16} /> },
    { key: 'maxTradesPerMonth', label: '每月交易数', icon: <Zap size={16} /> },
    { key: 'maxHistoryDays', label: '历史数据', icon: <Clock size={16} /> },
    { key: 'maxAiAnalysisPerMonth', label: 'AI 分析次数', icon: <Brain size={16} /> },
    { key: 'hasSmartDiagnosis', label: '智能诊断', icon: <Sparkles size={16} />, boolean: true },
    { key: 'hasMonteCarlo', label: '蒙特卡洛模拟', icon: <BarChart3 size={16} />, boolean: true },
    { key: 'hasOptimalStopLoss', label: '最优止损分析', icon: <Shield size={16} />, boolean: true },
    { key: 'hasExpectancy', label: '期望值分布', icon: <BarChart3 size={16} />, boolean: true },
    { key: 'hasBehaviorTags', label: '行为归因标签', icon: <Users size={16} />, boolean: true },
    { key: 'hasExport', label: '数据导出', icon: <FileDown size={16} />, boolean: true },
    { key: 'hasApi', label: 'API 接口', icon: <Code2 size={16} />, boolean: true },
    { key: 'hasPrioritySupport', label: '优先支持', icon: <Crown size={16} />, boolean: true },
  ];

  const formatValue = (value, isBoolean) => {
    if (isBoolean) {
      return value ? (
        <Check size={18} style={{ color: '#10b981' }} />
      ) : (
        <X size={18} style={{ color: '#9ca3af' }} />
      );
    }
    if (value === -1) {
      return <span style={{ color: '#d97706', fontWeight: 600 }}>无限</span>;
    }
    if (typeof value === 'number') {
      return <span style={{ fontWeight: 600 }}>{value}</span>;
    }
    return value;
  };

  const getCurrentPlanName = () => {
    if (!currentSubscription) return 'free';
    if (!currentSubscription.hasSubscription) return 'free';
    return currentSubscription.plan?.name || 'free';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(180deg, #0a0a0f 0%, #141420 100%)',
      padding: '60px 24px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ 
          fontSize: 42, 
          fontWeight: 700, 
          color: '#fff',
          marginBottom: 16,
          letterSpacing: '-0.02em',
        }}>
          选择您的计划
        </h1>
        <p style={{ 
          fontSize: 18, 
          color: 'rgba(255,255,255,0.6)',
          maxWidth: 600,
          margin: '0 auto 32px',
        }}>
          从免费版开始，随时升级以解锁更多高级功能
        </p>

        {/* Billing Toggle */}
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: 12,
          background: 'rgba(255,255,255,0.05)',
          padding: '8px 16px',
          borderRadius: 12,
        }}>
          <span style={{ 
            color: billingCycle === 'monthly' ? '#fff' : 'rgba(255,255,255,0.5)',
            fontWeight: billingCycle === 'monthly' ? 600 : 400,
          }}>
            月付
          </span>
          <Switch 
            checked={billingCycle === 'yearly'}
            onChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
            style={{ background: billingCycle === 'yearly' ? '#d97706' : undefined }}
          />
          <span style={{ 
            color: billingCycle === 'yearly' ? '#fff' : 'rgba(255,255,255,0.5)',
            fontWeight: billingCycle === 'yearly' ? 600 : 400,
          }}>
            年付
            <Tag color="gold" style={{ marginLeft: 8, fontSize: 12 }}>省 17%</Tag>
          </span>
        </div>
      </div>

      {/* Plans */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 24,
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {plans.map((plan) => {
          const isCurrentPlan = getCurrentPlanName() === plan.name;
          const isPro = plan.name === 'pro';
          const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
          const monthlyEquivalent = billingCycle === 'yearly' ? (price / 12).toFixed(2) : price;
          const displayInfo = getPlanDisplayInfo(plan.name);

          return (
            <div
              key={plan.id}
              style={{
                background: isPro 
                  ? 'linear-gradient(135deg, rgba(217,119,6,0.15) 0%, rgba(217,119,6,0.05) 100%)'
                  : 'rgba(255,255,255,0.03)',
                border: isPro 
                  ? '2px solid rgba(217,119,6,0.5)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: 32,
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = isPro 
                  ? '0 20px 40px rgba(217,119,6,0.2)'
                  : '0 20px 40px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {isPro && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  color: '#fff',
                  padding: '4px 16px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  最受欢迎
                </div>
              )}

              {isCurrentPlan && (
                <div style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                }}>
                  <Tag color="green">当前计划</Tag>
                </div>
              )}

              {/* Plan Header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ 
                  fontSize: 32, 
                  marginBottom: 8,
                }}>
                  {displayInfo.icon}
                </div>
                <h3 style={{ 
                  fontSize: 24, 
                  fontWeight: 700, 
                  color: '#fff',
                  marginBottom: 8,
                }}>
                  {plan.displayName}
                </h3>
                <p style={{ 
                  color: 'rgba(255,255,255,0.5)', 
                  fontSize: 14,
                  minHeight: 40,
                }}>
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ 
                    fontSize: 48, 
                    fontWeight: 700, 
                    color: '#fff',
                    letterSpacing: '-0.02em',
                  }}>
                    ${price === 0 ? '0' : monthlyEquivalent}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    /{billingCycle === 'yearly' && price > 0 ? '月（年付）' : '月'}
                  </span>
                </div>
                {billingCycle === 'yearly' && price > 0 && (
                  <div style={{ 
                    color: 'rgba(255,255,255,0.4)', 
                    fontSize: 14,
                    marginTop: 4,
                  }}>
                    年付总计 ${price}
                  </div>
                )}
              </div>

              {/* CTA Button */}
              {isCurrentPlan ? (
                plan.name === 'free' ? (
                  <Button
                    block
                    size="large"
                    disabled
                    style={{
                      height: 48,
                      borderRadius: 12,
                      marginBottom: 24,
                    }}
                  >
                    当前计划
                  </Button>
                ) : (
                  <Button
                    block
                    size="large"
                    danger
                    onClick={handleCancelSubscription}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      marginBottom: 24,
                    }}
                  >
                    取消订阅
                  </Button>
                )
              ) : (
                <Button
                  type={isPro ? 'primary' : 'default'}
                  block
                  size="large"
                  onClick={() => handleSubscribe(plan.name)}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    marginBottom: 24,
                    background: isPro ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : undefined,
                    border: isPro ? 'none' : undefined,
                    fontWeight: 600,
                  }}
                >
                  {plan.name === 'free' ? '开始免费使用' : '升级到此计划'}
                  <ArrowRight size={18} style={{ marginLeft: 8 }} />
                </Button>
              )}

              {/* Features */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
                {features.map((feature) => {
                  const value = plan[feature.key];
                  return (
                    <div
                      key={feature.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 10,
                        color: 'rgba(255,255,255,0.7)',
                      }}>
                        {feature.icon}
                        <span>{feature.label}</span>
                      </div>
                      <div>
                        {formatValue(value, feature.boolean)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div style={{ 
        maxWidth: 800, 
        margin: '80px auto 0',
        textAlign: 'center',
      }}>
        <h2 style={{ 
          fontSize: 28, 
          fontWeight: 600, 
          color: '#fff',
          marginBottom: 40,
        }}>
          常见问题
        </h2>

        <div style={{ textAlign: 'left' }}>
          {[
            {
              q: '可以随时取消订阅吗？',
              a: '是的，您可以随时取消订阅。取消后，您的订阅将在当前计费周期结束后失效，届时将自动切换回免费版。',
            },
            {
              q: '年付和月付有什么区别？',
              a: '年付可享受约 17% 的折扣（相当于 2 个月免费）。年付需一次性支付全年费用，月付则按月扣费。',
            },
            {
              q: '升级后数据会丢失吗？',
              a: '不会。升级或降级不会影响您的任何数据，所有交易记录、分析报告都会保留。',
            },
            {
              q: '支持哪些支付方式？',
              a: '我们支持信用卡、借记卡（Visa、MasterCard、American Express）以及 PayPal。',
            },
            {
              q: '团队版如何添加成员？',
              a: '团队版支持最多 5 位成员。升级后，您可以在设置页面邀请团队成员加入。',
            },
          ].map((item, index) => (
            <div
              key={index}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <div style={{ 
                color: '#fff', 
                fontWeight: 600, 
                marginBottom: 8,
                fontSize: 16,
              }}>
                {item.q}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                {item.a}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: 60,
        padding: 40,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        maxWidth: 600,
        margin: '60px auto 0',
      }}>
        <h3 style={{ color: '#fff', marginBottom: 16 }}>
          还有疑问？
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
          我们的团队随时为您解答
        </p>
        <Button 
          size="large"
          style={{ borderRadius: 8 }}
          onClick={() => window.open('mailto:support@metworthai.com')}
        >
          联系我们
        </Button>
      </div>
    </div>
  );
};

export default Pricing;
