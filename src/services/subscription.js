/**
 * 订阅服务
 * 用于检查用户订阅状态和功能权限
 */

// 订阅计划配置
export const SUBSCRIPTION_PLANS = {
  free: {
    name: '免费版',
    price: 0,
    features: {
      maxRecords: 1,
      maxTrades: 100,
      aiAnalysisPerMonth: 3,
      monteCarloPerMonth: 0,
      stopLossAnalysisPerMonth: 0,
      dataRetentionDays: 90,
      hasAdvancedMetrics: false,
      hasBehaviorTags: false,
      hasCustomReports: false,
      hasApiAccess: false,
      hasTeamCollaboration: false,
    }
  },
  basic: {
    name: '基础版',
    price: 99,
    features: {
      maxRecords: 5,
      maxTrades: -1, // 无限
      aiAnalysisPerMonth: 20,
      monteCarloPerMonth: 10,
      stopLossAnalysisPerMonth: 10,
      dataRetentionDays: -1, // 永久
      hasAdvancedMetrics: true,
      hasBehaviorTags: true, // 基础标签
      hasCustomReports: false,
      hasApiAccess: false,
      hasTeamCollaboration: false,
    }
  },
  pro: {
    name: '专业版',
    price: 299,
    features: {
      maxRecords: -1, // 无限
      maxTrades: -1,
      aiAnalysisPerMonth: -1, // 无限
      monteCarloPerMonth: -1,
      stopLossAnalysisPerMonth: -1,
      dataRetentionDays: -1,
      hasAdvancedMetrics: true,
      hasBehaviorTags: true, // 完整标签
      hasCustomReports: true,
      hasApiAccess: false,
      hasTeamCollaboration: false,
    }
  },
  enterprise: {
    name: '企业版',
    price: 999,
    features: {
      maxRecords: -1,
      maxTrades: -1,
      aiAnalysisPerMonth: -1,
      monteCarloPerMonth: -1,
      stopLossAnalysisPerMonth: -1,
      dataRetentionDays: -1,
      hasAdvancedMetrics: true,
      hasBehaviorTags: true,
      hasCustomReports: true,
      hasApiAccess: true,
      hasTeamCollaboration: true,
    }
  }
};

/**
 * 检查用户是否有权限使用某个功能
 */
export function checkFeatureAccess(user, feature) {
  if (!user) return false;
  
  const plan = user.subscriptionPlan || 'free';
  const planConfig = SUBSCRIPTION_PLANS[plan];
  
  if (!planConfig) return false;
  
  const features = planConfig.features;
  
  switch (feature) {
    case 'advancedMetrics':
      return features.hasAdvancedMetrics;
    case 'behaviorTags':
      return features.hasBehaviorTags;
    case 'customReports':
      return features.hasCustomReports;
    case 'apiAccess':
      return features.hasApiAccess;
    case 'teamCollaboration':
      return features.hasTeamCollaboration;
    case 'aiAnalysis':
      return features.aiAnalysisPerMonth === -1 || features.aiAnalysisPerMonth > 0;
    case 'monteCarlo':
      return features.monteCarloPerMonth === -1 || features.monteCarloPerMonth > 0;
    case 'stopLossAnalysis':
      return features.stopLossAnalysisPerMonth === -1 || features.stopLossAnalysisPerMonth > 0;
    default:
      return false;
  }
}

/**
 * 检查用户是否可以创建新账本
 */
export function canCreateRecord(user, currentRecordCount) {
  if (!user) return false;
  
  const plan = user.subscriptionPlan || 'free';
  const planConfig = SUBSCRIPTION_PLANS[plan];
  
  if (!planConfig) return false;
  
  const maxRecords = planConfig.features.maxRecords;
  
  if (maxRecords === -1) return true; // 无限
  return currentRecordCount < maxRecords;
}

/**
 * 检查用户是否可以添加交易
 */
export function canAddTrade(user, currentTradeCount) {
  if (!user) return false;
  
  const plan = user.subscriptionPlan || 'free';
  const planConfig = SUBSCRIPTION_PLANS[plan];
  
  if (!planConfig) return false;
  
  const maxTrades = planConfig.features.maxTrades;
  
  if (maxTrades === -1) return true; // 无限
  return currentTradeCount < maxTrades;
}

/**
 * 检查用户是否可以使用 AI 分析
 */
export function canUseAIAnalysis(user, usageCount, currentMonth) {
  if (!user) return false;
  
  const plan = user.subscriptionPlan || 'free';
  const planConfig = SUBSCRIPTION_PLANS[plan];
  
  if (!planConfig) return false;
  
  const limit = planConfig.features.aiAnalysisPerMonth;
  
  if (limit === -1) return true; // 无限
  
  // 检查是否过期
  if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
    return false;
  }
  
  // TODO: 需要从服务器获取当前月的使用次数
  // 这里暂时返回 true，实际应该检查 usageCount
  return usageCount < limit;
}

/**
 * 获取订阅限制信息
 */
export function getSubscriptionLimits(user) {
  if (!user) {
    return SUBSCRIPTION_PLANS.free.features;
  }
  
  const plan = user.subscriptionPlan || 'free';
  const planConfig = SUBSCRIPTION_PLANS[plan];
  
  return planConfig ? planConfig.features : SUBSCRIPTION_PLANS.free.features;
}

/**
 * 获取订阅计划信息
 */
export function getSubscriptionPlan(user) {
  if (!user) {
    return SUBSCRIPTION_PLANS.free;
  }
  
  const plan = user.subscriptionPlan || 'free';
  return SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.free;
}

/**
 * 检查订阅是否有效
 */
export function isSubscriptionActive(user) {
  if (!user) return false;
  
  if (user.subscriptionStatus === 'active') {
    // 检查是否过期
    if (user.subscriptionExpiresAt) {
      return new Date(user.subscriptionExpiresAt) > new Date();
    }
    return true;
  }
  
  return false;
}

/**
 * 格式化价格
 */
export function formatPrice(price, currency = 'CNY') {
  if (currency === 'CNY') {
    return `¥${price}`;
  }
  return `$${price}`;
}

/**
 * 获取升级建议
 */
export function getUpgradeSuggestion(user, feature) {
  const currentPlan = user?.subscriptionPlan || 'free';
  
  if (currentPlan === 'enterprise') {
    return null; // 已经是最高级
  }
  
  // 根据功能需求推荐升级方案
  const suggestions = {
    'moreRecords': currentPlan === 'free' ? 'basic' : 'pro',
    'moreTrades': currentPlan === 'free' ? 'basic' : null,
    'aiAnalysis': currentPlan === 'free' ? 'basic' : 'pro',
    'advancedMetrics': 'basic',
    'customReports': 'pro',
    'apiAccess': 'enterprise',
    'teamCollaboration': 'enterprise',
  };
  
  return suggestions[feature] || 'pro';
}

export default {
  SUBSCRIPTION_PLANS,
  checkFeatureAccess,
  canCreateRecord,
  canAddTrade,
  canUseAIAnalysis,
  getSubscriptionLimits,
  getSubscriptionPlan,
  isSubscriptionActive,
  formatPrice,
  getUpgradeSuggestion,
};
