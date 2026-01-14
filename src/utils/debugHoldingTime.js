/**
 * 持仓时间调试工具
 * 用于检查和修复持仓时间数据
 */
import StorageService from '../services/storage';

/**
 * 检查并修复所有交易的持仓时间
 */
export const fixHoldingTimes = async () => {
  try {
    const trades = await StorageService.getAllTrades();
    let fixedCount = 0;
    let errorCount = 0;
    
    const fixedTrades = trades.map(trade => {
      // 如果已经有正确的 holdingSeconds，跳过
      if (trade.holdingSeconds !== undefined && trade.holdingSeconds !== null) {
        return trade;
      }
      
      // 尝试从开仓和平仓时间计算
      if (trade.openTime && trade.closeTime) {
        try {
          const openTime = new Date(trade.openTime);
          const closeTime = new Date(trade.closeTime);
          
          if (!isNaN(openTime.getTime()) && !isNaN(closeTime.getTime())) {
            const seconds = Math.round((closeTime - openTime) / 1000);
            trade.holdingSeconds = seconds;
            fixedCount++;
            
            // 删除旧字段
            if (trade.holdingMinutes !== undefined) {
              delete trade.holdingMinutes;
            }
            
            return trade;
          }
        } catch (error) {
          console.error('计算持仓时间失败:', error, trade);
          errorCount++;
        }
      }
      
      // 如果有旧的 holdingMinutes，转换
      if (trade.holdingMinutes !== undefined && trade.holdingMinutes !== null) {
        trade.holdingSeconds = Math.round(trade.holdingMinutes * 60);
        delete trade.holdingMinutes;
        fixedCount++;
        return trade;
      }
      
      // 都没有，设置为0
      trade.holdingSeconds = 0;
      return trade;
    });
    
    // 保存修复后的数据
    await StorageService.saveTrades(fixedTrades);
    
    return {
      success: true,
      total: trades.length,
      fixed: fixedCount,
      errors: errorCount,
      message: `已修复 ${fixedCount} 笔交易的持仓时间`,
    };
  } catch (error) {
    return {
      success: false,
      message: `修复失败: ${error.message}`,
    };
  }
};

/**
 * 检查持仓时间数据状态
 */
export const checkHoldingTimes = async () => {
  try {
    const trades = await StorageService.getAllTrades();
    
    const stats = {
      total: trades.length,
      hasHoldingSeconds: 0,
      hasHoldingMinutes: 0,
      hasOpenCloseTime: 0,
      missingAll: 0,
      zeroSeconds: 0,
      sample: [],
    };
    
    trades.forEach((trade, index) => {
      if (trade.holdingSeconds !== undefined && trade.holdingSeconds !== null) {
        stats.hasHoldingSeconds++;
        if (trade.holdingSeconds === 0) {
          stats.zeroSeconds++;
        }
      }
      if (trade.holdingMinutes !== undefined && trade.holdingMinutes !== null) {
        stats.hasHoldingMinutes++;
      }
      if (trade.openTime && trade.closeTime) {
        stats.hasOpenCloseTime++;
      }
      if (!trade.holdingSeconds && !trade.holdingMinutes && (!trade.openTime || !trade.closeTime)) {
        stats.missingAll++;
      }
      
      // 收集前5个样本
      if (index < 5) {
        stats.sample.push({
          id: trade.id,
          openTime: trade.openTime,
          closeTime: trade.closeTime,
          holdingSeconds: trade.holdingSeconds,
          holdingMinutes: trade.holdingMinutes,
        });
      }
    });
    
    return {
      success: true,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      message: `检查失败: ${error.message}`,
    };
  }
};

export default {
  fixHoldingTimes,
  checkHoldingTimes,
};




