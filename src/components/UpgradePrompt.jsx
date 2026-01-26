/**
 * 升级提示组件 - 用于功能限制时的软墙拦截
 */
import { Modal, Button, Tag, Progress, Tooltip } from 'antd';
import { CrownOutlined, CheckCircleOutlined, LockOutlined, ThunderboltOutlined, RocketOutlined, MenuFoldOutlined, MenuUnfoldOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

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
 * 升级提示弹窗 - 极简专业版
 */
export function UpgradeModal({ 
  visible, 
  onClose, 
  featureKey = 'smartDiagnosis',
  usage = null,
  onUpgrade,
}) {
  const featureInfo = FEATURE_INFO[featureKey] || FEATURE_INFO.smartDiagnosis;
  
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={400}
      centered
      className="upgrade-modal"
      styles={{
        content: {
          background: '#141414',
          border: '1px solid #262626',
          borderRadius: '12px',
          padding: 0,
        },
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-2xl flex-shrink-0">
            {featureInfo.icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">{featureInfo.title}</h2>
            <p className="text-gray-500 text-xs leading-relaxed">{featureInfo.description}</p>
          </div>
        </div>

        {/* Pro Features - 紧凑列表 */}
        <div className="mb-6 bg-[#1a1a1a] rounded-lg border border-[#262626] overflow-hidden">
          <div className="px-4 py-2 bg-[#262626]/30 border-bottom border-[#262626] flex items-center gap-2">
            <CrownOutlined className="text-amber-500 text-xs" />
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pro 计划包含</span>
          </div>
          <div className="p-3 grid grid-cols-1 gap-y-2">
            {PRO_FEATURES.slice(0, 6).map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-[13px]">
                <CheckCircleOutlined className="text-amber-500/60 text-[10px]" />
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            type="primary"
            block
            onClick={onUpgrade}
            style={{
              background: '#f0b90b',
              borderColor: '#f0b90b',
              color: '#000',
              height: '40px',
              fontWeight: 600,
              borderRadius: '6px',
            }}
          >
            立即升级
          </Button>
          <Button
            type="text"
            block
            onClick={onClose}
            style={{ 
              color: '#525252',
              fontSize: '13px',
              height: '32px'
            }}
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
    elite: { bg: '#a855f7', text: '#ffffff', label: 'Elite' },
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
  const { plan, usage, status, currentPeriodStart, currentPeriodEnd } = subscription || {};
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
    elite: { 
      name: 'Elite 精英版', 
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

  // 格式化日期
  const formatDate = (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-';
  const daysRemaining = currentPeriodEnd ? dayjs(currentPeriodEnd).diff(dayjs(), 'day') : null;
  
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
        {/* 订阅时间信息 - 仅付费用户显示 */}
        {!isFreePlan && (currentPeriodStart || currentPeriodEnd) && (
          <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#262626]">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarOutlined className="text-gray-500" style={{ fontSize: 12 }} />
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">订阅周期</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500 text-[10px] mb-0.5">开始日期</div>
                <div className="text-gray-300 font-mono text-[12px]">{formatDate(currentPeriodStart)}</div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] mb-0.5">到期日期</div>
                <div className="text-gray-300 font-mono text-[12px]">
                  {formatDate(currentPeriodEnd)}
                  {daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0 && (
                    <span className="text-amber-400 text-[10px] ml-1">({daysRemaining}天)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
 * 侧边栏底部区域（订阅状态 + 折叠按钮一体化设计）- 极简专业版
 */
export function SidebarFooter({ subscription, collapsed, onUpgrade, onToggleCollapse }) {
  const { plan, usage, currentPeriodStart, currentPeriodEnd, status } = subscription || {};
  const planName = plan?.name || 'free';
  const isFreePlan = planName === 'free';
  const isElite = planName === 'elite';
  
  // 使用量数据
  const tradesUsed = usage?.tradesUsedThisMonth || 0;
  const tradesLimit = plan?.maxTradesPerMonth || 100;
  const aiUsed = usage?.aiAnalysisUsedThisMonth || 0;
  const aiLimit = plan?.maxAiAnalysisPerMonth || 3;
  
  // 计算使用百分比
  const tradesPercent = tradesLimit === -1 ? 0 : Math.min(100, (tradesUsed / tradesLimit) * 100);
  const aiPercent = aiLimit === -1 ? 0 : Math.min(100, (aiUsed / aiLimit) * 100);
  const isNearLimit = tradesPercent > 80 || aiPercent > 80;

  // 格式化日期
  const formatDate = (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-';
  const daysRemaining = currentPeriodEnd ? dayjs(currentPeriodEnd).diff(dayjs(), 'day') : null;
  
  // 折叠状态 - 极致简约
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-4 border-t border-[#262626]">
        <Tooltip 
          title={
            <div className="text-[11px] p-1">
              <div className="font-bold mb-1 text-white">{isElite ? 'Elite 精英版' : (isFreePlan ? '免费版' : 'Pro 专业版')}</div>
              <div className="text-gray-400">交易: {tradesUsed}/{tradesLimit === -1 ? '∞' : tradesLimit}</div>
              <div className="text-gray-400">AI: {aiUsed}/{aiLimit === -1 ? '∞' : aiLimit}</div>
              {!isFreePlan && currentPeriodEnd && (
                <div className="text-gray-400 mt-1 pt-1 border-t border-gray-700">
                  到期: {formatDate(currentPeriodEnd)}
                  {daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0 && (
                    <span className="text-amber-400 ml-1">({daysRemaining}天)</span>
                  )}
                </div>
              )}
            </div>
          } 
          placement="right"
        >
          <div 
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all
              ${isFreePlan 
                ? 'bg-[#1a1a1a] text-gray-500 hover:text-gray-300 border border-[#262626]' 
                : isElite 
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : 'bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20'
              }
            `}
            onClick={onUpgrade}
          >
            <CrownOutlined style={{ fontSize: 14 }} />
          </div>
        </Tooltip>
        
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-gray-600 hover:text-gray-400 transition-all"
          onClick={onToggleCollapse}
        >
          <MenuUnfoldOutlined style={{ fontSize: 12 }} />
        </div>
      </div>
    );
  }
  
  // 展开状态 - 极简专业
  return (
    <div className="px-4 py-4 border-t border-[#262626]">
      {/* 订阅状态卡片 */}
      <div 
        className={`
          group relative overflow-hidden rounded-xl border p-3 cursor-pointer transition-all mb-3
          ${isFreePlan 
            ? 'bg-[#141414] border-[#262626] hover:border-[#404040]' 
            : isElite
              ? 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40'
              : 'bg-[#f0b90b]/5 border-[#f0b90b]/20 hover:border-[#f0b90b]/40'
          }
        `}
        onClick={onUpgrade}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
            ${isFreePlan ? 'bg-[#1a1a1a] text-gray-500' : isElite ? 'bg-purple-500 text-white' : 'bg-[#f0b90b] text-black'}
          `}>
            <CrownOutlined style={{ fontSize: 14 }} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-[12px] font-bold tracking-tight ${isFreePlan ? 'text-gray-400' : isElite ? 'text-purple-400' : 'text-[#f0b90b]'}`}>
                {isElite ? 'ELITE' : (isFreePlan ? 'FREE' : 'PRO')}
              </span>
              {isFreePlan && (
                <span className="text-[10px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-500/10 rounded">升级</span>
              )}
            </div>
            
            {/* 极简进度条 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-[#262626] rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${isNearLimit ? 'bg-red-500' : (isElite ? 'bg-purple-500' : 'bg-[#f0b90b]')}`}
                  style={{ width: `${Math.max(tradesPercent, aiPercent)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-600 font-mono">
                {Math.round(Math.max(tradesPercent, aiPercent))}%
              </span>
            </div>
          </div>
        </div>
        
        {/* 订阅时间信息 - 仅付费用户显示 */}
        {!isFreePlan && currentPeriodEnd && (
          <div className="mt-2 pt-2 border-t border-[#262626] flex items-center gap-1.5">
            <CalendarOutlined className="text-gray-600" style={{ fontSize: 10 }} />
            <span className="text-[10px] text-gray-500">
              到期: {formatDate(currentPeriodEnd)}
              {daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0 && (
                <span className="text-amber-400 ml-1">({daysRemaining}天后)</span>
              )}
            </span>
          </div>
        )}
      </div>
      
      {/* 收起按钮 */}
      <div 
        className="flex items-center justify-center gap-2 py-1 cursor-pointer text-gray-600 hover:text-gray-400 transition-colors"
        onClick={onToggleCollapse}
      >
        <MenuFoldOutlined style={{ fontSize: 11 }} />
        <span className="text-[11px] font-medium">收起菜单</span>
      </div>
    </div>
  );
}

/**
 * 侧边栏订阅卡片（保留原版用于其他地方调用）- 极简专业版
 */
export function SidebarSubscriptionCard({ subscription, collapsed, onUpgrade }) {
  const { plan, usage } = subscription || {};
  const planName = plan?.name || 'free';
  const isFreePlan = planName === 'free';
  const isElite = planName === 'elite';
  
  const tradesUsed = usage?.tradesUsedThisMonth || 0;
  const tradesLimit = plan?.maxTradesPerMonth || 100;
  const aiUsed = usage?.aiAnalysisUsedThisMonth || 0;
  const aiLimit = plan?.maxAiAnalysisPerMonth || 3;

  const tradesPercent = tradesLimit === -1 ? 0 : Math.min(100, (tradesUsed / tradesLimit) * 100);
  const aiPercent = aiLimit === -1 ? 0 : Math.min(100, (aiUsed / aiLimit) * 100);
  
  if (collapsed) {
    return (
      <div 
        className="flex justify-center py-3 cursor-pointer group"
        onClick={onUpgrade}
      >
        <Tooltip title={isFreePlan ? "升级 Pro" : "订阅详情"} placement="right">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center transition-all
            ${isFreePlan 
              ? 'bg-[#1a1a1a] text-gray-500 group-hover:text-gray-300 border border-[#262626]' 
              : isElite 
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20'
            }
          `}>
            <CrownOutlined style={{ fontSize: 14 }} />
          </div>
        </Tooltip>
      </div>
    );
  }
  
  return (
    <div 
      className={`
        mx-4 mb-4 rounded-xl border p-3 cursor-pointer transition-all
        ${isFreePlan 
          ? 'bg-[#141414] border-[#262626] hover:border-[#404040]' 
          : isElite
            ? 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40'
            : 'bg-[#f0b90b]/5 border-[#f0b90b]/20 hover:border-[#f0b90b]/40'
        }
      `}
      onClick={onUpgrade}
    >
      <div className="flex items-center gap-3">
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          ${isFreePlan ? 'bg-[#1a1a1a] text-gray-500' : isElite ? 'bg-purple-500 text-white' : 'bg-[#f0b90b] text-black'}
        `}>
          <CrownOutlined style={{ fontSize: 14 }} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[12px] font-bold tracking-tight ${isFreePlan ? 'text-gray-400' : isElite ? 'text-purple-400' : 'text-[#f0b90b]'}`}>
              {isElite ? 'ELITE' : (isFreePlan ? 'FREE' : 'PRO')}
            </span>
            {isFreePlan && (
              <span className="text-[10px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-500/10 rounded">升级</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-[#262626] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${isElite ? 'bg-purple-500' : 'bg-[#f0b90b]'}`}
                style={{ width: `${Math.max(tradesPercent, aiPercent)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-600 font-mono">
              {Math.round(Math.max(tradesPercent, aiPercent))}%
            </span>
          </div>
        </div>
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
