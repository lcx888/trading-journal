/**
 * 订阅定价页面 - 极致现代化设计
 * 采用极简主义、磨砂玻璃效果和流动光效
 */
import React, { useState, useEffect } from 'react';
import { Button, Spin, message, Modal } from 'antd';
import { 
  Check, 
  X, 
  Sparkles, 
  ArrowRight,
  Star,
  Rocket,
  Gift,
  Headphones,
  Lock,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { getPlans, getSubscriptionStatus, cancelSubscription, getPlanDisplayInfo } from '../services/subscription';

// ============================================================
// 样式常量
// ============================================================
const COLORS = {
  primary: '#d97706',
  primaryGlow: 'rgba(217, 119, 6, 0.4)',
  bg: '#050505',
  cardBg: 'rgba(255, 255, 255, 0.03)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  textMain: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.5)',
};

const styles = {
  page: {
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.textMain,
    fontFamily: 'Inter, system-ui, sans-serif',
    position: 'relative',
    overflowX: 'hidden',
    paddingBottom: 100,
  },
  
  // 动态背景光效
  ambientLight: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    height: '100%',
    background: `
      radial-gradient(circle at 20% 20%, rgba(217, 119, 6, 0.05) 0%, transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(217, 119, 6, 0.03) 0%, transparent 40%)
    `,
    pointerEvents: 'none',
    zIndex: 0,
  },

  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '80px 24px',
    position: 'relative',
    zIndex: 1,
  },

  header: {
    textAlign: 'center',
    marginBottom: 80,
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    borderRadius: 100,
    background: 'rgba(217, 119, 6, 0.1)',
    border: '1px solid rgba(217, 119, 6, 0.2)',
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 24,
    letterSpacing: '0.02em',
  },

  title: {
    fontSize: 'clamp(40px, 5vw, 64px)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
    marginBottom: 24,
    background: 'linear-gradient(to bottom, #fff 40%, rgba(255,255,255,0.7))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },

  subtitle: {
    fontSize: 18,
    color: COLORS.textMuted,
    maxWidth: 600,
    margin: '0 auto 48px',
    lineHeight: 1.6,
  },

  // 计费切换器
  toggleContainer: {
    display: 'inline-flex',
    padding: 4,
    borderRadius: 100,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
  },

  toggleBtn: (active) => ({
    padding: '10px 24px',
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: active ? COLORS.primary : 'transparent',
    color: active ? '#000' : COLORS.textMuted,
    boxShadow: active ? `0 4px 12px ${COLORS.primaryGlow}` : 'none',
  }),

  // 卡片布局
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 32,
    alignItems: 'stretch',
  },

  card: (isPro) => ({
    position: 'relative',
    padding: '48px 40px',
    borderRadius: 32,
    background: isPro ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${isPro ? 'rgba(217, 119, 6, 0.3)' : 'rgba(255,255,255,0.08)'}`,
    backdropFilter: 'blur(10px)',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
  }),

  proGlow: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    height: '1px',
    background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)`,
  },

  price: {
    fontSize: 56,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },

  featureList: {
    marginTop: 40,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },

  // 底部信任区域
  trustArea: {
    marginTop: 120,
    textAlign: 'center',
  },

  trustGrid: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 40,
    opacity: 0.6,
  }
};

// ============================================================
// 子组件
// ============================================================

