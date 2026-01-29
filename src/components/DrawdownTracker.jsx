import { useState, useEffect, useMemo } from 'react';
import { Tooltip, Progress, InputNumber, Switch, Modal, Form, Select, message, Button } from 'antd';
import { 
  WarningOutlined, 
  SafetyOutlined, 
  SettingOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';

// 品种 tick 价值映射（美元/tick）
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

// 颜色系统 - 与 index.css 中的 CSS 变量保持一致
const COLORS = {
  // 背景色（极深层次）
  bgPrimary: '#050505',
  bgSecondary: '#0a0a0c',
  bgTertiary: '#0d0d10',
  bgHover: '#111114',
  // 品牌色（金色）
  brand: '#F0B90B',
  brandLight: '#FCD535',
  brandBg: 'rgba(240, 185, 11, 0.08)',
  // 盈亏语义色
  profit: '#0ECB81',
  profitBg: 'rgba(14, 203, 129, 0.08)',
  loss: '#F6465D',
  lossBg: 'rgba(246, 70, 93, 0.08)',
  // 警告色
  warning: '#eab308',
  warningBg: 'rgba(234, 179, 8, 0.08)',
  // 文字色
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  textDisabled: '#4b5563',
  // 边框色（极微弱）
  border: 'rgba(255, 255, 255, 0.05)',
  borderSecondary: 'rgba(255, 255, 255, 0.08)',
};

// 默认配置（PropFirm 常见规则）
const DEFAULT_CONFIG = {
  initialBalance: 100000,        // 初始资金
  maxDrawdownPercent: 10,        // 最大总回撤 (%)
  dailyDrawdownPercent: 5,       // 日内最大回撤 (%)
  trailingEnabled: true,         // 是否启用追踪回撤
  warningThreshold: 70,          // 警告阈值 (用了多少%的回撤额度)
};

// 本地存储 key
const STORAGE_KEY = 'tradewhy_drawdown_config';
const CONFIGURED_KEY = 'tradewhy_drawdown_configured';  // 是否已配置过

/**
 * PropFirm 模拟考核组件
 * 
 * 极简设计原则：
 * 1. 聚焦核心：通过/爆仓状态
 * 2. 可视化优先：权益曲线是主角
 * 3. 配置简单：首次使用引导设置
 * 
 * @param {Array} trades - 交易数据
 * @param {Array} instruments - 品种配置（用于 MAE 转换）
 * @param {boolean} compact - 紧凑模式
 */
const DrawdownTracker = ({ trades = [], instruments = [], compact = false, hideSettings = false }) => {
  // 检查用户是否已配置过
  const [isConfigured, setIsConfigured] = useState(() => {
    try {
      return localStorage.getItem(CONFIGURED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [config, setConfig] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 保存配置
  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    localStorage.setItem(CONFIGURED_KEY, 'true');  // 标记为已配置
    setIsConfigured(true);
    message.success('回撤追踪设置已保存');
    setShowSettings(false);
  };

  // 计算回撤数据
  const drawdownData = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        currentEquity: config.initialBalance,
        highWaterMark: config.initialBalance,
        drawdownFloor: config.initialBalance * (1 - config.maxDrawdownPercent / 100),
        currentDrawdown: 0,
        currentDrawdownPercent: 0,
        remainingSpace: config.initialBalance * config.maxDrawdownPercent / 100,
        remainingSpacePercent: 100,
        dailyDrawdown: 0,
        dailyDrawdownPercent: 0,
        dailyRemaining: config.initialBalance * config.dailyDrawdownPercent / 100,
        status: 'safe',
        equityCurve: [],
        drawdownHistory: [],
      };
    }

    // 按时间排序
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.openTime) - new Date(b.openTime)
    );

    let cumulative = config.initialBalance;      // 当前累计权益（平仓后）
    let highWaterMark = config.initialBalance;   // 高水位（含浮盈时的最高点）
    let maxDrawdownSeen = 0;                     // 历史最大回撤（含浮亏）
    let drawdownFloor = config.initialBalance * (1 - config.maxDrawdownPercent / 100);
    
    const equityCurve = [];
    const drawdownHistory = [];
    
    // 计算权益曲线和追踪回撤（含浮亏）
    sortedTrades.forEach((trade, index) => {
      const pnl = trade.pnl || 0;
      const prevCumulative = cumulative;
      
      // 获取该笔交易的 MAE（最大浮亏）
      const maeTicks = trade.mae ?? trade.jigsawData?.mae ?? 0;
      const maeUSD = ticksToUSD(maeTicks, trade.instrumentCode, trade.openQuantity, instruments);
      
      // 获取该笔交易的 MFE（最大浮盈）
      const mfeTicks = trade.mfe ?? trade.jigsawData?.mfe ?? 0;
      const mfeUSD = ticksToUSD(mfeTicks, trade.instrumentCode, trade.openQuantity, instruments);
      
      // 持仓期间的最低权益点 = 交易前权益 - MAE
      const lowestDuringTrade = prevCumulative - maeUSD;
      
      // 持仓期间的最高权益点 = 交易前权益 + MFE
      const highestDuringTrade = prevCumulative + mfeUSD;
      
      // 更新高水位（考虑持仓期间的最高点）
      if (config.trailingEnabled && highestDuringTrade > highWaterMark) {
        highWaterMark = highestDuringTrade;
        // 追踪回撤：底线跟着高水位上移
        drawdownFloor = highWaterMark * (1 - config.maxDrawdownPercent / 100);
      }
      
      // 计算持仓期间的最大回撤（从高水位到最低点）
      const drawdownDuringTrade = highWaterMark - lowestDuringTrade;
      if (drawdownDuringTrade > maxDrawdownSeen) {
        maxDrawdownSeen = drawdownDuringTrade;
      }
      
      // 更新累计权益（平仓后）
      cumulative += pnl;
      
      // 平仓后再次检查高水位
      if (config.trailingEnabled && cumulative > highWaterMark) {
        highWaterMark = cumulative;
        drawdownFloor = highWaterMark * (1 - config.maxDrawdownPercent / 100);
      }
      
      // 当前回撤（从高水位到当前权益）
      const currentDrawdownFromHWM = highWaterMark - cumulative;
      const drawdownPercent = highWaterMark > 0 ? (currentDrawdownFromHWM / highWaterMark) * 100 : 0;
      
      // 包含浮亏的最大回撤百分比
      const maxDrawdownPercent = highWaterMark > 0 ? (maxDrawdownSeen / highWaterMark) * 100 : 0;
      
      equityCurve.push({
        date: dayjs(trade.openTime).format('MM/DD HH:mm'),
        equity: Number(cumulative.toFixed(2)),
        lowestPoint: Number(lowestDuringTrade.toFixed(2)),  // 持仓期间最低点
        hwm: Number(highWaterMark.toFixed(2)),
        floor: Number(drawdownFloor.toFixed(2)),
        drawdown: Number(currentDrawdownFromHWM.toFixed(2)),
        drawdownPercent: Number(drawdownPercent.toFixed(2)),
        maeUSD: Number(maeUSD.toFixed(2)),
        mfeUSD: Number(mfeUSD.toFixed(2)),
        maxDrawdownSeen: Number(maxDrawdownSeen.toFixed(2)),
        maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
      });
      
      drawdownHistory.push({
        date: dayjs(trade.openTime).format('MM/DD HH:mm'),
        value: Number(maxDrawdownPercent.toFixed(2)),  // 使用含浮亏的最大回撤
      });
    });

    // 当前状态（使用含浮亏的最大回撤）
    const currentEquity = cumulative;
    const currentDrawdown = maxDrawdownSeen;  // 使用历史最大回撤（含浮亏）
    const currentDrawdownPercent = highWaterMark > 0 ? (currentDrawdown / highWaterMark) * 100 : 0;
    const remainingSpace = currentEquity - drawdownFloor;
    const maxAllowedDrawdown = highWaterMark * config.maxDrawdownPercent / 100;
    const remainingSpacePercent = maxAllowedDrawdown > 0 
      ? ((maxAllowedDrawdown - currentDrawdown) / maxAllowedDrawdown) * 100 
      : 100;

    // 计算今日回撤（含浮亏）
    const today = dayjs().startOf('day');
    const todayTrades = sortedTrades.filter(t => dayjs(t.openTime).isAfter(today));
    
    let todayEquity = currentEquity - todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    let todayHWM = todayEquity;
    let todayMaxDrawdown = 0;
    
    todayTrades.forEach(trade => {
      // 获取该笔交易的 MAE（最大浮亏）
      const maeTicks = trade.mae ?? trade.jigsawData?.mae ?? 0;
      const maeUSD = ticksToUSD(maeTicks, trade.instrumentCode, trade.openQuantity, instruments);
      
      // 获取该笔交易的 MFE（最大浮盈）
      const mfeTicks = trade.mfe ?? trade.jigsawData?.mfe ?? 0;
      const mfeUSD = ticksToUSD(mfeTicks, trade.instrumentCode, trade.openQuantity, instruments);
      
      // 更新今日高水位（考虑 MFE）
      const highestDuringTrade = todayEquity + mfeUSD;
      if (highestDuringTrade > todayHWM) todayHWM = highestDuringTrade;
      
      // 持仓期间最低点
      const lowestDuringTrade = todayEquity - maeUSD;
      
      // 计算从今日高水位到最低点的回撤
      const dd = todayHWM - lowestDuringTrade;
      if (dd > todayMaxDrawdown) todayMaxDrawdown = dd;
      
      // 更新今日权益
      todayEquity += trade.pnl || 0;
      
      // 平仓后再次检查高水位
      if (todayEquity > todayHWM) todayHWM = todayEquity;
    });
    
    const dailyDrawdown = todayMaxDrawdown;
    const dailyLimit = highWaterMark * config.dailyDrawdownPercent / 100;
    const dailyDrawdownPercent = dailyLimit > 0 ? (dailyDrawdown / dailyLimit) * 100 : 0;
    const dailyRemaining = dailyLimit - dailyDrawdown;

    // 状态判定
    let status = 'safe';
    if (remainingSpacePercent <= 0 || dailyRemaining <= 0) {
      status = 'breach';
    } else if (remainingSpacePercent <= 30 || (dailyRemaining / dailyLimit * 100) <= 30) {
      status = 'danger';
    } else if (remainingSpacePercent <= (100 - config.warningThreshold)) {
      status = 'warning';
    }

    return {
      currentEquity: Number(currentEquity.toFixed(2)),
      highWaterMark: Number(highWaterMark.toFixed(2)),
      drawdownFloor: Number(drawdownFloor.toFixed(2)),
      currentDrawdown: Number(currentDrawdown.toFixed(2)),
      currentDrawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
      remainingSpace: Number(remainingSpace.toFixed(2)),
      remainingSpacePercent: Number(Math.max(0, remainingSpacePercent).toFixed(1)),
      dailyDrawdown: Number(dailyDrawdown.toFixed(2)),
      dailyDrawdownPercent: Number(Math.min(100, dailyDrawdownPercent).toFixed(1)),
      dailyRemaining: Number(Math.max(0, dailyRemaining).toFixed(2)),
      dailyLimit: Number(dailyLimit.toFixed(2)),
      status,
      equityCurve,
      drawdownHistory,
    };
  }, [trades, config]);

  // 获取状态颜色和图标
  const getStatusInfo = (status) => {
    switch (status) {
      case 'breach':
        return { color: COLORS.loss, bg: COLORS.lossBg, icon: '🚨', text: '突破限制' };
      case 'danger':
        return { color: COLORS.loss, bg: COLORS.lossBg, icon: '⚠️', text: '危险区域' };
      case 'warning':
        return { color: COLORS.warning, bg: COLORS.warningBg, icon: '⚡', text: '接近警戒' };
      default:
        return { color: COLORS.profit, bg: COLORS.profitBg, icon: '✅', text: '安全区域' };
    }
  };

  const statusInfo = getStatusInfo(drawdownData.status);

  // 判断是否爆仓（总体回撤或日内回撤超限）
  const isBreach = drawdownData.status === 'breach' || 
    drawdownData.currentDrawdownPercent >= config.maxDrawdownPercent ||
    drawdownData.dailyDrawdown > drawdownData.dailyLimit;
  
  // 爆仓时使用的灰色
  const BREACH_COLOR = COLORS.textDisabled;

  // 极简配色覆盖
  const MINIMAL_COLORS = {
    border: 'rgba(255, 255, 255, 0.03)',
    bg: 'transparent',
    text: COLORS.textSecondary,
    accent: COLORS.textPrimary
  };

  // 图表配置 - 双图表布局（累计盈亏 + 回撤深度）
  const getChartOption = () => {
    const { equityCurve } = drawdownData;
    if (equityCurve.length === 0) return {};

    // 计算累计盈亏（从 0 开始，不含初始资金）
    const pnlData = equityCurve.map(d => Number((d.equity - config.initialBalance).toFixed(2)));
    const hwmPnlData = equityCurve.map(d => Number((d.hwm - config.initialBalance).toFixed(2)));
    const lowestPnlData = equityCurve.map(d => Number((d.lowestPoint - config.initialBalance).toFixed(2)));
    
    // 回撤深度数据（负值，水下图）
    const drawdownDepthData = equityCurve.map(d => -d.maxDrawdownSeen);
    
    // 计算回撤限制线
    const maxDrawdownLimit = -(config.initialBalance * config.maxDrawdownPercent / 100);

    // ========== Y轴自适应缩放 ==========
    const allPnlValues = [...pnlData, ...hwmPnlData, ...lowestPnlData];
    const pnlMin = Math.min(...allPnlValues, 0);
    const pnlMax = Math.max(...allPnlValues, 0);
    const pnlRange = pnlMax - pnlMin || 100;
    const pnlPadding = pnlRange * 0.1;
    
    const ddMin = Math.min(...drawdownDepthData, maxDrawdownLimit);
    const ddPadding = Math.abs(ddMin) * 0.15;

    return {
      backgroundColor: 'transparent',
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
          zoomOnMouseWheel: 'shift',
          moveOnMouseMove: true,
          preventDefaultMouseMove: true,
        },
        {
          type: 'inside',
          yAxisIndex: [0],
          orient: 'vertical',
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          filterMode: 'none',
          preventDefaultMouseMove: true,
        },
        {
          type: 'inside',
          yAxisIndex: [1],
          orient: 'vertical',
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          filterMode: 'none',
          preventDefaultMouseMove: true,
        },
        ...(equityCurve.length > 15 ? [{
          type: 'slider',
          xAxisIndex: [0, 1],
          height: 18,
          bottom: 0,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgPrimary,
          fillerColor: COLORS.brandBg,
          handleStyle: { color: COLORS.brand, borderColor: COLORS.brand },
          textStyle: { color: COLORS.textTertiary, fontSize: 9 },
          brushSelect: false,
        }] : []),
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: COLORS.border,
        padding: 12,
        textStyle: { color: COLORS.textPrimary, fontSize: 11 },
        formatter: (params) => {
          const idx = params[0]?.dataIndex;
          if (idx === undefined || !equityCurve[idx]) return '';
          const data = equityCurve[idx];
          const pnl = pnlData[idx];
          
          let html = `
            <div style="font-size:10px;color:${COLORS.textTertiary};margin-bottom:8px">#${idx + 1} · ${data.date}</div>
            <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:4px">
              <span style="color:${COLORS.brand}">累计盈亏</span>
              <span style="font-weight:700;font-size:14px;color:${pnl >= 0 ? COLORS.profit : COLORS.loss}">
                ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:4px">
              <span style="color:${COLORS.profit}">高水位</span>
              <span>+$${hwmPnlData[idx].toLocaleString()}</span>
            </div>`;
          
          if (data.maeUSD > 0) {
            html += `
            <div style="border-top:1px solid ${COLORS.border};margin:8px 0;padding-top:8px">
              <div style="font-size:9px;color:${COLORS.textTertiary};margin-bottom:6px;text-transform:uppercase">本笔风险</div>
              <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px">
                <span style="color:${COLORS.loss}">浮亏 (MAE)</span>
                <span style="color:${COLORS.loss}">-$${data.maeUSD.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:20px">
                <span style="color:${COLORS.textTertiary}">最低点</span>
                <span style="color:${COLORS.loss}">${lowestPnlData[idx] >= 0 ? '+' : ''}$${lowestPnlData[idx].toLocaleString()}</span>
              </div>
            </div>`;
          }
          
          html += `
            <div style="border-top:1px solid ${COLORS.border};margin-top:8px;padding-top:8px">
              <div style="display:flex;justify-content:space-between;gap:20px">
                <span style="color:${COLORS.textSecondary}">最大回撤</span>
                <span style="color:${COLORS.loss};font-weight:700">-$${data.maxDrawdownSeen.toLocaleString()} (${data.maxDrawdownPercent.toFixed(2)}%)</span>
              </div>
            </div>
          `;
          
          return html;
        }
      },
      legend: {
        show: true,
        top: 0,
        right: 0,
        textStyle: { color: COLORS.textTertiary, fontSize: 10 },
        itemWidth: 14,
        itemHeight: 3,
        data: ['累计盈亏', '高水位', '浮亏最低点', '回撤深度', '回撤限制'],
      },
      grid: [
        { left: 50, right: 20, top: 30, height: '45%' },
        { left: 50, right: 20, top: '62%', height: '30%' },
      ],
      xAxis: [
        {
          type: 'category',
          gridIndex: 0,
          data: equityCurve.map((_, i) => `#${i + 1}`),
          axisLine: { lineStyle: { color: COLORS.border } },
          axisLabel: { show: false },
          axisTick: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: equityCurve.map((_, i) => `#${i + 1}`),
          axisLine: { lineStyle: { color: COLORS.border } },
          axisLabel: { 
            color: COLORS.textTertiary, 
            fontSize: 9,
            interval: equityCurve.length > 20 ? Math.floor(equityCurve.length / 10) : 0,
          },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          min: pnlMin - pnlPadding,
          max: pnlMax + pnlPadding,
          axisLine: { show: false },
          axisLabel: { 
            color: COLORS.textTertiary, 
            fontSize: 9,
            formatter: v => {
              if (v === 0) return '$0';
              if (Math.abs(v) >= 1000) return `${v >= 0 ? '+' : ''}$${(v/1000).toFixed(1)}k`;
              return `${v >= 0 ? '+' : ''}$${v.toFixed(0)}`;
            }
          },
          splitLine: { lineStyle: { color: COLORS.border, type: 'dashed' } },
        },
        {
          type: 'value',
          gridIndex: 1,
          min: ddMin - ddPadding,
          max: 10,
          axisLine: { show: false },
          axisLabel: { 
            color: COLORS.textTertiary, 
            fontSize: 9,
            formatter: v => {
              if (v >= 0) return '$0';
              return `-$${Math.abs(v).toFixed(0)}`;
            }
          },
          splitLine: { lineStyle: { color: COLORS.border, type: 'dashed' } },
        },
      ],
      series: [
        // === 上图：累计盈亏 ===
        {
          name: '高水位',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: hwmPnlData,
          symbol: 'none',
          lineStyle: { width: 1, color: COLORS.profit, type: 'dashed' },
          z: 1,
        },
        {
          name: '累计盈亏',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: pnlData,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: (value, params) => {
            const idx = params.dataIndex;
            if (idx === pnlData.length - 1) return 8;
            if (value === Math.max(...pnlData)) return 8;
            if (value === Math.min(...pnlData)) return 8;
            return 0;
          },
          itemStyle: { 
            color: (params) => params.value >= 0 ? COLORS.profit : COLORS.loss,
            borderColor: COLORS.bgSecondary,
            borderWidth: 2,
          },
          lineStyle: { width: 2.5, color: COLORS.brand },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: COLORS.brand + '40' },
                { offset: 0.5, color: COLORS.brand + '10' },
                { offset: 1, color: COLORS.brand + '00' }
              ]
            }
          },
          z: 3,
        },
        {
          name: '浮亏最低点',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: lowestPnlData,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 1, color: COLORS.loss, type: 'dashed', opacity: 0.6 },
          itemStyle: { color: COLORS.loss },
          z: 2,
        },
        
        // === 下图：回撤深度 ===
        {
          name: '回撤深度',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: drawdownDepthData,
          smooth: 0.2,
          symbol: 'none',
          lineStyle: { width: 1.5, color: COLORS.loss },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: COLORS.loss + '60' },
                { offset: 1, color: COLORS.loss + '20' }
              ]
            }
          },
          z: 2,
        },
        {
          name: '回撤限制',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: equityCurve.map(() => maxDrawdownLimit),
          symbol: 'none',
          lineStyle: { width: 2, color: COLORS.loss, type: [8, 4] },
          z: 1,
        },
      ]
    };
  };

  // 简化版图表配置（仅权益曲线，用于未配置状态）
  const getSimpleChartOption = () => {
    const { equityCurve } = drawdownData;
    if (equityCurve.length === 0) return {};

    const pnlData = equityCurve.map(d => Number((d.equity - config.initialBalance).toFixed(2)));
    const labels = equityCurve.map(d => d.date);

    const pnlMin = Math.min(...pnlData, 0);
    const pnlMax = Math.max(...pnlData, 0);
    const pnlRange = pnlMax - pnlMin || 100;
    const pnlPadding = pnlRange * 0.15;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: COLORS.bgTertiary,
        borderColor: COLORS.border,
        textStyle: { color: COLORS.textPrimary, fontSize: 11 },
        formatter: (params) => {
          const data = params[0];
          const val = data.value;
          const color = val >= 0 ? COLORS.profit : COLORS.loss;
          return `<div style="font-size:10px;color:${COLORS.textTertiary}">${data.name}</div>
                  <div style="font-size:13px;font-weight:600;color:${color}">${val >= 0 ? '+' : ''}$${val.toLocaleString()}</div>`;
        }
      },
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: COLORS.border } },
        axisLabel: { color: COLORS.textTertiary, fontSize: 9, rotate: 30 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: pnlMin - pnlPadding,
        max: pnlMax + pnlPadding,
        axisLine: { show: false },
        axisLabel: { 
          color: COLORS.textTertiary, 
          fontSize: 9,
          formatter: v => `$${v >= 0 ? '+' : ''}${v}`
        },
        splitLine: { lineStyle: { color: COLORS.border, type: 'dashed' } },
      },
      series: [{
        name: '累计盈亏',
        type: 'line',
        data: pnlData,
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { 
          color: (params) => params.value >= 0 ? COLORS.profit : COLORS.loss,
        },
        lineStyle: { width: 2, color: COLORS.brand },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: COLORS.brand + '30' },
              { offset: 1, color: COLORS.brand + '00' }
            ]
          }
        },
      }]
    };
  };

  // 设置弹窗组件（可复用）
  const renderSettingsModal = () => (
    <Modal
      title="回撤风控设置"
      open={showSettings}
      onCancel={() => setShowSettings(false)}
      footer={null}
      width={400}
      styles={{
        content: { 
          background: COLORS.bgSecondary, 
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8
        },
        header: { 
          background: COLORS.bgSecondary, 
          borderBottom: `1px solid ${COLORS.border}`,
          color: COLORS.textPrimary
        },
      }}
    >
      <Form
        layout="vertical"
        initialValues={config}
        onFinish={saveConfig}
        style={{ marginTop: 16 }}
      >
        <Form.Item 
          label="初始资金" 
          name="initialBalance"
          tooltip="您的账户初始资金"
        >
          <InputNumber 
            style={{ width: '100%' }} 
            prefix="$" 
            min={1000}
            step={1000}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
          />
        </Form.Item>
        
        <Form.Item 
          label="最大总回撤 (%)" 
          name="maxDrawdownPercent"
          tooltip="账户允许的最大回撤比例，通常 PropFirm 设置为 10%"
        >
          <InputNumber 
            style={{ width: '100%' }} 
            min={1} 
            max={50}
            suffix="%"
          />
        </Form.Item>
        
        <Form.Item 
          label="日内最大回撤 (%)" 
          name="dailyDrawdownPercent"
          tooltip="每日允许的最大回撤比例，通常 PropFirm 设置为 5%"
        >
          <InputNumber 
            style={{ width: '100%' }} 
            min={1} 
            max={20}
            suffix="%"
          />
        </Form.Item>
        
        <Form.Item 
          label="启用追踪回撤" 
          name="trailingEnabled"
          valuePropName="checked"
          tooltip="开启后，回撤底线会随着账户创新高而上移"
        >
          <Switch />
        </Form.Item>
        
        <Form.Item 
          label="警告阈值 (%)" 
          name="warningThreshold"
          tooltip="当回撤达到此比例时显示警告"
        >
          <InputNumber 
            style={{ width: '100%' }} 
            min={50} 
            max={90}
            suffix="%"
          />
        </Form.Item>

        <div style={{ 
          background: COLORS.bgTertiary, 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16,
          border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <InfoCircleOutlined style={{ color: COLORS.brand }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSecondary }}>PropFirm 常见规则</span>
          </div>
          <div style={{ fontSize: 10, color: COLORS.textTertiary, lineHeight: 1.6 }}>
            <div>• FTMO: 总回撤 10%, 日回撤 5%</div>
            <div>• MyForexFunds: 总回撤 12%, 日回撤 5%</div>
            <div>• Funded Next: 总回撤 10%, 日回撤 5%</div>
          </div>
        </div>
        
        <Form.Item style={{ marginBottom: 0 }}>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '10px 16px',
              background: COLORS.brand,
              border: 'none',
              borderRadius: 4,
              color: COLORS.bgPrimary,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
          >
            保存设置
          </button>
        </Form.Item>
      </Form>
    </Modal>
  );

  // 紧凑模式（侧边栏用）- 遵循 DESIGN_SYSTEM.md
  if (compact) {
    return (
      <div style={{ 
        background: COLORS.bgSecondary, 
        borderRadius: 6, 
        padding: 12,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.textSecondary }}>
            回撤追踪
          </span>
          <span style={{ 
            fontSize: 10, 
            padding: '2px 6px', 
            borderRadius: 2,
            background: statusInfo.bg,
            color: statusInfo.color,
            fontWeight: 500
          }}>
            {statusInfo.text}
          </span>
        </div>
        
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.textTertiary, marginBottom: 4 }}>
            <span>总体回撤</span>
            <span>{drawdownData.currentDrawdownPercent}% / {config.maxDrawdownPercent}%</span>
          </div>
          <Progress 
            percent={Math.min(100, (drawdownData.currentDrawdownPercent / config.maxDrawdownPercent) * 100)}
            strokeColor={drawdownData.currentDrawdownPercent > config.maxDrawdownPercent * 0.7 ? COLORS.loss : COLORS.brand}
            trailColor={COLORS.border}
            showInfo={false}
            size="small"
          />
        </div>
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.textTertiary, marginBottom: 4 }}>
            <span>今日回撤</span>
            <span>{drawdownData.dailyDrawdownPercent.toFixed(0)}% / {config.dailyDrawdownPercent}%</span>
          </div>
          <Progress 
            percent={Math.min(100, drawdownData.dailyDrawdownPercent)}
            strokeColor={drawdownData.dailyDrawdownPercent > 70 ? COLORS.loss : COLORS.profit}
            trailColor={COLORS.border}
            showInfo={false}
            size="small"
          />
        </div>
      </div>
    );
  }

  // ==================== 未配置模式：仅显示曲线和设置提示 ====================
  if (!isConfigured) {
    return (
      <div style={{ 
        background: COLORS.bgSecondary, 
        borderRadius: 6, 
        padding: 16,
        border: `1px solid ${COLORS.border}`,
      }}>
        {/* 标题栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary }}>
              回撤风控
            </div>
            <span style={{ 
              fontSize: 10, 
              padding: '2px 6px', 
              borderRadius: 2, 
              background: COLORS.warningBg, 
              color: COLORS.warning,
              fontWeight: 500
            }}>
              未配置
            </span>
          </div>
        </div>

        {/* 设置提示卡片 */}
        <div style={{
          background: `linear-gradient(135deg, ${COLORS.brandBg} 0%, ${COLORS.bgTertiary} 100%)`,
          borderRadius: 8,
          padding: 20,
          marginBottom: 16,
          border: `1px solid ${COLORS.brand}30`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 8 }}>
            首次使用需要配置回撤规则
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
            设置您的初始资金、最大回撤限额、日内回撤限额等参数，<br/>
            系统将实时追踪您的回撤情况并发出预警。
          </div>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: COLORS.brand,
              color: '#000',
              border: 'none',
              borderRadius: 4,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            立即配置
          </button>
          <div style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 12 }}>
            暂不配置？下方可查看权益曲线
          </div>
        </div>

        {/* 简化版图表（仅显示权益曲线，不显示回撤限制线） */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: 12 
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary }}>
              权益曲线
            </div>
            <div style={{ fontSize: 11, color: COLORS.textTertiary }}>
              {trades.length} 笔交易
            </div>
          </div>
          {drawdownData.equityCurve.length > 0 ? (
            <ReactECharts 
              option={getSimpleChartOption()} 
              style={{ height: 320 }} 
            />
          ) : (
            <div style={{ 
              height: 320, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: COLORS.bgTertiary,
              borderRadius: 6,
              color: COLORS.textTertiary,
              fontSize: 12
            }}>
              暂无交易数据
            </div>
          )}
        </div>

        {/* 设置弹窗 */}
        {renderSettingsModal()}
      </div>
    );
  }

  // ==================== 完整模式 - 极简主义设计 ====================
  return (
    <div style={{ 
      background: 'transparent', 
      padding: 0,
    }}>
      {/* 爆仓警告横幅 - 保持极简 */}
      {isBreach && (
        <div style={{
          border: `1px solid ${COLORS.loss}`,
          borderRadius: 4,
          padding: '8px 16px',
          marginBottom: 24,
          textAlign: 'center',
          color: COLORS.loss,
          fontSize: 12,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontWeight: 600
        }}>
          ACCOUNT BREACHED · 账户已爆仓
        </div>
      )}

      {/* 核心指标 - 极简网格 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 24, 
        marginBottom: 40,
        opacity: isBreach ? 0.5 : 1,
      }}>
        {[
          { label: '当前权益', value: drawdownData.currentEquity, color: COLORS.textPrimary },
          { label: '最高水位', value: drawdownData.highWaterMark, color: COLORS.textSecondary },
          { label: '回撤底线', value: drawdownData.drawdownFloor, color: COLORS.textSecondary },
          { label: '剩余额度', value: drawdownData.remainingSpace, color: isBreach ? COLORS.loss : COLORS.textPrimary }
        ].map((item, idx) => (
          <div key={idx} style={{ borderLeft: `1px solid ${COLORS.border}`, paddingLeft: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textTertiary, marginBottom: 6 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: item.color, fontFamily: 'JetBrains Mono' }}>
              ${item.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* 回撤进度条 - 极简线条 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 48, 
        marginBottom: 40,
        opacity: isBreach ? 0.5 : 1,
      }}>
        {/* 总体回撤 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: COLORS.textTertiary }}>总体回撤</span>
            <span style={{ fontSize: 12, color: drawdownData.currentDrawdownPercent >= config.maxDrawdownPercent ? COLORS.loss : COLORS.textSecondary, fontFamily: 'JetBrains Mono' }}>
              {drawdownData.currentDrawdownPercent.toFixed(2)}% / {config.maxDrawdownPercent}%
            </span>
          </div>
          <div style={{ height: 3, background: COLORS.border, borderRadius: 2, position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              borderRadius: 2,
              width: `${Math.min(100, (drawdownData.currentDrawdownPercent / config.maxDrawdownPercent) * 100)}%`,
              background: drawdownData.currentDrawdownPercent >= config.maxDrawdownPercent ? COLORS.loss : COLORS.textPrimary,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* 日内回撤 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: COLORS.textTertiary }}>日内回撤</span>
            <span style={{ fontSize: 12, color: drawdownData.dailyDrawdown > drawdownData.dailyLimit ? COLORS.loss : COLORS.textSecondary, fontFamily: 'JetBrains Mono' }}>
              ${drawdownData.dailyDrawdown.toLocaleString()} / ${drawdownData.dailyLimit.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 3, background: COLORS.border, borderRadius: 2, position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              borderRadius: 2,
              width: `${Math.min(100, drawdownData.dailyDrawdownPercent)}%`,
              background: drawdownData.dailyDrawdown > drawdownData.dailyLimit ? COLORS.loss : COLORS.textPrimary,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* 权益曲线图表 */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: 500 }}>权益曲线分析</span>
            <Tooltip title="滚轮缩放波幅 · 按住拖拽平移 · Shift+滚轮横向缩放">
              <span style={{ 
                fontSize: 11, 
                color: COLORS.textTertiary,
                background: COLORS.bgTertiary,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'help'
              }}>
                拖拽平移 · 滚轮缩放
              </span>
            </Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: '累计盈亏', color: COLORS.brand },
                { label: '高水位', color: COLORS.profit },
                { label: '浮亏最低点', color: COLORS.loss, dashed: true },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: COLORS.textSecondary }}>
                  <span style={{ 
                    width: 14, 
                    height: 2, 
                    background: item.color,
                    borderStyle: item.dashed ? 'dashed' : 'solid',
                  }} />
                  {item.label}
                </div>
              ))}
            </div>
            <Tooltip title="全屏查看">
              <FullscreenOutlined 
                style={{ fontSize: 14, color: COLORS.textSecondary, cursor: 'pointer' }} 
                onClick={() => setIsFullscreen(true)}
              />
            </Tooltip>
          </div>
        </div>
        <ReactECharts 
          option={getChartOption()} 
          style={{ height: 520 }}
          opts={{ renderer: 'svg' }}
        />
      </div>

      {/* 全屏图表弹窗 - 遵循 DESIGN_SYSTEM.md */}
      <Modal
        open={isFullscreen}
        onCancel={() => setIsFullscreen(false)}
        footer={null}
        width="95vw"
        centered
        styles={{
          content: { 
            background: COLORS.bgSecondary, 
            border: `1px solid ${COLORS.border}`,
            padding: 16,
            borderRadius: 8
          },
          header: { 
            background: COLORS.bgSecondary, 
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 12,
            marginBottom: 16
          },
        }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 40 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary }}>权益曲线全屏分析</div>
              <div style={{ fontSize: 12, color: COLORS.textTertiary, marginTop: 4 }}>包含持仓浮亏的回撤追踪</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {['累计盈亏', '高水位', '回撤深度'].map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.textSecondary }}>
                  <span style={{ 
                    width: 12, height: 3, borderRadius: 2, 
                    background: i === 0 ? COLORS.brand : i === 1 ? COLORS.profit : COLORS.loss 
                  }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        }
        closeIcon={<FullscreenExitOutlined style={{ color: COLORS.textSecondary, fontSize: 16 }} />}
      >
        <div style={{ 
          background: COLORS.bgTertiary, 
          borderRadius: 6, 
          padding: 16,
          border: `1px solid ${COLORS.border}`,
        }}>
          <ReactECharts 
            option={{
              ...getChartOption(),
              grid: [
                { left: 60, right: 30, top: 50, height: '50%' },
                { left: 60, right: 30, top: '68%', height: '25%' },
              ],
              // 全屏模式增加垂直滑块
              dataZoom: [
                ...getChartOption().dataZoom || [],
                // 左侧垂直滑块（上图）
                {
                  type: 'slider',
                  yAxisIndex: [0],
                  left: 8,
                  width: 12,
                  top: 50,
                  bottom: '40%',
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.bgPrimary,
                  fillerColor: COLORS.brandBg,
                  handleStyle: { color: COLORS.brand, borderColor: COLORS.brand },
                  textStyle: { show: false },
                  filterMode: 'none',
                },
              ]
            }} 
            style={{ height: '70vh' }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      </Modal>

      {/* 设置弹窗 */}
      {renderSettingsModal()}
    </div>
  );
};

export default DrawdownTracker;
