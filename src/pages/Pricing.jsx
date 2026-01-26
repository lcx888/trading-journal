/**
 * 订阅定价页面 - 心理学营销优化版
 * 
 * 核心心理学原则：
 * 1. 锚定效应 - Elite 高价让 Pro 显得超值
 * 2. 损失厌恶 - 免费版限制制造痛点
 * 3. 框架效应 - "每天仅需 $1.3" vs "$49/月"
 * 4. 稀缺性 - 限时年付优惠
 * 5. 社会认同 - 用户选择提示
 */
import React, { useState, useEffect } from 'react';
import { Button, Spin, message, Modal, Tag, ConfigProvider } from 'antd';
import { 
  Check, 
  X,
  Lock, 
  CreditCard, 
  RefreshCw, 
  Headphones,
  ShieldCheck,
  Zap,
  Crown,
  Star,
  TrendingUp,
  BarChart3,
  Brain,
  Download,
  Clock,
  Infinity,
  Sparkles
} from 'lucide-react';
import { getPlans, getSubscriptionStatus } from '../services/subscription';

// ============================================================
// 设计系统
// ============================================================
const COLORS = {
  bg: '#0a0a0c',
  card: '#111114',
  cardHover: '#18181c',
  border: '#27272a',
  borderHover: '#3f3f46',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  brand: '#f0b90b',
  brandBg: 'rgba(240, 185, 11, 0.1)',
  elite: '#a855f7',
  eliteBg: 'rgba(168, 85, 247, 0.1)',
  profit: '#22c55e',
  loss: '#ef4444',
};

