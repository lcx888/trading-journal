/**
 * 迷你风控状态条 - 显示在 Dashboard 顶部
 * 极简设计：只显示测试结果
 */
import { useMemo } from 'react';
import { Progress, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';

// 本地存储 key
const STORAGE_KEY = 'tradewhy_drawdown_config';
const CONFIGURED_KEY = 'tradewhy_drawdown_configured';

// 默认配置
const DEFAULT_CONFIG = {
  initialBalance: 100000,
  maxDrawdownPercent: 10,
  dailyDrawdownPercent: 5,
  trailingEnabled: true,
  warningThreshold: 70,
};

// 品种 tick 价值
const TICK_VALUES = {
  'GC': 10, 'ES': 12.5, 'NQ': 5, 'RTY': 5, 'CL': 10, 'SI': 25, 'YM': 5,
  'ZB': 31.25, 'ZN': 15.625, '6E': 12.5, 'M2K': 0.5, 'MES': 1.25, 'MNQ': 0.5, 'MGC': 1,
};

const getTickValue = (instrumentCode, instruments) => {
  const instrument = instruments?.find(i => i.code === instrumentCode);
  if (instrument?.tickValue) return instrument.tickValue;
  return TICK_VALUES[instrumentCode] || 5;
};

const ticksToUSD = (ticks, instrumentCode, quantity, instruments) => {
  if (ticks === undefined || ticks === null) return 0;
  const tickValue = getTickValue(instrumentCode, instruments);
  return Math.abs(ticks) * tickValue * Math.abs(quantity || 1);
};

const RiskStatusBar = ({ trades = [], instruments = [], onNavigate }) => {
  // 检查是否已配置
  const isConfigured = useMemo(() => {
    try {
      return localStorage.getItem(CONFIGURED_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  // 获取配置
  const config = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  }, []);

  // 计算测试结果
  const testResult = useMemo(() => {
    if (trades.length === 0) {
      return { passed: true, maxDrawdownPercent: 0, usedPercent: 0 };
    }

    const sortedTrades = [...trades].sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
    
    let cumulative = config.initialBalance;
    let highWaterMark = config.initialBalance;
    let maxDrawdownSeen = 0;

    sortedTrades.forEach(trade => {
      const maeTicks = trade.mae ?? trade.jigsawData?.mae ?? 0;
      const maeUSD = ticksToUSD(maeTicks, trade.instrumentCode, trade.openQuantity, instruments);
      const mfeTicks = trade.mfe ?? trade.jigsawData?.mfe ?? 0;
      const mfeUSD = ticksToUSD(mfeTicks, trade.instrumentCode, trade.openQuantity, instruments);

      const highestDuringTrade = cumulative + mfeUSD;
      if (highestDuringTrade > highWaterMark) highWaterMark = highestDuringTrade;

      const lowestPoint = cumulative - maeUSD;
      const dd = highWaterMark - lowestPoint;
      if (dd > maxDrawdownSeen) maxDrawdownSeen = dd;

      cumulative += trade.pnl || 0;
      if (cumulative > highWaterMark) highWaterMark = cumulative;
    });

    const maxDrawdownPercent = highWaterMark > 0 ? (maxDrawdownSeen / highWaterMark) * 100 : 0;
    const passed = maxDrawdownPercent < config.maxDrawdownPercent;
    const usedPercent = (maxDrawdownPercent / config.maxDrawdownPercent) * 100;

    return { 
      passed, 
      maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(1)),
      usedPercent: Number(Math.min(100, usedPercent).toFixed(0)),
    };
  }, [trades, instruments, config]);

  // 未配置时不显示
  if (!isConfigured) {
    return null;
  }

  // 极简状态条
  return (
    <div 
      onClick={() => onNavigate?.('risk-control')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: testResult.passed ? 'rgba(14, 203, 129, 0.08)' : 'rgba(246, 70, 93, 0.08)',
        border: `1px solid ${testResult.passed ? 'rgba(14, 203, 129, 0.2)' : 'rgba(246, 70, 93, 0.2)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      className="hover:opacity-80"
    >
      {/* 测试结果 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {testResult.passed ? (
          <CheckCircleOutlined style={{ color: '#0ECB81', fontSize: 16 }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#F6465D', fontSize: 16 }} />
        )}
        <span style={{ 
          fontSize: 13, 
          fontWeight: 600, 
          color: testResult.passed ? '#0ECB81' : '#F6465D' 
        }}>
          {testResult.passed ? '风控通过' : '已触发'}
        </span>
      </div>

      {/* 回撤使用情况 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Tooltip title={`最大回撤 ${testResult.maxDrawdownPercent}%，限制 ${config.maxDrawdownPercent}%`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>回撤</span>
            <Progress 
              percent={testResult.usedPercent}
              showInfo={false}
              strokeColor={testResult.usedPercent > 70 ? '#F6465D' : '#0ECB81'}
              trailColor="rgba(255,255,255,0.1)"
              style={{ width: 80, margin: 0 }}
              size="small"
            />
            <span style={{ 
              fontSize: 12, 
              fontFamily: 'JetBrains Mono', 
              color: 'var(--text-secondary)' 
            }}>
              {testResult.maxDrawdownPercent}% / {config.maxDrawdownPercent}%
            </span>
          </div>
        </Tooltip>
        
        <RightOutlined style={{ fontSize: 10, color: 'var(--text-tertiary)' }} />
      </div>
    </div>
  );
};

export default RiskStatusBar;