const PlanCard = ({ plan, isCurrentPlan, isPro, billingCycle, onSubscribe, onCancel }) => {
  const [hover, setHover] = useState(false);
  
  const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const monthlyPrice = billingCycle === 'yearly' && price > 0 ? Math.round(price / 12) : price;
  const originalMonthly = plan.priceMonthly;
  
  const planHighlights = {
    free: ['1 个交易账本', '每月 100 笔交易', '30 天历史数据', '3 次 AI 分析'],
    pro: ['无限交易账本', '无限 AI 诊断次数', '蒙特卡洛模拟', '最优止损分析', '数据导出 & API'],
    team: ['最多 5 名成员', '团队数据共享', '角色权限管理', '专属客户经理', '优先技术支持'],
  };

  const highlights = planHighlights[plan.name] || [];

  return (
    <div 
      style={{
        ...styles.card(isPro),
        transform: hover ? 'translateY(-12px)' : 'none',
        boxShadow: hover ? (isPro ? `0 40px 80px -20px rgba(217, 119, 6, 0.2)` : `0 40px 80px -20px rgba(0,0,0,0.5)`) : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {isPro && <div style={styles.proGlow} />}
      
      {isPro && (
          <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: COLORS.primary,
          color: '#000',
          padding: '4px 12px',
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          最受欢迎
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: isPro ? COLORS.primary : '#fff', marginBottom: 8 }}>
          {plan.displayName}
        </h3>
        <p style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.5 }}>
          {plan.description}
        </p>
      </div>

      <div style={styles.price}>
        <span style={{ fontSize: 24, fontWeight: 600, alignSelf: 'flex-start', marginTop: 12 }}>$</span>
        {monthlyPrice}
        <span style={{ fontSize: 16, fontWeight: 500, color: COLORS.textMuted }}>/月</span>
      </div>

      {billingCycle === 'yearly' && price > 0 && (
        <div style={{ fontSize: 13, color: COLORS.primary, fontWeight: 600, marginBottom: 32 }}>
          按年计费 (${price}/年)
        </div>
      )}
      {price === 0 && <div style={{ height: 20, marginBottom: 32 }} />}

      <Button
        type={isPro ? 'primary' : 'default'}
        block
        onClick={() => onSubscribe(plan.name)}
        disabled={isCurrentPlan && plan.name === 'free'}
        style={{
          height: 56,
          borderRadius: 16,
          background: isPro ? COLORS.primary : 'rgba(255,255,255,0.05)',
          border: isPro ? 'none' : '1px solid rgba(255,255,255,0.1)',
          color: isPro ? '#000' : '#fff',
          fontWeight: 700,
          fontSize: 16,
          boxShadow: isPro && hover ? `0 12px 24px ${COLORS.primaryGlow}` : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {isCurrentPlan ? '当前计划' : (plan.name === 'free' ? '免费开始' : '立即升级')}
      </Button>

      <div style={styles.featureList}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          包含功能
        </div>
        {highlights.map((text, i) => (
          <div key={i} style={styles.featureItem}>
            <Check size={16} style={{ color: isPro ? COLORS.primary : '#10b981' }} strokeWidth={3} />
            {text}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// 主页面组件
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
      console.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (planName) => {
    if (planName === 'free') return;
    
    const plan = plans.find(p => p.name === planName);
    const price = billingCycle === 'yearly' ? plan?.priceYearly : plan?.priceMonthly;

    Modal.confirm({
      title: null,
      icon: null,
      width: 400,
      centered: true,
      bodyStyle: { padding: 0, overflow: 'hidden', borderRadius: 24 },
      content: (
        <div style={{ background: '#0a0a0a', padding: 32, color: '#fff' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 24 }}>
            {planName === 'pro' ? '⚡' : '🏢'}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#fff' }}>升级到 {planName === 'pro' ? '专业版' : '团队版'}</h2>
          <p style={{ color: COLORS.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
            解锁高级 AI 诊断和专业交易工具。已应用早鸟优惠。
          </p>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, marginBottom: 32, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 4 }}>价格</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>${price}<span style={{ fontSize: 14, color: COLORS.textMuted }}>/{billingCycle === 'yearly' ? '年' : '月'}</span></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: COLORS.primary, fontSize: 14, fontWeight: 600 }}>
            <Gift size={18} />
            早鸟优惠已激活
          </div>
        </div>
      ),
      okText: '联系支持',
      cancelText: '稍后再说',
      okButtonProps: { style: { background: COLORS.primary, border: 'none', height: 44, borderRadius: 12, fontWeight: 700, color: '#000' } },
      cancelButtonProps: { style: { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', height: 44, borderRadius: 12 } },
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('支持邮箱已复制到剪贴板');
      },
    });
  };

  const getCurrentPlanName = () => {
    if (!currentSubscription?.hasSubscription) return 'free';
    return currentSubscription.plan?.name || 'free';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: COLORS.bg }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.ambientLight} />
      
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.badge}>
            <Sparkles size={14} fill="currentColor" />
            限时优惠：年付立省 17%
          </div>
          
          <h1 style={styles.title}>
            为专业交易者量身定制<br />透明且可预测的价格。
          </h1>
          
          <p style={styles.subtitle}>
            从个人交易者到专业团队，我们都有适合您成长阶段的计划。
          </p>

          <div style={styles.toggleContainer}>
            <div 
              style={styles.toggleBtn(billingCycle === 'monthly')}
              onClick={() => setBillingCycle('monthly')}
            >
              月付
            </div>
            <div 
              style={styles.toggleBtn(billingCycle === 'yearly')}
              onClick={() => setBillingCycle('yearly')}
            >
              年付
            </div>
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

        <section style={styles.trustArea}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 48 }}>
            安全保障与专业支持
          </div>
          <div style={styles.trustGrid}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={20} /> SSL 加密传输
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CreditCard size={20} /> 安全支付
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <RefreshCw size={20} /> 7天退款保证
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Headphones size={20} /> 24/7 技术支持
            </div>
          </div>
        </section>

        <div style={{ marginTop: 120, textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>还有疑问？</h2>
          <p style={{ color: COLORS.textMuted, marginBottom: 32 }}>我们的团队随时准备为您解答，帮助您选择最合适的计划。</p>
          <Button 
            size="large"
            onClick={() => window.open('mailto:support@metworthai.com')}
            style={{
              height: 56,
              paddingInline: 40,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            联系我们
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
