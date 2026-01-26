/**
 * 订阅定价页面 - 极简专业设计系统版
 * 
 * 设计原则：
 * 1. 深度融合整站设计系统，完全使用 CSS 变量
 * 2. 移除 Apple 风格的硬性背景覆盖，改用整站的 --bg-primary
 * 3. 强化层级对比，采用 --bg-secondary 作为卡片背景
 * 4. 品牌色统一使用 --color-brand (金色)
 * 5. 极致简约，去除多余的装饰性渐变
 */
import React, { useState, useEffect } from 'react';
import { Button, Spin, message, Modal, ConfigProvider } from 'antd';
import { 
  Check, 
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Headphones,
  Zap,
  Crown,
  TrendingUp,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { getPlans, getSubscriptionStatus } from '../services/subscription';

const styles = {
  page: {
    minHeight: '100%',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    paddingBottom: '80px',
  },
  
  hero: {
    textAlign: 'center',
    padding: '60px 24px 48px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  
  superTitle: {
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--color-brand)',
    marginBottom: '12px',
    display: 'block',
  },
  
  title: {
    fontSize: '42px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    marginBottom: '16px',
    color: 'var(--text-primary)',
  },
  
  subtitle: {
    fontSize: '16px',
    lineHeight: 1.6,
    fontWeight: 400,
    color: 'var(--text-secondary)',
    maxWidth: '540px',
    margin: '0 auto 40px',
  },

  toggleContainer: {
    display: 'inline-flex',
    background: 'var(--bg-tertiary)',
    padding: '4px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-primary)',
    marginBottom: '40px',
  },

  toggleBtn: (active) => ({
    padding: '8px 24px',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? 'var(--bg-elevated)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
    border: 'none',
    transition: 'all var(--transition-normal)',
  }),

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px',
  },

  card: (isPopular, isElite) => ({
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-xl)',
    padding: '40px',
    border: `1px solid ${isPopular ? 'var(--color-brand)' : isElite ? '#bf5af2' : 'var(--border-primary)'}`,
    display: 'flex',
    flexDirection: 'column',
    transition: 'all var(--transition-normal)',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: isPopular ? '0 0 20px var(--color-brand-bg)' : 'none',
  }),

  cardBadge: (isElite) => ({
    position: 'absolute',
    top: '20px',
    right: '24px',
    fontSize: '11px',
    fontWeight: 700,
    color: isElite ? '#bf5af2' : 'var(--color-brand)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: isElite ? 'rgba(191, 90, 242, 0.1)' : 'var(--color-brand-bg)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
  }),

  planName: {
    fontSize: '22px',
    fontWeight: 600,
    marginBottom: '8px',
    color: 'var(--text-primary)',
  },

  priceWrapper: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    margin: '24px 0 12px',
  },

  priceAmount: {
    fontSize: '48px',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },

  pricePeriod: {
    fontSize: '16px',
    color: 'var(--text-tertiary)',
  },

  savingsTag: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-profit)',
    background: 'var(--color-profit-bg)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '24px',
  },

  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '32px 0',
    flex: 1,
  },

  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
    lineHeight: 1.4,
  },

  ctaButton: (isPrimary, isElite) => ({
    height: '48px',
    borderRadius: 'var(--radius-md)',
    fontSize: '15px',
    fontWeight: 600,
    background: isPrimary ? (isElite ? '#bf5af2' : 'var(--color-brand)') : 'transparent',
    borderColor: isPrimary ? 'transparent' : 'var(--border-primary)',
    color: isPrimary ? (isElite ? '#FFFFFF' : '#0a0a0c') : 'var(--text-primary)',
    transition: 'all var(--transition-normal)',
  }),

  trustSection: {
    maxWidth: '1100px',
    margin: '80px auto 0',
    padding: '0 24px',
  },

  trustGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '32px',
    padding: '40px 0',
    borderTop: '1px solid var(--border-primary)',
  },

  trustItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--text-tertiary)',
    fontSize: '13px',
  }
};

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
      width: 400,
      content: (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            background: planName === 'elite' ? 'rgba(191, 90, 242, 0.1)' : 'var(--color-brand-bg)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            {planName === 'elite' ? <Crown color="#bf5af2" size={28} /> : <Zap color="var(--color-brand)" size={28} />}
          </div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>升级到 {plan.displayName}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            解锁专业级 AI 交易洞察，开启您的进阶之路。
          </p>
          <div style={{ 
            background: 'var(--bg-tertiary)', 
            padding: '20px', 
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            border: '1px solid var(--border-primary)'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              {billingCycle === 'yearly' ? '年付方案' : '月付方案'}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              ${monthlyPrice}<span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text-tertiary)' }}>/月</span>
            </div>
          </div>
          <div style={{ textAlign: 'left', fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
            • 7 天无理由全额退款保障<br/>
            • 随时可在设置中管理或取消订阅<br/>
            • 升级立即生效，数据无缝迁移
          </div>
        </div>
      ),
      okText: '立即升级',
      cancelText: '取消',
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('客服邮箱已复制，请联系开通');
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const currentPlan = currentSubscription?.plan?.name || 'free';

  return (
    <ConfigProvider theme={{ token: { colorPrimary: 'var(--color-brand)', borderRadius: 6 } }}>
      <div style={styles.page}>
        {/* Hero Section */}
        <div style={styles.hero}>
          <span style={styles.superTitle}>MetworthAI 订阅方案</span>
          <h1 style={styles.title}>选择适合你的交易方案</h1>
          <p style={styles.subtitle}>
            加入专业交易者行列，利用 AI 深度洞察每一笔交易的本质。
          </p>

          <div style={styles.toggleContainer}>
            <button 
              style={styles.toggleBtn(billingCycle === 'monthly')}
              onClick={() => setBillingCycle('monthly')}
            >
              月付
            </button>
            <button 
              style={styles.toggleBtn(billingCycle === 'yearly')}
              onClick={() => setBillingCycle('yearly')}
            >
              年付
            </button>
          </div>
        </div>

        {/* Pricing Grid */}
        <div style={styles.grid}>
          {plans.map((plan) => {
            const isPro = plan.name === 'pro';
            const isElite = plan.name === 'elite';
            const isFree = plan.name === 'free';
            const isCurrent = currentPlan === plan.name;
            
            const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
            const monthlyPrice = billingCycle === 'yearly' && price > 0 ? Math.round(price / 12) : price;
            const savings = billingCycle === 'yearly' && plan.priceMonthly > 0 
              ? (plan.priceMonthly * 12) - plan.priceYearly 
              : 0;

            const features = {
              free: ['1 个交易账本', '每月 50 笔交易', '7 天历史数据限制', '每月 2 次 AI 分析'],
              pro: ['无限交易账本', '无限交易笔数', '永久历史数据', '无限 AI 分析', '智能诊断系统', '蒙特卡洛模拟'],
              elite: ['包含 Pro 全部功能', 'API 接口访问', '优先技术支持', '1对1 策略咨询', '定制化报告']
            };

            return (
              <div 
                key={plan.id} 
                style={styles.card(isPro, isElite)}
                className="hover-lift"
              >
                {isPro && <span style={styles.cardBadge(false)}>最受欢迎</span>}
                {isElite && <span style={styles.cardBadge(true)}>VIP 专属</span>}
                
                <h3 style={styles.planName}>{plan.displayName}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', minHeight: '40px', lineHeight: 1.5 }}>
                  {plan.description}
                </p>

                <div style={styles.priceWrapper}>
                  <span style={styles.priceAmount}>${monthlyPrice}</span>
                  <span style={styles.pricePeriod}>/月</span>
                </div>

                {savings > 0 && billingCycle === 'yearly' ? (
                  <span style={styles.savingsTag}>年付立省 ${savings}</span>
                ) : <div style={{ height: '24px', marginBottom: '24px' }} />}

                <ul style={styles.featureList}>
                  {features[plan.name]?.map((feat, i) => (
                    <li key={i} style={styles.featureItem}>
                      <Check size={16} color={isElite ? '#bf5af2' : 'var(--color-brand)'} strokeWidth={3} />
                      {feat}
                    </li>
                  ))}
                </ul>

                <Button
                  type={isFree ? 'default' : 'primary'}
                  block
                  disabled={isCurrent}
                  onClick={() => handleSubscribe(plan.name)}
                  style={styles.ctaButton(!isFree, isElite)}
                >
                  {isCurrent ? '当前方案' : (isFree ? '开始使用' : '立即升级')}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Trust Section */}
        <div style={styles.trustSection}>
          <div style={styles.trustGrid}>
            <div style={styles.trustItem}>
              <ShieldCheck size={20} color="var(--color-profit)" />
              <span>SSL 银行级安全加密</span>
            </div>
            <div style={styles.trustItem}>
              <CreditCard size={20} color="var(--color-brand)" />
              <span>支持多种主流支付方式</span>
            </div>
            <div style={styles.trustItem}>
              <RefreshCw size={20} color="var(--color-info)" />
              <span>7天无理由退款保障</span>
            </div>
            <div style={styles.trustItem}>
              <Headphones size={20} color="var(--color-brand)" />
              <span>24/7 专家级技术支持</span>
            </div>
          </div>

          <div style={{ 
            background: 'var(--bg-secondary)', 
            padding: '48px', 
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center'
          }}>
            <Sparkles size={32} color="var(--color-brand)" />
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>需要企业级定制化服务？</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', fontSize: '14px' }}>
              如果您是机构交易员或需要深度 API 集成，我们的专家团队将为您提供专属的解决方案。
            </p>
            <Button 
              type="link" 
              href="mailto:support@metworthai.com"
              style={{ fontSize: '15px', color: 'var(--color-brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              联系专家团队 <ChevronRight size={16} />
            </Button>
          </div>

          <p style={{ marginTop: '60px', color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center' }}>
            © 2026 MetworthAI. 所有的订阅方案均受我们的服务条款和隐私政策约束。
          </p>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Pricing;