// ============================================================
// 主组件
// ============================================================
const Pricing = () => {
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('yearly');

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
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (planName) => {
    if (planName === 'free') return;
    const plan = plans.find(p => p.name === planName);
    const price = billingCycle === 'yearly' ? plan?.priceYearly : plan?.priceMonthly;
    const monthlyPrice = billingCycle === 'yearly' ? Math.round(price / 12) : price;

    Modal.confirm({
      title: null,
      icon: null,
      centered: true,
      width: 420,
      content: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: planName === 'elite' ? COLORS.eliteBg : COLORS.brandBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {planName === 'elite' 
                ? <Crown size={24} style={{ color: COLORS.elite }} />
                : <Zap size={24} style={{ color: COLORS.brand }} />
              }
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>
                升级至 {plan.displayName}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                解锁完整的 AI 交易分析能力
              </div>
            </div>
          </div>
          
          <div style={{ 
            background: '#1a1a1e', 
            padding: '16px 20px', 
            borderRadius: 8, 
            border: '1px solid #27272a',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>
                  {billingCycle === 'yearly' ? '年付方案' : '月付方案'}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>${monthlyPrice}</span>
                  <span style={{ fontSize: 14, color: COLORS.textMuted }}>/月</span>
                </div>
              </div>
              {billingCycle === 'yearly' && (
                <Tag color="green" style={{ margin: 0 }}>
                  省 ${planName === 'elite' ? '600' : '120'}/年
                </Tag>
              )}
            </div>
            {billingCycle === 'yearly' && (
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>
                一次性支付 ${price}，有效期 12 个月
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            ✓ 7 天无理由退款保障<br/>
            ✓ 随时可取消订阅<br/>
            ✓ 升级后立即生效
          </div>
        </div>
      ),
      okText: '联系客服开通',
      cancelText: '再考虑一下',
      okButtonProps: {
        style: {
          background: planName === 'elite' ? COLORS.elite : COLORS.brand,
          borderColor: planName === 'elite' ? COLORS.elite : COLORS.brand,
          color: '#000',
          fontWeight: 600
        }
      },
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('客服邮箱已复制：support@metworthai.com');
      },
    });
  };

  const getCurrentPlanName = () => {
    if (!currentSubscription?.hasSubscription) return 'free';
    return currentSubscription.plan?.name || 'free';
  };

  // 计划数据增强
  const getPlanData = (plan) => {
    const monthlyPrice = billingCycle === 'yearly' && plan.priceYearly > 0 
      ? Math.round(plan.priceYearly / 12) 
      : plan.priceMonthly;
    
    const originalMonthly = plan.priceMonthly;
    const savings = billingCycle === 'yearly' && originalMonthly > 0
      ? (originalMonthly * 12) - plan.priceYearly
      : 0;

    const configs = {
      free: {
        icon: TrendingUp,
        accent: COLORS.textMuted,
        features: [
          { text: '1 个交易账本', included: true },
          { text: '每月 50 笔交易', included: true },
          { text: '7 天历史数据', included: true, warning: true },
          { text: '每月 2 次 AI 分析', included: true },
          { text: '智能诊断系统', included: false },
          { text: '蒙特卡洛模拟', included: false },
          { text: '数据导出', included: false },
        ],
        cta: '当前方案',
        disabled: true,
      },
      pro: {
        icon: Zap,
        accent: COLORS.brand,
        badge: '最受欢迎',
        popular: true,
        features: [
          { text: '无限交易账本', included: true, highlight: true },
          { text: '无限交易笔数', included: true, highlight: true },
          { text: '永久历史数据', included: true, highlight: true },
          { text: '无限 AI 分析', included: true, highlight: true },
          { text: '智能诊断系统', included: true },
          { text: '蒙特卡洛模拟', included: true },
          { text: '最优止损预测', included: true },
          { text: '行为标签系统', included: true },
          { text: '数据导出', included: true },
        ],
        cta: '立即升级',
        daily: billingCycle === 'yearly' ? '1.3' : '1.6',
      },
      elite: {
        icon: Crown,
        accent: COLORS.elite,
        badge: 'VIP',
        features: [
          { text: '包含 Pro 全部功能', included: true, highlight: true },
          { text: 'API 接口访问', included: true, highlight: true },
          { text: '优先技术支持', included: true, highlight: true },
          { text: '1对1 策略咨询', included: true },
          { text: '专属交易社群', included: true },
          { text: '新功能抢先体验', included: true },
          { text: '定制化报告', included: true },
        ],
        cta: '成为精英',
        daily: billingCycle === 'yearly' ? '3.3' : '5.0',
      },
    };

    return {
      ...plan,
      monthlyPrice,
      savings,
      ...configs[plan.name],
    };
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  const currentPlan = getCurrentPlanName();
  const enrichedPlans = plans.map(getPlanData);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: COLORS.brand, borderRadius: 8 } }}>
      <div style={{ 
        minHeight: '100%',
        background: COLORS.bg,
        paddingBottom: 60
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h1 style={{ 
              fontSize: 32, 
              fontWeight: 700, 
              color: '#fff',
              marginBottom: 12
            }}>
              选择适合你的方案
            </h1>
            <p style={{ 
              fontSize: 16, 
              color: COLORS.textSecondary,
              marginBottom: 32
            }}>
              加入 <span style={{ color: COLORS.brand }}>2,000+</span> 专业交易者，用 AI 提升交易表现
            </p>

            {/* Billing Toggle */}
            <div style={{ 
              display: 'inline-flex',
              background: '#18181b',
              padding: 4,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`
            }}>
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  background: billingCycle === 'monthly' ? '#27272a' : 'transparent',
                  color: billingCycle === 'monthly' ? '#fff' : COLORS.textMuted,
                  transition: 'all 0.2s'
                }}
              >
                月付
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  background: billingCycle === 'yearly' ? '#27272a' : 'transparent',
                  color: billingCycle === 'yearly' ? '#fff' : COLORS.textMuted,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                年付
                <span style={{
                  background: COLORS.profit,
                  color: '#000',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4
                }}>
                  省20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
            marginBottom: 48
          }}>
            {enrichedPlans.map((plan) => {
              const Icon = plan.icon;
              const isCurrentPlan = currentPlan === plan.name;
              const isPopular = plan.popular;
              const isElite = plan.name === 'elite';

              return (
                <div 
                  key={plan.id}
                  style={{
                    background: COLORS.card,
                    border: `1px solid ${isPopular ? COLORS.brand : isElite ? COLORS.elite : COLORS.border}`,
                    borderRadius: 16,
                    padding: 32,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s',
                    boxShadow: isPopular ? `0 0 40px ${COLORS.brandBg}` : 'none'
                  }}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div style={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: isElite ? COLORS.elite : COLORS.brand,
                      color: '#000',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 16px',
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      {isElite ? <Crown size={12} /> : <Star size={12} />}
                      {plan.badge}
                    </div>
                  )}

                  {/* Plan Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: isElite ? COLORS.eliteBg : plan.name === 'pro' ? COLORS.brandBg : '#27272a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={22} style={{ color: plan.accent }} />
                    </div>
                    <div>
                      <div style={{ 
                        fontSize: 18, 
                        fontWeight: 600, 
                        color: '#fff' 
                      }}>
                        {plan.displayName}
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 40, fontWeight: 700, color: '#fff' }}>
                        ${plan.monthlyPrice}
                      </span>
                      <span style={{ fontSize: 16, color: COLORS.textMuted }}>/月</span>
                    </div>
                    {plan.daily && (
                      <div style={{ 
                        fontSize: 13, 
                        color: COLORS.textSecondary,
                        marginTop: 4
                      }}>
                        每天仅需 <span style={{ color: COLORS.profit, fontWeight: 600 }}>${plan.daily}</span>
                      </div>
                    )}
                    {plan.savings > 0 && billingCycle === 'yearly' && (
                      <div style={{
                        display: 'inline-block',
                        marginTop: 8,
                        background: 'rgba(34, 197, 94, 0.1)',
                        color: COLORS.profit,
                        fontSize: 12,
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: 4
                      }}>
                        年付省 ${plan.savings}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p style={{ 
                    fontSize: 14, 
                    color: COLORS.textSecondary,
                    marginBottom: 24,
                    lineHeight: 1.5
                  }}>
                    {plan.description}
                  </p>

                  {/* Features */}
                  <div style={{ 
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    marginBottom: 24
                  }}>
                    {plan.features?.map((feature, i) => (
                      <div 
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 14,
                          color: feature.included ? (feature.highlight ? '#fff' : COLORS.textSecondary) : COLORS.textMuted,
                          opacity: feature.included ? 1 : 0.5
                        }}
                      >
                        {feature.included ? (
                          <Check size={16} style={{ 
                            color: feature.highlight ? (isElite ? COLORS.elite : COLORS.brand) : COLORS.profit,
                            flexShrink: 0
                          }} />
                        ) : (
                          <X size={16} style={{ color: COLORS.textMuted, flexShrink: 0 }} />
                        )}
                        <span style={{ 
                          textDecoration: !feature.included ? 'line-through' : 'none'
                        }}>
                          {feature.text}
                        </span>
                        {feature.warning && (
                          <span style={{ 
                            fontSize: 11, 
                            color: COLORS.loss,
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '1px 6px',
                            borderRadius: 3
                          }}>
                            限制
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button
                    type={plan.name === 'free' ? 'default' : 'primary'}
                    block
                    size="large"
                    disabled={plan.disabled || isCurrentPlan}
                    onClick={() => handleSubscribe(plan.name)}
                    style={{
                      height: 48,
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 600,
                      background: plan.name === 'free' 
                        ? 'transparent' 
                        : (isElite ? COLORS.elite : COLORS.brand),
                      borderColor: plan.name === 'free' 
                        ? COLORS.border 
                        : (isElite ? COLORS.elite : COLORS.brand),
                      color: plan.name === 'free' ? COLORS.textMuted : '#000',
                    }}
                  >
                    {isCurrentPlan ? '当前方案' : plan.cta}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Trust Signals */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
            flexWrap: 'wrap',
            padding: '24px 0',
            borderTop: `1px solid ${COLORS.border}`,
            borderBottom: `1px solid ${COLORS.border}`,
            marginBottom: 48
          }}>
            {[
              { icon: ShieldCheck, text: 'SSL 加密' },
              { icon: CreditCard, text: '安全支付' },
              { icon: RefreshCw, text: '7天退款' },
              { icon: Headphones, text: '技术支持' },
            ].map((item, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                fontSize: 13,
                color: COLORS.textMuted
              }}>
                <item.icon size={16} />
                {item.text}
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2 style={{ 
              fontSize: 20, 
              fontWeight: 600, 
              color: '#fff',
              marginBottom: 24,
              textAlign: 'center'
            }}>
              常见问题
            </h2>
            
            {[
              {
                q: '我可以随时取消订阅吗？',
                a: '是的，您可以随时取消订阅。取消后，您仍可使用服务直到当前付费周期结束。'
              },
              {
                q: '年付和月付有什么区别？',
                a: '年付可节省约 20% 的费用。年付按年一次性收费，月付按月收费。功能完全相同。'
              },
              {
                q: 'Pro 和 Elite 有什么区别？',
                a: 'Elite 包含 Pro 的全部功能，额外提供 API 接口访问、优先技术支持、1对1策略咨询等 VIP 服务。'
              },
              {
                q: '如何升级或降级方案？',
                a: '您可以随时联系客服进行方案变更。升级立即生效，降级在当前周期结束后生效。'
              },
            ].map((faq, i) => (
              <div 
                key={i}
                style={{
                  padding: '16px 0',
                  borderBottom: i < 3 ? `1px solid ${COLORS.border}` : 'none'
                }}
              >
                <div style={{ 
                  fontSize: 15, 
                  fontWeight: 500, 
                  color: '#fff',
                  marginBottom: 8
                }}>
                  {faq.q}
                </div>
                <div style={{ 
                  fontSize: 14, 
                  color: COLORS.textSecondary,
                  lineHeight: 1.6
                }}>
                  {faq.a}
                </div>
              </div>
            ))}
          </div>

          {/* Contact CTA */}
          <div style={{ 
            textAlign: 'center', 
            marginTop: 48,
            padding: 32,
            background: COLORS.card,
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`
          }}>
            <Sparkles size={24} style={{ color: COLORS.brand, marginBottom: 12 }} />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              需要定制化方案？
            </h3>
            <p style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 }}>
              我们提供企业级解决方案和大客户专属服务
            </p>
            <a 
              href="mailto:support@metworthai.com"
              style={{ 
                color: COLORS.brand, 
                fontSize: 14,
                fontWeight: 500
              }}
            >
              联系我们 →
            </a>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Pricing;
