/**
 * 订阅定价页面 - Apple 设计语言版 (Minimalist & Premium)
 * 
 * 设计原则：
 * 1. 负空间 (Negative Space) - 大量留白，让内容呼吸
 * 2. 极致排版 (Typography) - 强调字重对比，而非颜色对比
 * 3. 玻璃拟态 (Glassmorphism) - 细腻的毛玻璃效果与柔和阴影
 * 4. 动效哲学 (Motion) - 丝滑的微交互，无感而高级
 * 5. 材质感 (Material) - 模拟物理材质的细腻质感
 */
import React, { useState, useEffect } from 'react';
import { Button, Spin, message, Modal, ConfigProvider } from 'antd';
import { 
  Check, 
  ChevronRight,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Headphones,
  Zap,
  Crown,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { getPlans, getSubscriptionStatus } from '../services/subscription';

// ============================================================
// Apple 设计系统常量
// ============================================================
const APPLE_THEME = {
  colors: {
    bg: '#000000',
    card: 'rgba(28, 28, 30, 0.5)',
    cardHover: 'rgba(44, 44, 46, 0.7)',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#FFFFFF',
    textSecondary: '#86868b', // Apple 经典的次级文本色
    accent: '#0071e3', // Apple Blue
    gold: '#d4af37',
    purple: '#bf5af2', // Apple Purple
    success: '#32d74b',
  },
  fonts: {
    display: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Myriad Set Pro", "SF Pro Icons", "Apple Legacy Chevron", "Helvetica Neue", Helvetica, Arial, sans-serif',
  }
};

const styles = {
  page: {
    minHeight: '100%',
    background: APPLE_THEME.colors.bg,
    color: APPLE_THEME.colors.text,
    fontFamily: APPLE_THEME.fonts.body,
    paddingBottom: '100px',
    overflowX: 'hidden',
  },
  
  hero: {
    textAlign: 'center',
    padding: '80px 24px 60px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  
  superTitle: {
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: APPLE_THEME.colors.accent,
    marginBottom: '16px',
    display: 'block',
  },
  
  title: {
    fontSize: '56px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    marginBottom: '20px',
    background: 'linear-gradient(180deg, #FFFFFF 0%, #A1A1A1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  
  subtitle: {
    fontSize: '21px',
    lineHeight: 1.4,
    fontWeight: 400,
    color: APPLE_THEME.colors.textSecondary,
    maxWidth: '600px',
    margin: '0 auto 40px',
  },

  toggleContainer: {
    display: 'inline-flex',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '4px',
    borderRadius: '30px',
    border: `1px solid ${APPLE_THEME.colors.border}`,
    marginBottom: '60px',
  },

  toggleBtn: (active) => ({
    padding: '8px 24px',
    borderRadius: '26px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? '#FFFFFF' : 'transparent',
    color: active ? '#000000' : APPLE_THEME.colors.textSecondary,
    border: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }),

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '30px',
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px',
  },

  card: (isPopular, isElite) => ({
    background: APPLE_THEME.colors.card,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '40px',
    border: `1px solid ${isPopular ? 'rgba(255, 255, 255, 0.2)' : APPLE_THEME.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.4s cubic-bezier(0.2, 0, 0.2, 1), background 0.4s ease',
    cursor: 'default',
    position: 'relative',
    overflow: 'hidden',
  }),

  cardBadge: (isElite) => ({
    position: 'absolute',
    top: '20px',
    right: '24px',
    fontSize: '12px',
    fontWeight: 600,
    color: isElite ? APPLE_THEME.colors.purple : APPLE_THEME.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }),

  planName: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px',
  },

  priceWrapper: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    margin: '20px 0 12px',
  },

  priceSymbol: {
    fontSize: '24px',
    fontWeight: 600,
    alignSelf: 'flex-start',
    marginTop: '4px',
  },

  priceAmount: {
    fontSize: '56px',
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },

  pricePeriod: {
    fontSize: '17px',
    color: APPLE_THEME.colors.textSecondary,
  },

  savingsTag: {
    display: 'inline-block',
    fontSize: '13px',
    fontWeight: 500,
    color: APPLE_THEME.colors.success,
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
    fontSize: '15px',
    color: APPLE_THEME.colors.text,
    marginBottom: '16px',
    lineHeight: 1.4,
  },

  ctaButton: (isPrimary, isElite) => ({
    height: '52px',
    borderRadius: '26px',
    fontSize: '17px',
    fontWeight: 600,
    background: isPrimary ? (isElite ? APPLE_THEME.colors.purple : '#FFFFFF') : 'transparent',
    borderColor: isPrimary ? 'transparent' : 'rgba(255, 255, 255, 0.3)',
    color: isPrimary ? (isElite ? '#FFFFFF' : '#000000') : '#FFFFFF',
    transition: 'all 0.2s ease',
  }),

  footer: {
    maxWidth: '900px',
    margin: '100px auto 0',
    padding: '0 24px',
    textAlign: 'center',
  },

  trustGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '40px',
    marginBottom: '80px',
  },

  trustItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: APPLE_THEME.colors.textSecondary,
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
      styles: {
        content: {
          background: '#1c1c1e',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
        }
      },
      content: (
        <div style={{ textAlign: 'center', padding: '20px 10px' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            background: planName === 'elite' ? 'rgba(191, 90, 242, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            {planName === 'elite' ? <Crown color={APPLE_THEME.colors.purple} size={30} /> : <Zap color="#FFFFFF" size={30} />}
          </div>
          <h3 style={{ color: '#FFF', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>升级到 {plan.displayName}</h3>
          <p style={{ color: APPLE_THEME.colors.textSecondary, fontSize: '15px', marginBottom: '24px' }}>
            解锁专业级 AI 交易洞察，开启您的进阶之路。
          </p>
          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            padding: '20px', 
            borderRadius: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '13px', color: APPLE_THEME.colors.textSecondary, marginBottom: '4px' }}>
              {billingCycle === 'yearly' ? '年付方案' : '月付方案'}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#FFF' }}>
              ${monthlyPrice}<span style={{ fontSize: '16px', fontWeight: 400, color: APPLE_THEME.colors.textSecondary }}>/月</span>
            </div>
          </div>
          <div style={{ textAlign: 'left', fontSize: '13px', color: APPLE_THEME.colors.textSecondary, lineHeight: 1.8 }}>
            • 7 天无理由全额退款保障<br/>
            • 随时可在设置中管理或取消订阅<br/>
            • 升级立即生效，数据无缝迁移
          </div>
        </div>
      ),
      okText: '立即升级',
      cancelText: '取消',
      okButtonProps: {
        style: {
          background: planName === 'elite' ? APPLE_THEME.colors.purple : '#FFF',
          borderColor: 'transparent',
          color: planName === 'elite' ? '#FFF' : '#000',
          height: '44px',
          borderRadius: '22px',
          fontWeight: 600,
          padding: '0 30px'
        }
      },
      cancelButtonProps: {
        style: {
          height: '44px',
          borderRadius: '22px',
          background: 'transparent',
          color: APPLE_THEME.colors.textSecondary,
          border: 'none'
        }
      },
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('客服邮箱已复制，请联系开通');
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#000' }}>
        <Spin size="large" />
      </div>
    );
  }

  const currentPlan = currentSubscription?.plan?.name || 'free';

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#FFFFFF', borderRadius: 12 } }}>
      <div style={styles.page}>
        {/* Hero Section */}
        <div style={styles.hero}>
          <span style={styles.superTitle}>MetworthAI 订阅</span>
          <h1 style={styles.title}>选择适合你的方案</h1>
          <p style={styles.subtitle}>
            无论您是刚起步的交易者，还是追求极致的专业人士，我们都有为您量身打造的分析工具。
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.background = APPLE_THEME.colors.cardHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = APPLE_THEME.colors.card;
                }}
              >
                {isPro && <span style={styles.cardBadge(false)}>最受欢迎</span>}
                {isElite && <span style={styles.cardBadge(true)}>VIP 专属</span>}
                
                <h3 style={styles.planName}>{plan.displayName}</h3>
                <p style={{ color: APPLE_THEME.colors.textSecondary, fontSize: '15px', minHeight: '44px' }}>
                  {plan.description}
                </p>

                <div style={styles.priceWrapper}>
                  {!isFree && <span style={styles.priceSymbol}>$</span>}
                  <span style={styles.priceAmount}>{monthlyPrice}</span>
                  <span style={styles.pricePeriod}>/月</span>
                </div>

                {savings > 0 && billingCycle === 'yearly' ? (
                  <span style={styles.savingsTag}>年付立省 ${savings}</span>
                ) : <div style={{ height: '20px', marginBottom: '24px' }} />}

                <ul style={styles.featureList}>
                  {features[plan.name]?.map((feat, i) => (
                    <li key={i} style={styles.featureItem}>
                      <Check size={18} color={isElite ? APPLE_THEME.colors.purple : (isPro ? APPLE_THEME.colors.accent : APPLE_THEME.colors.success)} />
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

        {/* Footer & Trust */}
        <div style={styles.footer}>
          <div style={styles.trustGrid}>
            <div style={styles.trustItem}>
              <ShieldCheck size={28} strokeWidth={1.5} />
              <span>SSL 安全加密</span>
            </div>
            <div style={styles.trustItem}>
              <CreditCard size={28} strokeWidth={1.5} />
              <span>多种支付方式</span>
            </div>
            <div style={styles.trustItem}>
              <RefreshCw size={28} strokeWidth={1.5} />
              <span>7天无理由退款</span>
            </div>
            <div style={styles.trustItem}>
              <Headphones size={28} strokeWidth={1.5} />
              <span>24/7 优先支持</span>
            </div>
          </div>

          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            padding: '40px', 
            borderRadius: '32px',
            border: `1px solid ${APPLE_THEME.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <Sparkles size={32} color={APPLE_THEME.colors.accent} />
            <h3 style={{ fontSize: '24px', fontWeight: 600 }}>需要企业级定制？</h3>
            <p style={{ color: APPLE_THEME.colors.textSecondary, maxWidth: '500px' }}>
              如果您是机构交易员或需要 API 深度集成，请联系我们的专家团队。
            </p>
            <Button 
              type="link" 
              href="mailto:support@metworthai.com"
              style={{ fontSize: '17px', color: APPLE_THEME.colors.accent, fontWeight: 500 }}
            >
              联系专家团队 <ChevronRight size={18} style={{ verticalAlign: 'middle', marginTop: '-2px' }} />
            </Button>
          </div>

          <p style={{ marginTop: '60px', color: APPLE_THEME.colors.textSecondary, fontSize: '13px' }}>
            © 2026 MetworthAI. 所有的订阅方案均受我们的服务条款和隐私政策约束。
          </p>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Pricing;
