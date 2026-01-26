/**
 * 订阅定价页面 - 重新设计版
 * 现代化 SaaS 定价页面设计
 */
import React, { useState, useEffect } from 'react';
import { Button, Switch, Spin, message, Modal, Tooltip } from 'antd';
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
  ChevronRight,
  Star,
  TrendingUp,
  Rocket,
  Gift,
  Infinity,
  Building2,
  Headphones,
  Lock,
  CreditCard,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { getPlans, getSubscriptionStatus, cancelSubscription, getPlanDisplayInfo } from '../services/subscription';

// ============================================================
// 样式变量
// ============================================================
const styles = {
  // 页面容器
  page: {
    minHeight: '100vh',
    background: '#09090b',
    position: 'relative',
    overflow: 'hidden',
  },
  
  // 背景装饰
  bgGlow: {
    position: 'absolute',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '140%',
    height: '600px',
    background: 'radial-gradient(ellipse at center, rgba(217, 119, 6, 0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  
  // 内容容器
  container: {
    position: 'relative',
    maxWidth: 1200,
    margin: '0 auto',
    padding: '48px 24px 80px',
  },
  
  // 标题区域
  header: {
    textAlign: 'center',
    marginBottom: 56,
  },
  
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(217, 119, 6, 0.05) 100%)',
    border: '1px solid rgba(217, 119, 6, 0.3)',
    borderRadius: 100,
    padding: '8px 16px',
    marginBottom: 24,
  },
  
  title: {
    fontSize: 48,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 16,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
  },
  
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    maxWidth: 500,
    margin: '0 auto',
    lineHeight: 1.6,
  },
  
  // 计费切换
  billingToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 16,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 100,
    padding: '6px 8px',
    marginTop: 32,
  },
  
  billingOption: (active) => ({
    padding: '10px 20px',
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
  }),
  
  saveBadge: {
    background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 600,
    marginLeft: 8,
  },
  
  // 卡片网格
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 24,
    marginBottom: 64,
  },
  
  // 响应式网格
  gridResponsive: `
    @media (max-width: 1024px) {
      grid-template-columns: repeat(2, 1fr);
    }
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
};

// ============================================================
// 计划卡片组件
// ============================================================
const PlanCard = ({ plan, isCurrentPlan, isPro, isTeam, billingCycle, onSubscribe, onCancel }) => {
  const [hover, setHover] = useState(false);
  
  const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const monthlyPrice = billingCycle === 'yearly' && price > 0 ? Math.round(price / 12) : price;
  const originalMonthly = plan.priceMonthly;
  const savings = billingCycle === 'yearly' && price > 0 
    ? Math.round((originalMonthly * 12 - price)) 
    : 0;
  
  const displayInfo = getPlanDisplayInfo(plan.name);
  
  // 定义每个计划的核心卖点
  const planHighlights = {
    free: [
      { text: '1 个交易账本', included: true },
      { text: '每月 100 笔交易', included: true },
      { text: '30 天历史数据', included: true },
      { text: '3 次 AI 分析', included: true },
      { text: '智能诊断系统', included: false },
      { text: '蒙特卡洛模拟', included: false },
      { text: '数据导出', included: false },
    ],
    pro: [
      { text: '无限交易账本', included: true },
      { text: '无限交易记录', included: true },
      { text: '完整历史数据', included: true },
      { text: '无限 AI 分析', included: true },
      { text: '智能诊断系统', included: true },
      { text: '蒙特卡洛模拟', included: true },
      { text: '数据导出 & API', included: true },
    ],
    team: [
      { text: 'Pro 版全部功能', included: true },
      { text: '最多 5 名成员', included: true },
      { text: '团队数据共享', included: true },
      { text: '角色权限管理', included: true },
      { text: '团队分析报告', included: true },
      { text: '优先技术支持', included: true },
      { text: '专属客户经理', included: true },
    ],
  };
  
  const highlights = planHighlights[plan.name] || planHighlights.free;
  
  // 图标映射
  const iconMap = {
    free: '🎯',
    pro: '⚡',
    team: '🏢',
  };
  
  const cardStyle = {
    position: 'relative',
    background: isPro 
      ? 'linear-gradient(180deg, rgba(217, 119, 6, 0.12) 0%, rgba(217, 119, 6, 0.02) 100%)'
      : 'rgba(255,255,255,0.02)',
    border: isPro 
      ? '2px solid rgba(217, 119, 6, 0.4)'
      : '1px solid rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 32,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: hover ? 'translateY(-8px)' : 'translateY(0)',
    boxShadow: hover 
      ? isPro 
        ? '0 32px 64px -12px rgba(217, 119, 6, 0.25)'
        : '0 32px 64px -12px rgba(0, 0, 0, 0.5)'
      : 'none',
  };

  return (
    <div 
      style={cardStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 推荐标签 */}
      {isPro && (
        <div style={{
          position: 'absolute',
          top: -14,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
          color: '#000',
          padding: '6px 20px',
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)',
        }}>
          <Star size={12} fill="currentColor" />
          最受欢迎
        </div>
      )}
      
      {/* 当前计划标识 */}
      {isCurrentPlan && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          padding: '4px 12px',
          borderRadius: 100,
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <CheckCircle2 size={12} />
          当前
        </div>
      )}

      {/* 计划头部 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          fontSize: 40, 
          marginBottom: 12,
          filter: isPro ? 'drop-shadow(0 0 8px rgba(217, 119, 6, 0.5))' : 'none',
        }}>
          {iconMap[plan.name]}
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
          lineHeight: 1.5,
          minHeight: 42,
        }}>
          {plan.description}
        </p>
      </div>

      {/* 价格 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          {billingCycle === 'yearly' && price > 0 && (
            <span style={{ 
              fontSize: 20, 
              color: 'rgba(255,255,255,0.3)',
              textDecoration: 'line-through',
              marginRight: 8,
            }}>
              ${originalMonthly}
            </span>
          )}
          <span style={{ 
            fontSize: 56, 
            fontWeight: 800, 
            color: '#fff',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}>
            ${monthlyPrice}
          </span>
          <span style={{ 
            color: 'rgba(255,255,255,0.4)',
            fontSize: 16,
          }}>
            /月
          </span>
        </div>
        
        {billingCycle === 'yearly' && savings > 0 && (
          <div style={{ 
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}>
              年付省 ${savings}
            </span>
            <span style={{ 
              color: 'rgba(255,255,255,0.4)', 
              fontSize: 13,
            }}>
              按年付费 ${price}
            </span>
          </div>
        )}
        
        {price === 0 && (
          <div style={{ 
            marginTop: 8,
            color: 'rgba(255,255,255,0.4)', 
            fontSize: 13,
          }}>
            永久免费
          </div>
        )}
      </div>

      {/* CTA 按钮 */}
      {isCurrentPlan ? (
        plan.name === 'free' ? (
          <Button
            block
            size="large"
            disabled
            style={{
              height: 52,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 600,
              fontSize: 15,
              marginBottom: 28,
            }}
          >
            当前计划
          </Button>
        ) : (
          <Button
            block
            size="large"
            onClick={onCancel}
            style={{
              height: 52,
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontWeight: 600,
              fontSize: 15,
              marginBottom: 28,
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
          onClick={() => onSubscribe(plan.name)}
          style={{
            height: 52,
            borderRadius: 12,
            background: isPro 
              ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
              : plan.name === 'free' 
                ? 'transparent'
                : 'rgba(255,255,255,0.08)',
            border: isPro 
              ? 'none' 
              : plan.name === 'free'
                ? '1px solid rgba(255,255,255,0.15)'
                : '1px solid rgba(255,255,255,0.1)',
            color: isPro ? '#000' : '#fff',
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: isPro ? '0 8px 24px rgba(217, 119, 6, 0.35)' : 'none',
          }}
        >
          {plan.name === 'free' ? '开始使用' : '立即升级'}
          <ArrowRight size={18} />
        </Button>
      )}

      {/* 功能列表 */}
      <div>
        {highlights.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: index < highlights.length - 1 
                ? '1px solid rgba(255,255,255,0.04)' 
                : 'none',
            }}
          >
            {item.included ? (
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: isPro 
                  ? 'rgba(217, 119, 6, 0.15)'
                  : 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check 
                  size={12} 
                  strokeWidth={3}
                  style={{ color: isPro ? '#f59e0b' : '#10b981' }} 
                />
              </div>
            ) : (
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <X size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
            )}
            <span style={{ 
              color: item.included ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
              fontSize: 14,
              textDecoration: item.included ? 'none' : 'line-through',
            }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// 信任指标
// ============================================================
const TrustSection = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 48,
    padding: '40px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: 64,
  }}>
    {[
      { icon: Lock, text: 'SSL 加密传输' },
      { icon: CreditCard, text: '安全支付' },
      { icon: RefreshCw, text: '7天无理由退款' },
      { icon: Shield, text: '数据隐私保护' },
      { icon: Headphones, text: '7×24 技术支持' },
    ].map((item, index) => (
      <div 
        key={index}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <item.icon size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          {item.text}
        </span>
      </div>
    ))}
  </div>
);

// ============================================================
// 功能对比表
// ============================================================
const ComparisonTable = () => {
  const features = [
    { name: '交易账本', free: '1 个', pro: '无限', team: '无限' },
    { name: '每月交易记录', free: '100 笔', pro: '无限', team: '无限' },
    { name: '历史数据保留', free: '30 天', pro: '无限', team: '无限' },
    { name: 'AI 分析次数', free: '3 次/月', pro: '无限', team: '无限' },
    { name: '智能诊断系统', free: false, pro: true, team: true },
    { name: '蒙特卡洛模拟', free: false, pro: true, team: true },
    { name: '最优止损分析', free: false, pro: true, team: true },
    { name: '期望值分布', free: false, pro: true, team: true },
    { name: '行为归因标签', free: false, pro: true, team: true },
    { name: '数据导出', free: false, pro: true, team: true },
    { name: 'API 接口', free: false, pro: true, team: true },
    { name: '团队成员', free: '1 人', pro: '1 人', team: '最多 5 人' },
    { name: '优先技术支持', free: false, pro: true, team: true },
  ];
  
  const renderValue = (val) => {
    if (val === true) return <Check size={18} style={{ color: '#10b981' }} />;
    if (val === false) return <X size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />;
    return <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{val}</span>;
  };

  return (
    <div style={{ marginBottom: 64 }}>
      <h2 style={{ 
        fontSize: 28, 
        fontWeight: 700, 
        color: '#fff',
        textAlign: 'center',
        marginBottom: 40,
      }}>
        功能对比
      </h2>
      
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        {/* 表头 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ padding: 20, color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600 }}>
            功能
          </div>
          <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>
            Free
          </div>
          <div style={{ 
            padding: 20, 
            textAlign: 'center', 
            background: 'rgba(217, 119, 6, 0.1)',
            color: '#f59e0b', 
            fontSize: 14, 
            fontWeight: 700,
          }}>
            Pro ⭐
          </div>
          <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>
            Team
          </div>
        </div>
        
        {/* 表格内容 */}
        {features.map((feature, index) => (
          <div 
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              borderBottom: index < features.length - 1 
                ? '1px solid rgba(255,255,255,0.04)' 
                : 'none',
            }}
          >
            <div style={{ 
              padding: '16px 20px', 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: 14,
            }}>
              {feature.name}
            </div>
            <div style={{ 
              padding: '16px 20px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
            }}>
              {renderValue(feature.free)}
            </div>
            <div style={{ 
              padding: '16px 20px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              background: 'rgba(217, 119, 6, 0.03)',
            }}>
              {renderValue(feature.pro)}
            </div>
            <div style={{ 
              padding: '16px 20px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
            }}>
              {renderValue(feature.team)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// FAQ 组件
// ============================================================
const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);
  
  const faqs = [
    {
      q: '可以随时取消订阅吗？',
      a: '是的，您可以随时取消订阅。取消后，您可以继续使用至当前周期结束，届时自动切换回免费版。',
    },
    {
      q: '年付和月付有什么区别？',
      a: '年付可享受约 17% 的折扣。年付需一次性支付全年费用，适合长期使用的用户；月付按月扣费，更加灵活。',
    },
    {
      q: '升级或降级后数据会丢失吗？',
      a: '不会。升级或降级不会影响任何数据，所有交易记录和分析报告都会保留。',
    },
    {
      q: '支持哪些支付方式？',
      a: '我们支持 Visa、MasterCard、American Express，以及 PayPal。中国用户还支持支付宝和微信支付。',
    },
  ];
  
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ 
        fontSize: 28, 
        fontWeight: 700, 
        color: '#fff',
        textAlign: 'center',
        marginBottom: 32,
      }}>
        常见问题
      </h2>

      {faqs.map((item, index) => (
        <div
          key={index}
          style={{
            background: openIndex === index ? 'rgba(255,255,255,0.03)' : 'transparent',
            border: '1px solid',
            borderColor: openIndex === index ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
            borderRadius: 12,
            marginBottom: 12,
            overflow: 'hidden',
            transition: 'all 0.2s',
          }}
        >
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 20,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ 
              color: '#fff',
              fontSize: 15,
              fontWeight: 500,
            }}>
              {item.q}
            </span>
            <ChevronRight 
              size={18} 
              style={{ 
                color: 'rgba(255,255,255,0.4)',
                transform: openIndex === index ? 'rotate(90deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }} 
            />
          </button>
          
          <div style={{
            maxHeight: openIndex === index ? 200 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
          }}>
            <p style={{ 
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14,
              lineHeight: 1.7,
              padding: '0 20px 20px',
              margin: 0,
            }}>
              {item.a}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// 主组件
// ============================================================
const Pricing = ({ onNavigate }) => {
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');

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

    const plan = plans.find(p => p.name === planName);
    const price = billingCycle === 'yearly' ? plan?.priceYearly : plan?.priceMonthly;

    Modal.confirm({
      title: null,
      icon: null,
      width: 440,
      centered: true,
      className: 'upgrade-modal',
      content: (
        <div style={{ padding: '8px 0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}>
              {planName === 'pro' ? '⚡' : '🏢'}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
                升级到 {planName === 'pro' ? 'Pro 专业版' : 'Team 团队版'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                ${price}/{billingCycle === 'yearly' ? '年' : '月'}
              </div>
            </div>
          </div>
          
          <div style={{
            background: 'rgba(217, 119, 6, 0.1)',
            border: '1px solid rgba(217, 119, 6, 0.2)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              marginBottom: 8,
              color: '#f59e0b',
              fontWeight: 600,
            }}>
              <Gift size={18} />
              即将上线优惠
            </div>
            <p style={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: 14, 
              margin: 0,
              lineHeight: 1.6,
            }}>
              支付功能即将上线，请联系我们手动开通并享受早鸟优惠！
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 10,
          }}>
            <Headphones size={20} style={{ color: '#d97706' }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>联系客服</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>support@metworthai.com</div>
            </div>
          </div>
        </div>
      ),
      okText: '复制邮箱地址',
      cancelText: '稍后联系',
      okButtonProps: {
        style: {
          background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
          border: 'none',
          height: 40,
          fontWeight: 600,
        }
      },
      onOk: () => {
        navigator.clipboard.writeText('support@metworthai.com');
        message.success('邮箱已复制到剪贴板');
      },
    });
  };

  const handleCancelSubscription = () => {
    Modal.confirm({
      title: '确认取消订阅',
      icon: null,
      content: (
        <div style={{ padding: '8px 0' }}>
          <p style={{ marginBottom: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
            取消后，您的订阅将在当前周期结束后失效。届时将切换回免费版，部分高级功能将无法使用。
          </p>
        </div>
      ),
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

  const getCurrentPlanName = () => {
    if (!currentSubscription?.hasSubscription) return 'free';
    return currentSubscription.plan?.name || 'free';
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        background: '#09090b',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* 背景光效 */}
      <div style={styles.bgGlow} />
      
      <div style={styles.container}>
        {/* 头部 */}
        <header style={styles.header}>
          <div style={styles.badge}>
            <Sparkles size={16} style={{ color: '#f59e0b' }} />
            <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
              限时优惠 · 年付立省 17%
            </span>
          </div>
          
          <h1 style={styles.title}>
            选择您的计划
          </h1>
          
          <p style={styles.subtitle}>
            从免费版开始体验核心功能，随时升级解锁 AI 智能诊断全部能力
          </p>

          {/* 计费周期切换 */}
          <div style={styles.billingToggle}>
            <div 
              style={styles.billingOption(billingCycle === 'monthly')}
              onClick={() => setBillingCycle('monthly')}
            >
              月付
            </div>
            <div 
              style={{
                ...styles.billingOption(billingCycle === 'yearly'),
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={() => setBillingCycle('yearly')}
            >
              年付
              <span style={styles.saveBadge}>省17%</span>
            </div>
          </div>
        </header>

        {/* 定价卡片 */}
        <div style={styles.grid}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={getCurrentPlanName() === plan.name}
              isPro={plan.name === 'pro'}
              isTeam={plan.name === 'team'}
              billingCycle={billingCycle}
              onSubscribe={handleSubscribe}
              onCancel={handleCancelSubscription}
            />
          ))}
        </div>

        {/* 信任指标 */}
        <TrustSection />

        {/* 功能对比表 */}
        <ComparisonTable />

        {/* FAQ */}
        <FAQ />

        {/* 底部 CTA */}
        <div style={{
          textAlign: 'center',
          marginTop: 64,
          padding: 48,
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(217, 119, 6, 0.02) 100%)',
          border: '1px solid rgba(217, 119, 6, 0.15)',
          borderRadius: 24,
        }}>
          <h3 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            准备好提升交易能力了吗？
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24, fontSize: 15 }}>
            加入数千名使用 MetworthAI 的交易者
          </p>
          <Button
            type="primary"
            size="large"
            onClick={() => handleSubscribe('pro')}
            style={{
              height: 52,
              paddingInline: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              boxShadow: '0 8px 32px rgba(217, 119, 6, 0.35)',
            }}
          >
            立即升级 Pro
            <Rocket size={18} style={{ marginLeft: 8 }} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
