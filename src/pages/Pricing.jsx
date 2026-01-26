/**
 * 订阅定价页面 - 极简主义专业版 (Minimalist Professional)
 * 
 * 设计哲学：
 * 1. 去营销化 (De-marketing) - 移除所有夸张的渐变、阴影和徽章。
 * 2. 灰阶美学 (Grayscale Aesthetic) - 仅使用黑、白、灰，辅以极少量的品牌色。
 * 3. 极致排版 (Typography First) - 通过字重和间距而非颜色来区分层级。
 * 4. 工业感 (Industrial Feel) - 强调线条感和结构感，符合专业交易工具定位。
 */
import React, { useState, useEffect } from 'react';
import { Button, Spin, message, Modal, ConfigProvider } from 'antd';
import { 
  Check, 
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Headphones,
  ArrowRight
} from 'lucide-react';
import { getPlans, getSubscriptionStatus } from '../services/subscription';

const THEME = {
  bg: '#0a0a0a',
  card: '#111111',
  border: '#222222',
  borderHover: '#333333',
  text: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#444444',
  accent: '#ffffff', // 极致简约，主色调为白
  brand: '#eab308', // 仅在必要时使用的品牌色
};

const styles = {
  page: {
    minHeight: '100%',
    background: THEME.bg,
    color: THEME.text,
    paddingBottom: '100px',
    fontFamily: 'Inter, -apple-system, sans-serif',
  },
  
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 24px',
  },

  header: {
    padding: '80px 0 60px',
    textAlign: 'left', // 改为左对齐，更显专业工具感
  },
  
  title: {
    fontSize: '32px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    marginBottom: '12px',
  },
  
  subtitle: {
    fontSize: '15px',
    color: THEME.textSecondary,
    maxWidth: '500px',
    lineHeight: 1.6,
  },

  toggleWrapper: {
    display: 'inline-flex',
    background: '#161616',
    padding: '3px',
    borderRadius: '6px',
    border: `1px solid ${THEME.border}`,
    marginTop: '32px',
  },

  toggleBtn: (active) => ({
    padding: '6px 16px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? '#262626' : 'transparent',
    color: active ? '#fff' : THEME.textMuted,
    border: 'none',
    transition: 'all 0.2s',
  }),

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1px', // 使用 1px 间隙配合背景色实现细线边框效果
    background: THEME.border,
    border: `1px solid ${THEME.border}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },

  card: {
    background: THEME.card,
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },

  planLabel: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: THEME.textSecondary,
    marginBottom: '24px',
  },

  priceSection: {
    marginBottom: '32px',
  },

  price: {
    fontSize: '40px',
    fontWeight: 600,
    fontFamily: 'JetBrains Mono, monospace',
  },

  period: {
    fontSize: '14px',
    color: THEME.textMuted,
    marginLeft: '4px',
  },

  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 40px 0',
    flex: 1,
  },

  featureItem: (included) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: included ? THEME.text : THEME.textMuted,
    marginBottom: '14px',
  }),

  ctaButton: (isPrimary) => ({
    height: '44px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 600,
    background: isPrimary ? '#fff' : 'transparent',
    borderColor: isPrimary ? '#fff' : THEME.border,
    color: isPrimary ? '#000' : '#fff',
    boxShadow: 'none',
  }),

  trustArea: {
    marginTop: '80px',
    padding: '40px 0',
    borderTop: `1px solid ${THEME.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '32px',
  },

  trustItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: THEME.textMuted,
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
      width: 360,
      styles: {
        content: {
          background: '#111',
          border: '1px solid #222',
          borderRadius: '8px',
        }
      },
      content: (
        <div style={{ padding: '10px 0' }}>
          <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>订阅 {plan.displayName}</h3>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
            升级后将立即解锁所有专业功能。
          </p>
          <div style={{ 
            background: '#181818', 
            padding: '20px', 
            borderRadius: '4px',
            marginBottom: '24px',
            border: '1px solid #222'
          }}>
            <div style={{ fontSize: '12px', color: '#444', marginBottom: '4px' }}>
              {billingCycle === 'yearly' ? '按年计费' : '按月计费'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#fff', fontFamily: 'JetBrains Mono' }}>
              ${monthlyPrice}<span style={{ fontSize: '14px', color: '#444' }}>/月</span>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#444', lineHeight: 1.6 }}>
            • 7 天退款保障<br/>
            • 随时取消订阅<br/>
            • 增值税已包含（如适用）
          </div>
        </div>
      ),
      okText: '确认订阅',
      cancelText: '取消',
      okButtonProps: {
        style: { background: '#fff', borderColor: '#fff', color: '#000', borderRadius: '4px', fontWeight: 600 }
      },
      cancelButtonProps: {
        style: { color: '#666', border: 'none' }
      },
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('客服邮箱已复制');
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: THEME.bg }}>
        <Spin />
      </div>
    );
  }

  const currentPlan = currentSubscription?.plan?.name || 'free';

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#fff', borderRadius: 4 } }}>
      <div style={styles.page}>
        <div style={styles.container}>
          <header style={styles.header}>
            <h1 style={styles.title}>订阅方案</h1>
            <p style={styles.subtitle}>
              选择适合您的专业交易工具集。所有付费方案均包含完整的 AI 诊断能力。
            </p>

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
                年付 (-20%)
              </button>
            </div>
          </header>

          <div style={styles.grid}>
            {plans.map((plan) => {
              const isFree = plan.name === 'free';
              const isPro = plan.name === 'pro';
              const isElite = plan.name === 'elite';
              const isCurrent = currentPlan === plan.name;
              
              const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
              const monthlyPrice = billingCycle === 'yearly' && price > 0 ? Math.round(price / 12) : price;

              const features = {
                free: [
                  { text: '1 个交易账本', inc: true },
                  { text: '每月 50 笔交易', inc: true },
                  { text: '7 天历史保留', inc: true },
                  { text: 'AI 分析 (2次/月)', inc: true },
                  { text: '高级智能诊断', inc: false },
                  { text: 'API 接口访问', inc: false },
                ],
                pro: [
                  { text: '无限交易账本', inc: true },
                  { text: '无限交易笔数', inc: true },
                  { text: '永久历史保留', inc: true },
                  { text: '无限 AI 分析', inc: true },
                  { text: '高级智能诊断', inc: true },
                  { text: 'API 接口访问', inc: false },
                ],
                elite: [
                  { text: '包含 Pro 所有功能', inc: true },
                  { text: 'API 接口访问', inc: true },
                  { text: '优先技术支持', inc: true },
                  { text: '1对1 策略咨询', inc: true },
                  { text: '专属交易报告', inc: true },
                  { text: '新功能抢先体验', inc: true },
                ]
              };

              return (
                <div key={plan.id} style={styles.card}>
                  <div style={styles.planLabel}>{plan.displayName}</div>
                  
                  <div style={styles.priceSection}>
                    <span style={styles.price}>${monthlyPrice}</span>
                    <span style={styles.period}>/月</span>
                  </div>

                  <ul style={styles.featureList}>
                    {features[plan.name]?.map((f, i) => (
                      <li key={i} style={styles.featureItem(f.inc)}>
                        <Check size={14} strokeWidth={3} style={{ opacity: f.inc ? 1 : 0 }} />
                        {f.text}
                      </li>
                    ))}
                  </ul>

                  <Button
                    type={isPro || isElite ? 'primary' : 'default'}
                    block
                    disabled={isCurrent}
                    onClick={() => handleSubscribe(plan.name)}
                    style={styles.ctaButton(isPro || isElite)}
                  >
                    {isCurrent ? '当前方案' : (isFree ? '开始使用' : '立即升级')}
                  </Button>
                </div>
              );
            })}
          </div>

          <footer style={styles.trustArea}>
            <div style={styles.trustItem}><ShieldCheck size={16} /> SSL 加密</div>
            <div style={styles.trustItem}><CreditCard size={16} /> 安全支付</div>
            <div style={styles.trustItem}><RefreshCw size={16} /> 7天退款</div>
            <div style={styles.trustItem}><Headphones size={16} /> 技术支持</div>
            <div style={{ flex: 1 }} />
            <a 
              href="mailto:support@metworthai.com" 
              style={{ 
                color: THEME.text, 
                fontSize: '13px', 
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              联系专家团队 <ArrowRight size={14} />
            </a>
          </footer>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Pricing;
