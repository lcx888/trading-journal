/**
 * 升级提示组件 - 用于功能限制时的软墙拦截
 */
import { Modal, Button, Tag, Progress } from 'antd';
import { CrownOutlined, CheckCircleOutlined, LockOutlined, ThunderboltOutlined, RocketOutlined } from '@ant-design/icons';

// 功能描述映射
const FEATURE_INFO = {
  aiAnalysis: {
    title: 'AI 分析次数已用完',
    description: '本月的 AI 分析额度已用尽。升级到 Pro 计划即可解锁无限次数的智能分析。',
    icon: '🤖',
  },
  smartDiagnosis: {
    title: '智能诊断',
    description: '深度分析交易行为，自动识别交易模式和心理偏差，提供个性化改进建议。',
    icon: '🧠',
  },
  monteCarlo: {
    title: '蒙特卡洛模拟',
    description: '通过 10000 次随机模拟，预测未来交易的风险敞口和最大回撤概率。',
    icon: '📊',
  },
  optimalStopLoss: {
    title: '最优止损分析',
    description: '回测历史数据，计算不同止损位对总盈亏的影响，找出最优止损策略。',
    icon: '🎯',
  },
  expectancy: {
    title: '期望值分布',
    description: '按时段和方向分析期望值分布，识别你的"提款机时段"和"碎钞机时段"。',
    icon: '📈',
  },
  behaviorTags: {
    title: '行为特征识别',
    description: '自动识别报复性交易、执行焦虑、处置效应等行为特征，帮助改善交易纪律。',
    icon: '🏷️',
  },
  export: {
    title: '数据导出',
    description: '支持 Excel 和 PDF 格式导出，包含完整的交易数据和分析报告。',
    icon: '📤',
  },
  records: {
    title: '账本数量已达上限',
    description: '免费版仅支持 1 个账本。升级到 Pro 计划即可创建无限账本，轻松管理多个交易策略。',
    icon: '📚',
  },
  trades: {
    title: '本月交易导入额度已用完',
    description: '免费版每月最多导入 100 笔交易。升级到 Pro 计划即可无限导入，不错过任何一笔记录。',
    icon: '📝',
  },
};

// Pro 计划特性列表
const PRO_FEATURES = [
  '无限交易导入',
  '无限 AI 分析',
  '无限账本',
  '智能诊断系统',
  '蒙特卡洛模拟',
  '最优止损分析',
  '期望值分布',
  '行为特征识别',
  'Excel 导出',
];

/**
 * 升级提示弹窗
 */
