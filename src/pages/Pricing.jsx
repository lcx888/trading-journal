/**
 * 订阅定价页面 - 融合网站设计系统
 * 
 * 设计原则：
 * 1. 完全使用 CSS 变量，与整站风格统一
 * 2. 极简主义 - 去除多余装饰，专注内容
 * 3. 币安风格的深色专业界面
 * 4. 清晰的信息层级和视觉引导
 */
import React, { useState, useEffect } from 'react';
import { Button, Spin, message, Modal, ConfigProvider } from 'antd';
import { 
  Check, 
  X,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Headphones,
  Zap,
  Crown,
  TrendingUp,
} from 'lucide-react';
import { getPlans, getSubscriptionStatus } from '../services/subscription';

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
    const isElite = planName === 'elite';

    Modal.confirm({
      title: null,
      icon: null,
      centered: true,
      width: 380,
      content: (
        <div className="py-2">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`
              w-11 h-11 rounded-xl flex items-center justify-center
              ${isElite ? 'bg-purple-500/10' : 'bg-[var(--color-brand-bg)]'}
            `}>
              {isElite ? <Crown size={22} className="text-purple-400" /> : <Zap size={22} className="text-[var(--color-brand)]" />}
            </div>
            <div>
              <div className="text-base font-semibold text-white">升级到 {plan.displayName}</div>
              <div className="text-xs text-[var(--text-tertiary)]">解锁完整 AI 分析能力</div>
            </div>
          </div>
          
          {/* Price Card */}
          <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)] p-4 mb-4">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">
              {billingCycle === 'yearly' ? '年付方案' : '月付方案'}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white font-mono">${monthlyPrice}</span>
              <span className="text-sm text-[var(--text-tertiary)]">/月</span>
            </div>
            {billingCycle === 'yearly' && (
              <div className="text-xs text-[var(--color-profit)] mt-2">
                年付立省 ${isElite ? '600' : '120'}
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-1">
            <div className="flex items-center gap-2">
              <Check size={12} className="text-[var(--color-profit)]" />
              <span>7 天无理由退款</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-[var(--color-profit)]" />
              <span>随时可取消订阅</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-[var(--color-profit)]" />
              <span>升级后立即生效</span>
            </div>
          </div>
        </div>
      ),
      okText: '联系客服开通',
      cancelText: '取消',
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('客服邮箱已复制');
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  const currentPlan = currentSubscription?.plan?.name || 'free';

  // 功能配置
  const planFeatures = {
    free: [
      { text: '1 个交易账本', included: true },
      { text: '每月 50 笔交易', included: true },
      { text: '7 天历史数据', included: true, limit: true },
      { text: '每月 2 次 AI 分析', included: true },
      { text: '智能诊断系统', included: false },
      { text: '蒙特卡洛模拟', included: false },
      { text: '数据导出', included: false },
    ],
    pro: [
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
    elite: [
      { text: '包含 Pro 全部功能', included: true, highlight: true },
      { text: 'API 接口访问', included: true, highlight: true },
      { text: '优先技术支持', included: true, highlight: true },
      { text: '1对1 策略咨询', included: true },
      { text: '专属交易社群', included: true },
      { text: '新功能抢先体验', included: true },
      { text: '定制化报告', included: true },
    ],
  };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#eab308' } }}>
      <div className="min-h-full pb-16">
        {/* Header */}
        <div className="text-center pt-8 pb-10 px-6">
          <h1 className="text-2xl font-bold text-white mb-2">选择适合你的方案</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            专业交易者的智能分析工具
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-primary)]">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`
                px-5 py-2 rounded-md text-sm font-medium transition-all
                ${billingCycle === 'monthly' 
                  ? 'bg-[var(--bg-hover)] text-white' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              月付
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`
                px-5 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2
                ${billingCycle === 'yearly' 
                  ? 'bg-[var(--bg-hover)] text-white' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              年付
              <span className="text-[10px] font-semibold text-[var(--color-profit)] bg-[var(--color-profit-bg)] px-1.5 py-0.5 rounded">
                省20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isFree = plan.name === 'free';
              const isPro = plan.name === 'pro';
              const isElite = plan.name === 'elite';
              const isCurrent = currentPlan === plan.name;
              
              const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
              const monthlyPrice = billingCycle === 'yearly' && price > 0 ? Math.round(price / 12) : price;
              const savings = billingCycle === 'yearly' && plan.priceMonthly > 0 
                ? (plan.priceMonthly * 12) - plan.priceYearly 
                : 0;

              const features = planFeatures[plan.name] || [];

              return (
                <div 
                  key={plan.id}
                  className={`
                    relative rounded-xl p-6 flex flex-col transition-all duration-200
                    ${isPro 
                      ? 'bg-[var(--bg-secondary)] border-2 border-[var(--color-brand)]' 
                      : isElite 
                        ? 'bg-[var(--bg-secondary)] border border-purple-500/30' 
                        : 'bg-[var(--bg-secondary)] border border-[var(--border-primary)]'
                    }
                    hover:border-[var(--border-hover)]
                  `}
                >
                  {/* Badge */}
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--color-brand)] text-black text-xs font-bold rounded-full">
                      推荐
                    </div>
                  )}
                  {isElite && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                      VIP
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center
                      ${isFree ? 'bg-[var(--bg-tertiary)]' : isPro ? 'bg-[var(--color-brand-bg)]' : 'bg-purple-500/10'}
                    `}>
                      {isFree && <TrendingUp size={18} className="text-[var(--text-tertiary)]" />}
                      {isPro && <Zap size={18} className="text-[var(--color-brand)]" />}
                      {isElite && <Crown size={18} className="text-purple-400" />}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{plan.displayName}</div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white font-mono">${monthlyPrice}</span>
                      <span className="text-sm text-[var(--text-tertiary)]">/月</span>
                    </div>
                  </div>

                  {/* Savings */}
                  {savings > 0 && billingCycle === 'yearly' ? (
                    <div className="text-xs text-[var(--color-profit)] mb-4">
                      年付立省 ${savings}
                    </div>
                  ) : (
                    <div className="h-4 mb-4" />
                  )}

                  {/* Description */}
                  <p className="text-xs text-[var(--text-secondary)] mb-5 leading-relaxed">
                    {plan.description}
                  </p>

                  {/* Features */}
                  <div className="flex-1 space-y-2.5 mb-6">
                    {features.map((feature, i) => (
                      <div 
                        key={i}
                        className={`
                          flex items-center gap-2.5 text-[13px]
                          ${feature.included ? 'text-[var(--text-secondary)]' : 'text-[var(--text-disabled)]'}
                        `}
                      >
                        {feature.included ? (
                          <Check 
                            size={14} 
                            className={
                              feature.highlight 
                                ? (isElite ? 'text-purple-400' : 'text-[var(--color-brand)]')
                                : 'text-[var(--color-profit)]'
                            } 
                          />
                        ) : (
                          <X size={14} className="text-[var(--text-disabled)]" />
                        )}
                        <span className={!feature.included ? 'line-through' : ''}>
                          {feature.text}
                        </span>
                        {feature.limit && (
                          <span className="text-[10px] text-[var(--color-loss)] bg-[var(--color-loss-bg)] px-1.5 py-0.5 rounded">
                            限制
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Button
                    type={isFree ? 'default' : 'primary'}
                    block
                    disabled={isCurrent}
                    onClick={() => handleSubscribe(plan.name)}
                    className={`
                      h-10 font-semibold text-sm rounded-lg
                      ${isElite && !isCurrent ? '!bg-purple-500 !border-purple-500 !text-white hover:!bg-purple-600' : ''}
                    `}
                  >
                    {isCurrent ? '当前方案' : (isFree ? '免费使用' : '立即升级')}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trust Signals */}
        <div className="max-w-[800px] mx-auto mt-12 px-6">
          <div className="flex items-center justify-center gap-8 flex-wrap py-6 border-t border-b border-[var(--border-primary)]">
            {[
              { icon: ShieldCheck, text: 'SSL 加密' },
              { icon: CreditCard, text: '安全支付' },
              { icon: RefreshCw, text: '7天退款' },
              { icon: Headphones, text: '技术支持' },
            ].map((item, i) => (
              <div 
                key={i} 
                className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]"
              >
                <item.icon size={14} />
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-[600px] mx-auto mt-12 px-6">
          <h2 className="text-lg font-semibold text-white text-center mb-6">常见问题</h2>
          
          <div className="space-y-4">
            {[
              {
                q: '我可以随时取消订阅吗？',
                a: '是的，您可以随时取消。取消后仍可使用至当前周期结束。'
              },
              {
                q: '年付和月付有什么区别？',
                a: '功能完全相同。年付可节省约 20% 的费用。'
              },
              {
                q: 'Pro 和 Elite 有什么区别？',
                a: 'Elite 额外提供 API 访问、优先支持和 1对1 策略咨询。'
              },
            ].map((faq, i) => (
              <div 
                key={i}
                className="py-4 border-b border-[var(--border-primary)] last:border-b-0"
              >
                <div className="text-sm font-medium text-white mb-2">{faq.q}</div>
                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="max-w-[500px] mx-auto mt-12 px-6 text-center">
          <p className="text-xs text-[var(--text-tertiary)]">
            需要定制方案？
            <a 
              href="mailto:support@metworthai.com"
              className="text-[var(--color-brand)] ml-1 hover:underline"
            >
              联系我们
            </a>
          </p>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Pricing;
