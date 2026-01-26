/**
 * 订阅定价页面 - 紧凑专业版
 * 遵循专业工具类网页设计规范：
 * 1. 紧凑布局 (Compact Layout) - 减少冗余空白，提高信息密度
 * 2. 去营销化 (Low-Marketing) - 减弱渐变和动效，强调功能对比
 * 3. 极简主义 (Minimalism) - 采用冷静的灰阶色调，仅保留核心强调色
 */
import React, { useState, useEffect } from 'react';
import { Button, Spin, message, Modal, ConfigProvider } from 'antd';
import { 
  Check, 
  Lock, 
  CreditCard, 
  RefreshCw, 
  Headphones,
  ShieldCheck,
  Zap,
  Trophy,
  Users,
  Info
} from 'lucide-react';
import { getPlans, getSubscriptionStatus, cancelSubscription } from '../services/subscription';

// ============================================================
// 设计系统常量
// ============================================================
const THEME = {
  colors: {
    primary: '#e8b4b8',
    bg: '#0a0a0a',
    cardBg: '#141414',
    cardBorder: '#262626',
    textMain: '#e5e5e5',
    textMuted: '#737373',
    divider: '#262626',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  }
};

const styles = {
  page: {
    minHeight: '100vh',
    background: THEME.colors.bg,
    color: THEME.colors.textMain,
    fontFamily: 'Inter, system-ui, sans-serif',
    paddingBottom: '60px',
  },

  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 20px',
  },

  header: {
    marginBottom: '40px',
  },

  title: {
    fontSize: '28px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#fff',
  },

  subtitle: {
    fontSize: '15px',
    color: THEME.colors.textMuted,
    marginBottom: '24px',
  },

  toggleWrapper: {
    display: 'inline-flex',
    background: '#1a1a1a',
    padding: '2px',
    borderRadius: THEME.borderRadius.sm,
    border: `1px solid ${THEME.colors.cardBorder}`,
  },

  toggleBtn: (active) => ({
    padding: '6px 16px',
    borderRadius: '2px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? '#262626' : 'transparent',
    color: active ? '#fff' : THEME.colors.textMuted,
    border: 'none',
    transition: 'all 0.2s',
  }),

  // 紧凑型卡片网格
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1px', // 使用 1px 间隙配合背景色实现边框线效果
    background: THEME.colors.cardBorder,
    border: `1px solid ${THEME.colors.cardBorder}`,
    borderRadius: THEME.borderRadius.md,
    overflow: 'hidden',
  },

  card: (isPro) => ({
    background: THEME.colors.cardBg,
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  }),

  planName: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: THEME.colors.textMuted,
    marginBottom: '16px',
  },

  priceSection: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    marginBottom: '8px',
  },

  price: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#fff',
  },

  priceUnit: {
    fontSize: '14px',
    color: THEME.colors.textMuted,
  },

  description: {
    fontSize: '14px',
    color: THEME.colors.textMuted,
    lineHeight: '1.5',
    marginBottom: '24px',
    minHeight: '42px',
  },

  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '32px',
    flexGrow: 1,
  },

  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: '#a3a3a3',
  },

  ctaButton: (isPro) => ({
    height: '40px',
    borderRadius: THEME.borderRadius.sm,
    fontWeight: 600,
    fontSize: '14px',
    background: isPro ? THEME.colors.primary : 'transparent',
    borderColor: isPro ? THEME.colors.primary : THEME.colors.cardBorder,
    color: isPro ? '#000' : '#fff',
  }),

  // 底部信任区域 - 紧凑排版
  trustArea: {
    marginTop: '60px',
    padding: '24px',
    background: '#141414',
    borderRadius: THEME.borderRadius.md,
    border: `1px solid ${THEME.colors.cardBorder}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
  },

  trustItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: THEME.colors.textMuted,
  }
};

// ============================================================
// 子组件
// ============================================================

const PlanCard = ({ plan, isCurrentPlan, isPro, billingCycle, onSubscribe }) => {
  const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const monthlyPrice = billingCycle === 'yearly' && price > 0 ? Math.round(price / 12) : price;
  
  const highlights = {
    free: ['1 个交易账本', '每月 100 笔交易', '30 天历史保留', '基础 AI 分析'],
    pro: ['无限交易账本', '无限 AI 诊断', '蒙特卡洛模拟', '最优止损预测', '数据导出 & API'],
    team: ['包含 Pro 版功能', '支持 5 名成员', '团队数据共享', '专属客户经理', '优先技术支持'],
  };

  return (
    <div style={styles.card(isPro)}>
      <div style={styles.planName}>
        {plan.displayName}
        {isPro && <span style={{ color: THEME.colors.primary, marginLeft: '8px' }}>• 推荐</span>}
      </div>
      
      <div style={styles.priceSection}>
        <span style={styles.price}>${monthlyPrice}</span>
        <span style={styles.priceUnit}>/月</span>
      </div>
      
      <div style={styles.description}>{plan.description}</div>

      <div style={styles.featureList}>
        {highlights[plan.name]?.map((text, i) => (
          <div key={i} style={styles.featureItem}>
            <Check size={14} style={{ color: isPro ? THEME.colors.primary : '#525252' }} />
            {text}
          </div>
        ))}
      </div>

      <Button
        type={isPro ? 'primary' : 'default'}
        block
        onClick={() => onSubscribe(plan.name)}
        disabled={isCurrentPlan && plan.name === 'free'}
        style={styles.ctaButton(isPro)}
      >
        {isCurrentPlan ? '当前计划' : (plan.name === 'free' ? '免费开始' : '立即升级')}
      </Button>
      
      {billingCycle === 'yearly' && price > 0 && (
        <div style={{ textAlign: 'center', fontSize: '11px', color: THEME.colors.textMuted, marginTop: '8px' }}>
          按年计费 (${price}/年)
        </div>
      )}
    </div>
  );
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

    Modal.confirm({
      title: `升级至 ${plan.displayName}`,
      centered: true,
      content: (
        <div style={{ paddingTop: '12px' }}>
          <p style={{ color: '#a3a3a3', fontSize: '14px' }}>解锁高级 AI 诊断和专业交易工具。早鸟优惠已自动应用。</p>
          <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
            <div style={{ fontSize: '12px', color: '#737373' }}>订阅费用</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#fff' }}>
              ${price}<span style={{ fontSize: '14px', color: '#737373' }}>/{billingCycle === 'yearly' ? '年' : '月'}</span>
            </div>
          </div>
        </div>
      ),
      okText: '联系客服开通',
      cancelText: '稍后',
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('客服邮箱已复制');
      },
    });
  };

  const getCurrentPlanName = () => {
    if (!currentSubscription?.hasSubscription) return 'free';
    return currentSubscription.plan?.name || 'free';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: THEME.colors.bg }}>
        <Spin />
      </div>
    );
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: THEME.colors.primary, borderRadius: 4 } }}>
      <div style={styles.page}>
        <div style={styles.container}>
          <header style={styles.header}>
            <h1 style={styles.title}>订阅计划</h1>
            <p style={styles.subtitle}>选择适合您的方案，提升交易分析效率。</p>

            <div style={styles.toggleWrapper}>
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
                年付 (-17%)
              </button>
            </div>
          </header>

          <div style={styles.grid}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={getCurrentPlanName() === plan.name}
                isPro={plan.name === 'pro'}
                billingCycle={billingCycle}
                onSubscribe={handleSubscribe}
              />
            ))}
          </div>

          <div style={styles.trustArea}>
            <div style={styles.trustItem}><Lock size={14} /> SSL 加密</div>
            <div style={styles.trustItem}><CreditCard size={14} /> 安全支付</div>
            <div style={styles.trustItem}><RefreshCw size={14} /> 7天退款</div>
            <div style={styles.trustItem}><ShieldCheck size={14} /> 隐私保护</div>
            <div style={styles.trustItem}><Headphones size={14} /> 技术支持</div>
          </div>

          <div style={{ marginTop: '60px', textAlign: 'center' }}>
            <p style={{ color: THEME.colors.textMuted, fontSize: '13px' }}>
              需要定制化方案或大客户支持？ 
              <a href="mailto:support@metworthai.com" style={{ color: THEME.colors.primary, marginLeft: '8px' }}>联系我们</a>
            </p>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Pricing;