export function UpgradeModal({ 
  visible, 
  onClose, 
  featureKey = 'smartDiagnosis',
  usage = null, // { used, limit, remaining }
  onUpgrade,
}) {
  const featureInfo = FEATURE_INFO[featureKey] || FEATURE_INFO.smartDiagnosis;
  
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      className="upgrade-modal"
      styles={{
        content: {
          background: 'linear-gradient(180deg, #1a1a1e 0%, #0d0d10 100%)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: '16px',
          padding: 0,
        },
      }}
    >
      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-4xl">
            {featureInfo.icon}
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{featureInfo.title}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{featureInfo.description}</p>
        </div>

        {/* Usage Progress (if applicable) */}
        {usage && (
          <div className="mb-6 p-4 rounded-xl bg-[#1a1a1e] border border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">本月使用量</span>
              <span className="text-amber-400 font-mono text-sm">{usage.used} / {usage.limit}</span>
            </div>
            <Progress 
              percent={(usage.used / usage.limit) * 100} 
              showInfo={false}
              strokeColor="#d97706"
              trailColor="#374151"
              size="small"
            />
          </div>
        )}

        {/* Pro Features */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CrownOutlined className="text-amber-400" />
            <span className="text-white font-medium">升级 Pro 解锁</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRO_FEATURES.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircleOutlined className="text-green-400 text-xs" />
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button
            type="primary"
            size="large"
            block
            icon={<ThunderboltOutlined />}
            onClick={onUpgrade}
            style={{
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              border: 'none',
              height: '48px',
              fontWeight: 600,
            }}
          >
            升级到 Pro · $19/月
          </Button>
          <Button
            type="text"
            size="large"
            block
            onClick={onClose}
            style={{ color: '#9ca3af' }}
          >
            稍后再说
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 功能锁定覆盖层
 */
export function FeatureLock({ 
  featureKey = 'smartDiagnosis',
  children,
  onUpgrade,
}) {
  const featureInfo = FEATURE_INFO[featureKey] || FEATURE_INFO.smartDiagnosis;
  
  return (
    <div className="relative">
      {/* 模糊的内容 */}
      <div className="blur-sm opacity-50 pointer-events-none select-none">
        {children}
      </div>
      
      {/* 锁定覆盖层 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d10]/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <LockOutlined className="text-2xl text-amber-400" />
          </div>
          <h3 className="text-white font-semibold mb-2">{featureInfo.title}</h3>
          <p className="text-gray-400 text-sm mb-4 max-w-xs">{featureInfo.description}</p>
          <Button
            type="primary"
            icon={<CrownOutlined />}
            onClick={onUpgrade}
            style={{
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              border: 'none',
            }}
          >
            升级解锁
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 功能标签（PRO 标识）
 */
export function ProBadge({ size = 'small' }) {
  const sizeClasses = {
    small: 'text-[9px] px-1.5 py-0.5',
    medium: 'text-[10px] px-2 py-1',
  };
  
  return (
    <span className={`${sizeClasses[size]} font-bold bg-amber-500/20 text-amber-400 rounded`}>
      PRO
    </span>
  );
}

/**
 * 订阅状态徽章（用于顶部导航）
 */
export function SubscriptionBadge({ plan, usage, onClick }) {
  const planColors = {
    free: { bg: '#374151', text: '#9ca3af', label: 'Free' },
    pro: { bg: '#d97706', text: '#ffffff', label: 'Pro' },
    team: { bg: '#7c3aed', text: '#ffffff', label: 'Team' },
  };
  
  const planStyle = planColors[plan] || planColors.free;
  const isFreePlan = plan === 'free';
  
  return (
    <div 
      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      {/* 计划徽章 */}
      <Tag
        style={{
          background: planStyle.bg,
          color: planStyle.text,
          border: 'none',
          fontWeight: 600,
          fontSize: '11px',
          margin: 0,
        }}
      >
        {planStyle.label}
      </Tag>
      
      {/* 免费用户显示升级按钮 */}
      {isFreePlan && (
        <Button
          type="primary"
          size="small"
          icon={<RocketOutlined />}
          style={{
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            border: 'none',
            fontSize: '12px',
            height: '26px',
            fontWeight: 500,
          }}
        >
          升级
        </Button>
      )}
    </div>
  );
}

/**
 * Dashboard 订阅卡片
 */
export function SubscriptionCard({ subscription, onUpgrade, onManage }) {
  const { plan, usage, status } = subscription || {};
  const planName = plan?.name || 'free';
  const isFreePlan = planName === 'free';
  
  const planInfo = {
    free: { 
      name: 'Free 免费版', 
      color: 'text-gray-400',
      gradient: 'from-gray-600 to-gray-700',
    },
    pro: { 
      name: 'Pro 专业版', 
      color: 'text-amber-400',
      gradient: 'from-amber-600 to-amber-700',
    },
    team: { 
      name: 'Team 团队版', 
      color: 'text-purple-400',
      gradient: 'from-purple-600 to-purple-700',
    },
  };
  
  const currentPlan = planInfo[planName] || planInfo.free;
  
  // 使用量
  const tradesUsed = usage?.tradesUsedThisMonth || 0;
  const tradesLimit = plan?.maxTradesPerMonth || 100;
  const aiUsed = usage?.aiAnalysisUsedThisMonth || 0;
  const aiLimit = plan?.maxAiAnalysisPerMonth || 3;
  
  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-[#1a1a1e] to-[#0d0d10] overflow-hidden">
      {/* Header */}
      <div className={`p-4 bg-gradient-to-r ${currentPlan.gradient} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <CrownOutlined className="text-white" />
          <span className="text-white font-semibold">{currentPlan.name}</span>
        </div>
        {!isFreePlan && status === 'active' && (
          <Tag color="green" style={{ margin: 0 }}>已激活</Tag>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Usage Stats */}
        <div className="space-y-3">
          {/* Trades */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-sm">本月交易</span>
              <span className="text-gray-300 text-sm font-mono">
                {tradesLimit === -1 ? `${tradesUsed} / ∞` : `${tradesUsed} / ${tradesLimit}`}
              </span>
            </div>
            {tradesLimit !== -1 && (
              <Progress 
                percent={Math.min(100, (tradesUsed / tradesLimit) * 100)} 
                showInfo={false}
                strokeColor={tradesUsed >= tradesLimit ? '#ef4444' : '#d97706'}
                trailColor="#374151"
                size="small"
              />
            )}
          </div>
          
          {/* AI Analysis */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-sm">AI 分析</span>
              <span className="text-gray-300 text-sm font-mono">
                {aiLimit === -1 ? `${aiUsed} / ∞` : `${aiUsed} / ${aiLimit}`}
              </span>
            </div>
            {aiLimit !== -1 && (
              <Progress 
                percent={Math.min(100, (aiUsed / aiLimit) * 100)} 
                showInfo={false}
                strokeColor={aiUsed >= aiLimit ? '#ef4444' : '#3b82f6'}
                trailColor="#374151"
                size="small"
              />
            )}
          </div>
        </div>
        
        {/* CTA */}
        {isFreePlan ? (
          <Button
            type="primary"
            block
            icon={<RocketOutlined />}
            onClick={onUpgrade}
            style={{
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              border: 'none',
              fontWeight: 500,
            }}
          >
            升级解锁全部功能
          </Button>
        ) : (
          <Button
            type="default"
            block
            onClick={onManage}
            style={{
              borderColor: '#374151',
              color: '#9ca3af',
            }}
          >
            管理订阅
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 侧边栏订阅卡片（符合设计规范版）
 */
export function SidebarSubscriptionCard({ subscription, collapsed, onUpgrade }) {
  const { plan, usage, status } = subscription || {};
  const planName = plan?.name || 'free';
  const isFreePlan = planName === 'free';
  
  // 计划配置
  const planConfig = {
    free: { 
      name: '免费版', 
      tag: 'FREE',
      color: 'var(--text-secondary)',
      accent: 'var(--border-primary)',
    },
    pro: { 
      name: '专业版', 
      tag: 'PRO',
      color: 'var(--color-brand)',
      accent: 'var(--color-brand)',
    },
    team: { 
      name: '团队版', 
      tag: 'TEAM',
      color: '#a855f7',
      accent: '#a855f7',
    },
  };
  
  const current = planConfig[planName] || planConfig.free;
  
  // 使用量数据
  const tradesUsed = usage?.tradesUsedThisMonth || 0;
  const tradesLimit = plan?.maxTradesPerMonth || 100;
  const aiUsed = usage?.aiAnalysisUsedThisMonth || 0;
  const aiLimit = plan?.maxAiAnalysisPerMonth || 3;
  
  // 折叠状态
  if (collapsed) {
    return (
      <div 
        className="flex justify-center py-4 cursor-pointer group"
        onClick={onUpgrade}
      >
        <Tooltip title={isFreePlan ? "升级 Pro" : "订阅详情"} placement="right">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center transition-all
            ${isFreePlan ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-hover)]' : 'bg-[var(--color-brand-bg)] text-[var(--color-brand)]'}
          `}>
            <CrownOutlined style={{ fontSize: '18px' }} />
          </div>
        </Tooltip>
      </div>
    );
  }
  
  return (
    <div className="mx-3 mb-4 rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header - 更紧凑 */}
      <div className="px-3 py-2 border-b border-[var(--border-primary)] flex items-center justify-between bg-[rgba(255,255,255,0.02)]">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-3 rounded-full ${isFreePlan ? 'bg-[var(--text-tertiary)]' : 'bg-[var(--color-brand)]'}`} />
          <span className="text-[var(--text-primary)] font-bold text-[11px] uppercase tracking-wider">
            {current.name}
          </span>
        </div>
        {!isFreePlan && (
          <span className="text-[9px] font-bold bg-[var(--color-brand-bg)] text-[var(--color-brand)] px-1 py-0.5 rounded-sm">
            {current.tag}
          </span>
        )}
      </div>
      
      {/* Usage Content - 极简数据展示 */}
      <div className="p-3 space-y-3">
        {/* Trades Usage */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-[var(--text-secondary)]">本月交易</span>
            <span className="text-[var(--text-primary)] font-mono">
              {tradesLimit === -1 ? tradesUsed : `${tradesUsed}/${tradesLimit}`}
            </span>
          </div>
          <div className="h-1 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: tradesLimit === -1 ? '100%' : `${Math.min(100, (tradesUsed / tradesLimit) * 100)}%`,
                backgroundColor: tradesLimit !== -1 && (tradesUsed / tradesLimit) > 0.8 ? 'var(--color-loss)' : 'var(--color-brand)'
              }}
            />
          </div>
        </div>
        
        {/* AI Usage */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-[var(--text-secondary)]">AI 分析</span>
            <span className="text-[var(--text-primary)] font-mono">
              {aiLimit === -1 ? aiUsed : `${aiUsed}/${aiLimit}`}
            </span>
          </div>
          <div className="h-1 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: aiLimit === -1 ? '100%' : `${Math.min(100, (aiUsed / aiLimit) * 100)}%`,
                backgroundColor: aiLimit !== -1 && (aiUsed / aiLimit) > 0.8 ? 'var(--color-loss)' : 'var(--color-info)'
              }}
            />
          </div>
        </div>
        
        {/* CTA Button - 币安风格主按钮 */}
        {isFreePlan && (
          <Button
            type="primary"
            block
            size="small"
            onClick={onUpgrade}
            className="mt-1"
            style={{
              height: '26px',
              fontSize: '11px',
              fontWeight: '600',
              background: 'var(--color-brand)',
              color: '#181A20',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'none',
            }}
          >
            立即升级
          </Button>
        )}
      </div>
    </div>
  );
}

export default {
  UpgradeModal,
  FeatureLock,
  ProBadge,
  SubscriptionBadge,
  SubscriptionCard,
  SidebarSubscriptionCard,
};
