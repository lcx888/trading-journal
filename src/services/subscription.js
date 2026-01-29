/**
 * 订阅服务 - 处理订阅状态和权限控制
 */
import { authApi } from './api';

// 权限定义
export const FEATURES = {
  SMART_DIAGNOSIS: 'hasSmartDiagnosis',
  MONTE_CARLO: 'hasMonteCarlo',
  OPTIMAL_STOP_LOSS: 'hasOptimalStopLoss',
  EXPECTANCY: 'hasExpectancy',
  BEHAVIOR_TAGS: 'hasBehaviorTags',
  EXPORT: 'hasExport',
  API: 'hasApi',
  PRIORITY_SUPPORT: 'hasPrioritySupport',
};

// 缓存订阅状态
let cachedSubscription = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取当前用户订阅状态
 */
export async function getSubscriptionStatus(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && cachedSubscription && (now - cacheTime < CACHE_DURATION)) {
    return cachedSubscription;
  }

  try {
    const response = await authApi.get('/subscription/current');
    cachedSubscription = response.data;
    cacheTime = now;
    return cachedSubscription;
  } catch (error) {
    console.error('获取订阅状态失败:', error);
    // 返回免费版权限
    return {
      hasSubscription: false,
      plan: getFreePlanDefaults(),
      status: 'free',
      usage: { tradesUsedThisMonth: 0, aiAnalysisUsedThisMonth: 0 },
    };
  }
}

/**
 * 检查是否有某个功能权限
 */
export async function hasFeature(featureKey) {
  const status = await getSubscriptionStatus();
  const plan = status.plan;
  
  if (!plan) return false;
  return plan[featureKey] === true;
}

/**
 * 检查使用量限制
 */
export async function checkUsageLimit(type) {
  const status = await getSubscriptionStatus();
  const plan = status.plan;
  const usage = status.usage;

  if (!plan) {
    return { allowed: true, remaining: Infinity };
  }

  if (type === 'trades') {
    const limit = plan.maxTradesPerMonth;
    if (limit === -1) return { allowed: true, remaining: Infinity };
    const used = usage.tradesUsedThisMonth || 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, used };
  }

  if (type === 'aiAnalysis') {
    const limit = plan.maxAiAnalysisPerMonth;
    if (limit === -1) return { allowed: true, remaining: Infinity };
    const used = usage.aiAnalysisUsedThisMonth || 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, used };
  }

  if (type === 'records') {
    const limit = plan.maxRecords;
    if (limit === -1) return { allowed: true, remaining: Infinity };
    return { allowed: true, limit }; // 需要单独检查当前数量
  }

  return { allowed: true, remaining: Infinity };
}

/**
 * 获取所有订阅计划
 */
export async function getPlans() {
  try {
    const response = await authApi.get('/subscription/plans');
    return response.data;
  } catch (error) {
    console.error('获取订阅计划失败:', error);
    return [];
  }
}

/**
 * 创建订阅
 */
export async function createSubscription(planName, billingCycle = 'monthly') {
  try {
    const response = await authApi.post('/subscription/create', { planName, billingCycle });
    // 清除缓存
    cachedSubscription = null;
    return response.data;
  } catch (error) {
    console.error('创建订阅失败:', error);
    throw error;
  }
}

/**
 * 取消订阅
 */
export async function cancelSubscription() {
  try {
    const response = await authApi.post('/subscription/cancel');
    cachedSubscription = null;
    return response.data;
  } catch (error) {
    console.error('取消订阅失败:', error);
    throw error;
  }
}

/**
 * 记录使用量
 */
export async function recordUsage(type) {
  try {
    await authApi.post('/subscription/usage', { type });
    // 更新本地缓存
    if (cachedSubscription && cachedSubscription.usage) {
      if (type === 'trade') {
        cachedSubscription.usage.tradesUsedThisMonth++;
      } else if (type === 'aiAnalysis') {
        cachedSubscription.usage.aiAnalysisUsedThisMonth++;
      }
    }
  } catch (error) {
    console.error('记录使用量失败:', error);
  }
}

/**
 * 获取订阅计划显示信息
 */
export function getPlanDisplayInfo(planName) {
  const info = {
    free: {
      name: 'Free',
      displayName: '免费版',
      color: '#6b7280',
      bgColor: '#f3f4f6',
      icon: '🆓',
    },
    pro: {
      name: 'Pro',
      displayName: '专业版',
      color: '#d97706',
      bgColor: '#fef3c7',
      icon: '⭐',
    },
    team: {
      name: 'Team',
      displayName: '团队版',
      color: '#7c3aed',
      bgColor: '#ede9fe',
      icon: '🚀',
    },
    elite: {
      name: 'Elite',
      displayName: '精英版',
      color: '#a855f7',
      bgColor: '#f3e8ff',
      icon: '👑',
    },
  };
  return info[planName] || info.free;
}

/**
 * 免费计划默认值
 */
function getFreePlanDefaults() {
  return {
    name: 'free',
    displayName: 'Free 免费版',
    maxRecords: 1,
    maxTradesPerMonth: 50,      // 与服务器端保持一致
    maxHistoryDays: 7,          // 与服务器端保持一致
    maxAiAnalysisPerMonth: 2,   // 与服务器端保持一致
    maxTeamMembers: 1,
    hasSmartDiagnosis: false,
    hasMonteCarlo: false,
    hasOptimalStopLoss: false,
    hasExpectancy: false,
    hasBehaviorTags: false,
    hasExport: false,
    hasApi: false,
    hasPrioritySupport: false,
  };
}

/**
 * 清除订阅缓存
 */
export function clearSubscriptionCache() {
  cachedSubscription = null;
  cacheTime = 0;
}

/**
 * 使用兑换码兑换订阅
 */
export async function redeemCode(code) {
  try {
    const response = await authApi.post('/subscription/redeem', { code });
    // 清除缓存
    cachedSubscription = null;
    return response.data;
  } catch (error) {
    console.error('兑换码兑换失败:', error);
    throw error;
  }
}

export default {
  getSubscriptionStatus,
  hasFeature,
  checkUsageLimit,
  getPlans,
  createSubscription,
  cancelSubscription,
  recordUsage,
  getPlanDisplayInfo,
  clearSubscriptionCache,
  redeemCode,
  FEATURES,
};
