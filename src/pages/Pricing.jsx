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
  X,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Headphones,
  ArrowRight,
  Gift
} from 'lucide-react';
import { getPlans, getSubscriptionStatus, redeemCode, clearSubscriptionCache } from '../services/subscription';

// 对比表格行组件
const CompareRow = ({ feature, pain, free, pro, elite, isLast = false, isMobile = false }) => {
  const renderCell = (value) => {
    if (value === true) {
      return <Check size={16} strokeWidth={2.5} style={{ color: '#fff' }} />;
    }
    if (value === false) {
      return <X size={16} strokeWidth={2} style={{ color: '#333' }} />;
    }
    return <span style={{ fontSize: '13px', color: '#fff' }}>{value}</span>;
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 100px 100px 100px',
      borderBottom: isLast ? 'none' : '1px solid #1a1a1a',
    }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '14px', color: '#fff', marginBottom: '4px' }}>{feature}</div>
        {true && <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.4 }}>{pain}</div>}
      </div>
      <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderCell(free)}
      </div>
      <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderCell(pro)}
      </div>
      <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderCell(elite)}
      </div>
    </div>
  );
};

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
  
  // 兑换码状态
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);
  const [redeemCodeValue, setRedeemCodeValue] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  
  // 移动端检测
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        navigator.clipboard.writeText('support@tradewhy.ai');
        message.success('客服邮箱已复制');
      },
    });
  };

  const handleRedeem = async () => {
    if (!redeemCodeValue.trim()) {
      message.warning('请输入兑换码');
      return;
    }
    setRedeemLoading(true);
    try {
      const result = await redeemCode(redeemCodeValue);
      message.success(result.message || '兑换成功！');
      setRedeemModalVisible(false);
      setRedeemCodeValue('');
      clearSubscriptionCache();
      loadData(); // 重新加载数据以更新订阅状态
    } catch (error) {
      message.error(error.response?.data?.message || error.message || '兑换失败');
    } finally {
      setRedeemLoading(false);
    }
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
        <div style={{ ...styles.container, padding: '0 24px' }}>
          <header style={{ ...styles.header, padding: '80px 0 60px' }}>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 0 }}>
              <div>
            <h1 style={{ ...styles.title, fontSize: '32px' }}>订阅方案</h1>
            <p style={{ ...styles.subtitle, fontSize: '15px' }}>
              选择适合您的专业交易工具集。{!isMobile && '所有付费方案均包含完整的 AI 诊断能力。'}
            </p>
              </div>
              <Button 
                icon={<Gift size={16} />} 
                onClick={() => setRedeemModalVisible(true)}
                size={'middle'}
                style={{ 
                  background: 'transparent', 
                  borderColor: THEME.border, 
                  color: THEME.textSecondary,
                  fontSize: '13px',
                  height: '36px'
                }}
              >
                兑换码
              </Button>
            </div>

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
                    {billingCycle === 'yearly' && price > 0 && (
                      <div style={{ fontSize: '13px', color: THEME.textMuted, marginTop: '8px' }}>
                        年付总价 ${price}
                      </div>
                    )}
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

          {/* 功能对比表格 */}
          <section style={{ marginTop: '80px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '32px' }}>功能对比</h2>
            
            <div style={{ 
              border: `1px solid ${THEME.border}`, 
              borderRadius: '8px', 
              overflow: 'hidden' 
            }}>
              {/* 表头 */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 100px 100px 100px',
                background: '#161616',
                borderBottom: `1px solid ${THEME.border}`,
              }}>
                <div style={{ padding: '16px 20px', fontSize: '12px', color: THEME.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  功能
                </div>
                <div style={{ padding: '16px 12px', fontSize: '12px', color: THEME.textMuted, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Free
                </div>
                <div style={{ padding: '16px 12px', fontSize: '12px', color: THEME.textMuted, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pro
                </div>
                <div style={{ padding: '16px 12px', fontSize: '12px', color: THEME.textMuted, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Elite
                </div>
              </div>

              {/* 分组：数据管理 */}
              <div style={{ background: '#0d0d0d', padding: '12px 20px', borderBottom: `1px solid ${THEME.border}` }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: THEME.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  数据管理
                </span>
              </div>
              
              <CompareRow 
                feature="交易账本数量" 
                pain="多策略、多账户交易者需要分开记录"
                free="1 个" pro="无限" elite="无限" 
                isMobile={false}
              />
              <CompareRow 
                feature="每月交易笔数" 
                pain="高频交易者可能每天数十笔"
                free="50 笔" pro="无限" elite="无限" 
                isMobile={false}
              />
              <CompareRow 
                feature="历史数据保留" 
                pain="长期复盘需要回溯数月甚至数年"
                free="7 天" pro="永久" elite="永久" 
                isMobile={false}
              />
              <CompareRow 
                feature="数据导出" 
                pain="需要备份或用于外部分析"
                free={false} pro={true} elite={true} 
                isMobile={false}
              />

              {/* 分组：AI 诊断 */}
              <div style={{ background: '#0d0d0d', padding: '12px 20px', borderBottom: `1px solid ${THEME.border}` }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: THEME.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  AI 诊断
                </span>
              </div>
              
              <CompareRow 
                feature="AI 交易分析" 
                pain="靠人工复盘难以发现隐藏的行为模式"
                free="2 次/月" pro="无限" elite="无限" 
                isMobile={false}
              />
              <CompareRow 
                feature="智能诊断报告" 
                pain="不知道自己的交易问题出在哪里"
                free={false} pro={true} elite={true} 
                isMobile={false}
              />
              <CompareRow 
                feature="蒙特卡洛模拟" 
                pain="无法量化策略的风险敞口"
                free={false} pro={true} elite={true} 
                isMobile={false}
              />
              <CompareRow 
                feature="最优止损建议" 
                pain="止损位置凭感觉，缺乏数据支撑"
                free={false} pro={true} elite={true} 
                isMobile={false}
              />
              <CompareRow 
                feature="期望值计算" 
                pain="不确定当前策略是否长期有利可图"
                free={false} pro={true} elite={true} 
                isMobile={false}
              />
              <CompareRow 
                feature="行为标签分析" 
                pain="冲动交易、过度交易等坏习惯难以察觉"
                free={false} pro={true} elite={true} 
                isMobile={false}
              />

              {/* 分组：高级功能 */}
              <div style={{ background: '#0d0d0d', padding: '12px 20px', borderBottom: `1px solid ${THEME.border}` }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: THEME.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  高级功能
                </span>
              </div>
              
              <CompareRow 
                feature="API 接口访问" 
                pain="需要将数据接入自己的交易系统"
                free={false} pro={false} elite={true} 
                isMobile={false}
              />
              <CompareRow 
                feature="定制化报告" 
                pain="标准报告无法满足特定分析需求"
                free={false} pro={false} elite={true} 
                isMobile={false}
              />
              <CompareRow 
                feature="新功能抢先体验" 
                pain="希望第一时间使用最新工具"
                free={false} pro={false} elite={true} 
                isMobile={false}
              />

              {/* 分组：服务支持 */}
              <div style={{ background: '#0d0d0d', padding: '12px 20px', borderBottom: `1px solid ${THEME.border}` }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: THEME.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  服务支持
                </span>
              </div>
              
              <CompareRow 
                feature="技术支持" 
                pain="遇到问题需要及时解决"
                free="邮件" pro="优先" elite="专属" 
                isMobile={false}
              />
              <CompareRow 
                feature="1对1 策略咨询" 
                pain="需要专业人士的个性化指导"
                free={false} pro={false} elite={true} 
                isLast
                isMobile={false}
              />
            </div>
          </section>

          <footer style={{ ...styles.trustArea, flexWrap: 'nowrap', gap: '24px' }}>
            <div style={{ ...styles.trustItem, fontSize: '13px' }}><ShieldCheck size={16} /> SSL</div>
            <div style={{ ...styles.trustItem, fontSize: '13px' }}><CreditCard size={16} /> 安全支付</div>
            <div style={{ ...styles.trustItem, fontSize: '13px' }}><RefreshCw size={16} /> 7天退款</div>
            <div style={{ ...styles.trustItem, fontSize: '13px' }}><Headphones size={16} /> 支持</div>
            {true && <div style={{ flex: 1 }} />}
            {true && (
            <a 
              href="mailto:support@tradewhy.ai" 
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
            )}
          </footer>
        </div>

        {/* 兑换码弹窗 */}
        <Modal
          title={null}
          footer={null}
          open={redeemModalVisible}
          onCancel={() => setRedeemModalVisible(false)}
          centered
          width={400}
          styles={{
            content: {
              background: '#111',
              border: '1px solid #222',
              borderRadius: '8px',
              padding: '24px',
            }
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              background: '#1a1a1a', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Gift size={24} color="#fff" />
            </div>
            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>使用兑换码</h3>
            <p style={{ color: '#666', fontSize: '13px' }}>输入您的兑换码以激活订阅时长</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <input 
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              value={redeemCodeValue}
              onChange={(e) => setRedeemCodeValue(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                height: '44px',
                background: '#000',
                border: '1px solid #222',
                borderRadius: '4px',
                padding: '0 16px',
                color: '#fff',
                fontSize: '15px',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '1px',
                outline: 'none',
              }}
            />
          </div>

          <Button 
            type="primary" 
            block 
            loading={redeemLoading}
            onClick={handleRedeem}
            style={{
              height: '44px',
              background: '#fff',
              color: '#000',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              marginBottom: '12px'
            }}
          >
            立即兑换
          </Button>
          
          <p style={{ color: '#444', fontSize: '11px', textAlign: 'center', lineHeight: 1.5 }}>
            兑换成功后，订阅时长将立即添加到您的账户。<br/>
            如果您已有活跃订阅，将在现有时长基础上顺延。
          </p>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default Pricing;
