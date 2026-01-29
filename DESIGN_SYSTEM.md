# 🟡 TradeWhy.AI 设计系统规范

> 基于币安（Binance）设计语言，专为交易复盘软件定制

---

## 目录

1. [设计理念](#设计理念)
2. [配色系统](#配色系统)
3. [字体系统](#字体系统)
4. [间距系统](#间距系统)
5. [圆角系统](#圆角系统)
6. [阴影系统](#阴影系统)
7. [组件规范](#组件规范)
8. [图表规范](#图表规范)
9. [动画规范](#动画规范)
10. [响应式规范](#响应式规范)

---

## 设计理念

### 核心原则

| 原则 | 描述 | 实现方式 |
|------|------|----------|
| 🌙 **深色优先** | 深色主题减少眼睛疲劳，适合长时间使用 | 使用 `#181A20` 作为主背景 |
| 📊 **数据密集** | 紧凑布局，单屏展示更多关键信息 | 减少留白，提高信息密度 |
| ⚡ **高对比度** | 关键数据突出显示，快速识别盈亏 | 盈亏色差明显，数值加粗 |
| 🔢 **等宽数字** | 数字使用等宽字体，便于对齐比较 | JetBrains Mono / Roboto Mono |
| 📱 **模块化** | 功能区域清晰分隔，互不干扰 | 卡片式布局，明确边界 |
| 🎯 **扁平极简** | 无多余装饰，功能导向 | 去除阴影渐变，纯色为主 |

### 设计DNA

```
专业 → 信任感 → 数据驱动 → 快速决策
```

---

## 配色系统

### 主色调

```css
:root {
  /* ========== 背景色（极深黑，沉浸式体验）========== */
  --bg-primary: #0a0a0c;      /* 页面主背景 - 极深黑 */
  --bg-secondary: #0d0d10;    /* 卡片/模块背景 */
  --bg-tertiary: #0f0f12;     /* 悬浮/选中/输入框背景 */
  --bg-hover: #1a1a1f;        /* 悬浮高亮 */
  
  /* ========== 品牌色（专业金）========== */
  --color-brand: #eab308;           /* 专业金 - 主品牌色 */
  --color-brand-light: #fbbf24;     /* 品牌色浅 */
  --color-brand-dark: #ca8a04;      /* 品牌色深 */
  --color-brand-bg: rgba(234, 179, 8, 0.1); /* 品牌色背景 */
  
  /* ========== 盈亏语义色 ========== */
  --color-profit: #10b981;          /* 盈利/涨幅 - 翡翠绿 */
  --color-profit-light: #34d399;    /* 盈利色浅 */
  --color-profit-bg: rgba(16, 185, 129, 0.1); /* 盈利背景 */
  
  --color-loss: #f43f5e;            /* 亏损/跌幅 - 玫瑰红 */
  --color-loss-light: #fb7185;      /* 亏损色浅 */
  --color-loss-bg: rgba(244, 63, 94, 0.1); /* 亏损背景 */
  
  /* ========== 文字色 ========== */
  --text-primary: #ffffff;    /* 主要文字 - 纯白 */
  --text-secondary: #9ca3af;  /* 次要文字 */
  --text-tertiary: #6b7280;   /* 辅助文字 */
  --text-disabled: #4b5563;   /* 禁用文字 */
  
  /* ========== 边框色 ========== */
  --border-primary: rgba(255, 255, 255, 0.05);  /* 主边框 - 极淡 */
  --border-secondary: rgba(255, 255, 255, 0.08); /* 次边框/分割线 */
  --border-hover: rgba(255, 255, 255, 0.12);    /* 悬浮边框 */
  
  /* ========== 功能色 ========== */
  --color-info: #3b82f6;      /* 信息蓝 */
  --color-warning: #eab308;   /* 警告黄 */
  --color-error: #f43f5e;     /* 错误红 */
  --color-success: #10b981;   /* 成功绿 */
}
```

### JavaScript 配色对象（用于 ECharts 等）

```javascript
const COLORS = {
  profit: '#10b981',
  profitBg: 'rgba(16, 185, 129, 0.1)',
  loss: '#f43f5e',
  lossBg: 'rgba(244, 63, 94, 0.1)',
  brand: '#eab308',
  brandBg: 'rgba(234, 179, 8, 0.1)',
  bgPrimary: '#0a0a0c',
  bgSecondary: '#0d0d10',
  bgTertiary: '#0f0f12',
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  border: 'rgba(255, 255, 255, 0.05)',
};
```

### 配色使用规则

| 场景 | 推荐配色 | 禁止 |
|------|----------|------|
| 页面背景 | `--bg-primary` | 不使用纯黑 #000 |
| 卡片背景 | `--bg-secondary` | 不使用白色 |
| 盈利数据 | `--color-profit` | 不使用其他绿色 |
| 亏损数据 | `--color-loss` | 不使用其他红色 |
| 主按钮 | `--color-brand` | 不使用渐变 |
| 普通文字 | `--text-primary` | 不使用纯白 #FFF |

---

## 字体系统

### 字体家族

```css
:root {
  /* 主字体 - 界面文字 */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 
                 'Helvetica Neue', Helvetica, Arial, sans-serif;
  
  /* 数字字体 - 等宽对齐 */
  --font-mono: 'JetBrains Mono', 'Roboto Mono', 'SF Mono', 
               'Fira Code', 'Consolas', monospace;
}
```

### 字号规范

| 级别 | 字号 | 行高 | 字重 | 用途 |
|------|------|------|------|------|
| Display | 32px | 1.2 | 700 | 核心数据（今日盈亏） |
| H1 | 24px | 1.3 | 600 | 页面标题 |
| H2 | 20px | 1.4 | 600 | 卡片标题 |
| H3 | 16px | 1.4 | 600 | 模块标题 |
| Body | 14px | 1.5 | 400 | 正文内容 |
| Caption | 12px | 1.5 | 400 | 辅助说明 |
| Tiny | 10px | 1.4 | 500 | 标签/角标 |

### 数字显示规范

```css
/* 所有数值必须使用等宽字体 */
.number, .price, .pnl, .percentage {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
}

/* 盈亏数值 */
.pnl-profit { color: var(--color-profit); }
.pnl-loss { color: var(--color-loss); }

/* 价格变动 */
.change-up { color: var(--color-profit); }
.change-down { color: var(--color-loss); }
```

---

## 间距系统

### 基础单位

```css
:root {
  --spacing-unit: 4px;
  
  --spacing-xs: 4px;   /* 0.25rem */
  --spacing-sm: 8px;   /* 0.5rem */
  --spacing-md: 12px;  /* 0.75rem */
  --spacing-lg: 16px;  /* 1rem */
  --spacing-xl: 24px;  /* 1.5rem */
  --spacing-2xl: 32px; /* 2rem */
  --spacing-3xl: 48px; /* 3rem */
}
```

### 间距使用规则

| 场景 | 间距 | 说明 |
|------|------|------|
| 页面内边距 | `--spacing-xl` (24px) | 页面容器内边距 |
| 卡片内边距 | `--spacing-lg` (16px) | 卡片内部留白 |
| 卡片间距 | `--spacing-lg` (16px) | 卡片之间的间隔 |
| 表单项间距 | `--spacing-md` (12px) | 表单元素之间 |
| 紧凑模式 | `--spacing-sm` (8px) | 数据密集区域 |

---

## 圆角系统

```css
:root {
  --radius-xs: 2px;   /* 小标签 */
  --radius-sm: 4px;   /* 按钮、输入框 */
  --radius-md: 6px;   /* 卡片、模态框 */
  --radius-lg: 8px;   /* 大卡片 */
  --radius-xl: 12px;  /* 特殊容器 */
  --radius-full: 9999px; /* 圆形/胶囊 */
}
```

### 圆角使用规则

| 组件 | 圆角 |
|------|------|
| 按钮 | `--radius-sm` (4px) |
| 输入框 | `--radius-sm` (4px) |
| 卡片 | `--radius-md` (6px) |
| 模态框 | `--radius-lg` (8px) |
| 标签 | `--radius-xs` (2px) |
| 头像 | `--radius-full` |

---

## 阴影系统

> ⚠️ 币安风格倾向于**极简无阴影**，主要通过边框和背景色区分层级

```css
:root {
  /* 极少使用阴影，仅用于弹出层 */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.3);
  
  /* 弹出层阴影 */
  --shadow-dropdown: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-modal: 0 8px 40px rgba(0, 0, 0, 0.5);
}
```

---

## 组件规范

### 按钮

```css
/* 主按钮 - 品牌金色 */
.btn-primary {
  background: var(--color-brand);
  color: #181A20;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 500;
  padding: 10px 16px;
  transition: opacity 0.2s;
}
.btn-primary:hover { opacity: 0.85; }

/* 次按钮 - 透明边框 */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
}
.btn-secondary:hover {
  border-color: var(--color-brand);
  color: var(--color-brand);
}

/* 危险按钮 */
.btn-danger {
  background: var(--color-loss);
  color: #FFFFFF;
}

/* 成功按钮 */
.btn-success {
  background: var(--color-profit);
  color: #FFFFFF;
}
```

### 卡片

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
}

/* 无边框卡片 */
.card-borderless {
  background: var(--bg-secondary);
  border: none;
}

/* 悬浮效果（可选） */
.card-hoverable:hover {
  border-color: var(--border-hover);
}
```

### 表格

```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-primary);
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-primary);
  font-size: 14px;
}

/* 斑马纹 */
.table tr:nth-child(even) {
  background: rgba(43, 49, 57, 0.3);
}

/* 悬浮行 */
.table tr:hover {
  background: var(--bg-tertiary);
}
```

### 输入框

```css
.input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input::placeholder {
  color: var(--text-tertiary);
}

.input:hover {
  border-color: var(--border-hover);
}

.input:focus {
  border-color: var(--color-brand);
  outline: none;
}
```

### 标签

```css
/* 默认标签 */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-xs);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

/* 盈利标签 */
.tag-profit {
  background: var(--color-profit-bg);
  color: var(--color-profit);
}

/* 亏损标签 */
.tag-loss {
  background: var(--color-loss-bg);
  color: var(--color-loss);
}

/* 品牌标签 */
.tag-brand {
  background: var(--color-brand-bg);
  color: var(--color-brand);
}
```

---

## 图表规范

### ECharts 主题配置

```javascript
const TRADEWHY_CHART_THEME = {
  backgroundColor: 'transparent',
  
  // 文字样式
  textStyle: {
    color: '#9ca3af',
    fontFamily: 'JetBrains Mono, -apple-system, BlinkMacSystemFont, sans-serif'
  },
  
  // 标题
  title: {
    textStyle: { color: '#ffffff', fontSize: 16, fontWeight: 600 }
  },
  
  // 图例
  legend: {
    textStyle: { color: '#9ca3af' }
  },
  
  // 提示框
  tooltip: {
    backgroundColor: '#0d0d10',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    textStyle: { 
      color: '#ffffff',
      fontFamily: 'JetBrains Mono, monospace'
    },
    extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.5); border-radius: 4px;'
  },
  
  // 坐标轴
  xAxis: {
    axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
    axisLabel: { color: '#6b7280', fontSize: 10, fontFamily: 'JetBrains Mono' },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } }
  },
  
  yAxis: {
    axisLine: { show: false },
    axisLabel: { color: '#6b7280', fontSize: 10, fontFamily: 'JetBrains Mono' },
    splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } }
  },
  
  // K线图颜色
  candlestick: {
    itemStyle: {
      color: '#10b981',        // 涨 - 翡翠绿
      color0: '#f43f5e',       // 跌 - 玫瑰红
      borderColor: '#10b981',
      borderColor0: '#f43f5e'
    }
  },
  
  // 折线图颜色
  line: {
    itemStyle: { color: '#eab308' },
    lineStyle: { width: 2 },
    smooth: 0.3,
    symbol: 'none'
  },
  
  // 柱状图颜色
  bar: {
    itemStyle: { borderRadius: [2, 2, 0, 0] },
    barWidth: '50%'
  }
};

// 盈亏曲线配色（动态切换）
const EQUITY_CURVE_COLORS = {
  profit: {
    line: '#10b981',
    area: 'rgba(16, 185, 129, 0.3)',      // 30% 透明度起始
    areaEnd: 'rgba(16, 185, 129, 0)'      // 0% 透明度结束
  },
  loss: {
    line: '#f43f5e',
    area: 'rgba(244, 63, 94, 0.3)',
    areaEnd: 'rgba(244, 63, 94, 0)'
  }
};

// 权益曲线颜色应根据累计盈亏动态切换
// 示例：
// const lineColor = cumPnL >= 0 ? EQUITY_CURVE_COLORS.profit.line : EQUITY_CURVE_COLORS.loss.line;
```

### 标记点 (Mark Points) 规范

```javascript
// 最高点标记
const maxPointStyle = {
  symbol: 'circle',
  symbolSize: 10,
  itemStyle: { 
    color: '#10b981', // profit color
    borderColor: '#0d0d10', 
    borderWidth: 2 
  },
  label: {
    show: true,
    position: 'top',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
    backgroundColor: '#0f0f12',
    padding: [2, 6],
    borderRadius: 2
  }
};

// 最低点标记
const minPointStyle = {
  symbol: 'circle',
  symbolSize: 10,
  itemStyle: { 
    color: '#f43f5e', // loss color
    borderColor: '#0d0d10', 
    borderWidth: 2 
  },
  label: {
    show: true,
    position: 'bottom',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#f43f5e',
    backgroundColor: '#0f0f12',
    padding: [2, 6],
    borderRadius: 2
  }
};
```

---

## 动画规范

### 过渡时间

```css
:root {
  --transition-fast: 0.1s;
  --transition-normal: 0.2s;
  --transition-slow: 0.3s;
  --transition-easing: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 常用动画

```css
/* 淡入 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 淡入上移 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 脉冲（实时数据更新） */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 数字滚动 */
@keyframes countUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 动画使用原则

| 场景 | 动画 | 时长 |
|------|------|------|
| 页面切换 | fadeInUp | 0.3s |
| 数据更新 | countUp | 0.2s |
| 悬浮效果 | 无动画 | - |
| 加载状态 | pulse | 1.5s infinite |
| 弹出层 | fadeIn | 0.2s |

> ⚠️ 币安风格倾向于**极简动效**，避免过度动画影响数据查看

---

## 页面布局规范

### 统一页面容器

所有内容页面**必须**使用以下统一的容器规范：

```jsx
// 标准页面容器
<div className="max-w-[1600px] mx-auto p-6 space-y-6">
  {/* 页面内容 */}
</div>
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 最大宽度 | `max-w-[1600px]` | 所有页面统一 |
| 水平居中 | `mx-auto` | 左右自动边距 |
| 内边距 | `p-6` (24px) | 页面四周留白 |
| 模块间距 | `space-y-6` (24px) | 模块垂直间距 |

### 页面标题规范

```jsx
// 标准页面标题
<div className="mb-6">
  <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)]">
    页面标题
  </h1>
  <p className="text-sm text-[var(--text-tertiary)] mt-1">
    页面副标题或说明
  </p>
</div>
```

| 元素 | 样式 |
|------|------|
| 主标题 | `text-2xl font-medium tracking-tight` |
| 副标题 | `text-sm text-[var(--text-tertiary)]` |
| 标题间距 | `mb-6` |

### 卡片标题规范

```jsx
// 标准卡片标题
<h2 className="text-base font-medium text-[var(--text-primary)] mb-4">
  卡片标题
</h2>
```

| 元素 | 样式 |
|------|------|
| 卡片标题 | `text-base font-medium` |
| 标题间距 | `mb-4` |

### 最小宽度保护

为防止小屏幕布局错乱，添加最小宽度限制：

```css
/* 添加到 index.css */
.main-content {
  min-width: 320px;
}

@media (max-width: 768px) {
  .page-container {
    padding: 16px;
  }
}
```

---

## 响应式规范

### 断点

```css
:root {
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 992px;
  --breakpoint-xl: 1200px;
  --breakpoint-2xl: 1400px;
}
```

### 响应式规则

| 断点 | 设备 | 布局调整 |
|------|------|----------|
| < 576px | 手机 | 单列布局，隐藏次要信息 |
| 576-768px | 平板竖屏 | 两列布局 |
| 768-992px | 平板横屏 | 三列布局 |
| 992-1200px | 笔记本 | 四列布局 |
| > 1200px | 桌面 | 完整布局 |

### 响应式实现

```jsx
// Grid 响应式布局示例
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* 内容 */}
</div>

// Flex 响应式布局示例  
<div className="flex flex-col md:flex-row gap-4">
  {/* 内容 */}
</div>
```

### 小屏幕适配规则

1. **隐藏次要元素**：使用 `hidden md:block` 在小屏幕隐藏
2. **文字截断**：长文本使用 `truncate` 或 `line-clamp-2`
3. **弹性布局**：优先使用 `flex-wrap` 允许换行
4. **触控优化**：按钮最小高度 `min-h-[44px]` 满足触控

---

## 总览页面专属规范

### 交易指挥中心 (Command Center)

总览页面顶部的核心模块，整合身份信息、职业进度和风险状态。

```jsx
/* 容器样式 */
.command-center {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 12px; /* rounded-xl */
  padding: 32px; /* p-8 */
  position: relative;
  overflow: hidden;
}

/* 背景微光装饰 */
.command-center::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 500px;
  height: 500px;
  background: var(--color-brand);
  opacity: 0.03;
  filter: blur(120px);
  margin-right: -192px;
  margin-top: -192px;
  pointer-events: none;
}
```

### 职业生涯进度条 (Career Roadmap)

```jsx
/* 进度条节点 */
.roadmap-node {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: all 0.5s ease;
}

/* 已达成节点 */
.roadmap-node.reached {
  background: var(--color-brand);
  border-color: var(--color-brand);
  transform: scale(1.25);
  box-shadow: 0 0 8px var(--color-brand);
}

/* 未达成节点 */
.roadmap-node.pending {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
}

/* 进度线 */
.roadmap-progress {
  height: 1px;
  background: var(--color-brand);
  box-shadow: 0 0 8px var(--color-brand);
  transition: width 1s ease;
}

/* 等级标签 */
.level-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: bold;
}
```

### 统计指标项 (StatItem)

极简主义的核心指标展示组件。

```jsx
/* 指标项容器 */
.stat-item {
  flex: 1;
  border-left: 1px solid var(--border-primary);
  padding-left: 24px; /* pl-6 */
  padding-top: 8px;
  padding-bottom: 8px;
}

/* 标签样式 */
.stat-item-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em; /* tracking-wider */
  margin-bottom: 8px;
}

/* 数值样式 */
.stat-item-value {
  font-size: 24px; /* text-2xl */
  font-weight: 300; /* font-light */
  letter-spacing: -0.025em; /* tracking-tight */
  color: var(--text-primary);
  font-family: var(--font-mono);
}

/* 副标题样式 */
.stat-item-sub {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 4px;
}
```

### 快速筛选标签 (Quick Filter Tags)

```jsx
/* 筛选器容器 */
.quick-filter-container {
  display: flex;
  gap: 4px;
  background: var(--bg-tertiary);
  padding: 2px;
  border-radius: 4px;
}

/* 筛选按钮 - 默认 */
.quick-filter-btn {
  padding: 4px 12px;
  font-size: 10px;
  border-radius: 4px;
  color: var(--text-tertiary);
  transition: all 0.2s ease;
}

/* 筛选按钮 - 激活 */
.quick-filter-btn.active {
  background: var(--color-brand);
  color: #000000;
  font-weight: bold;
}
```

### 动态金句系统

```jsx
/* 金句容器 */
.quote-container {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 300; /* font-light */
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 脉冲指示点 */
.quote-pulse {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-brand);
  animation: pulse 2s infinite;
}

/* 金句文本 */
.quote-text {
  font-style: italic;
}
```

### 控制中枢 (Filter Bar)

```jsx
/* 筛选器条 */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  background: rgba(13, 13, 16, 0.5); /* bg-secondary/50 */
  padding: 12px 24px;
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}

/* 分隔线 */
.filter-divider {
  height: 12px;
  width: 1px;
  background: var(--border-primary);
}
```

---

## 开发检查清单

在开发每个页面/组件时，请确认：

### 颜色规范
- [ ] 使用 `--bg-primary` (#0a0a0c) 作为页面背景
- [ ] 使用 `--bg-secondary` (#0d0d10) 作为卡片背景
- [ ] 盈利数据使用 `--color-profit` (#10b981)
- [ ] 亏损数据使用 `--color-loss` (#f43f5e)
- [ ] 品牌强调使用 `--color-brand` (#eab308)
- [ ] 边框使用 `rgba(255, 255, 255, 0.05)` 极淡白色

### 字体规范
- [ ] 数字使用 `font-mono` (JetBrains Mono) 等宽字体
- [ ] 大数值标题使用 `font-light` (font-weight: 300)
- [ ] 标签使用 `uppercase tracking-widest text-[10px]`
- [ ] 数值字号为 `text-2xl` (24px)

### 布局规范
- [ ] 页面最大宽度 `max-w-[1600px]`
- [ ] 卡片内边距 `p-6` (24px) 或 `p-8` (32px)
- [ ] 模块间距 `space-y-6` (24px)
- [ ] 使用 `border-l` 左边框作为指标项分隔

### 组件规范
- [ ] 按钮圆角为 4px
- [ ] 卡片圆角为 6px，大容器为 12px (rounded-xl)
- [ ] 避免使用阴影（仅品牌元素使用光晕 shadow-[0_0_8px]）
- [ ] 动画时长不超过 0.3s
- [ ] 脉冲动画使用 `animate-pulse`

### 图表规范
- [ ] 图表背景透明 `backgroundColor: 'transparent'`
- [ ] 盈利曲线使用 `#10b981`，亏损曲线使用 `#f43f5e`
- [ ] 曲线根据累计盈亏状态动态切换颜色
- [ ] 渐变填充透明度为 30% → 0%
- [ ] Y 轴标签使用等宽字体

---

## 示例代码

### React 组件示例

```jsx
// 盈亏数值组件
const PnLValue = ({ value }) => (
  <span 
    className="font-mono font-bold"
    style={{ 
      color: value >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
    }}
  >
    {value >= 0 ? '+' : ''}{value.toLocaleString()}
  </span>
);

// 统计卡片组件
const StatCard = ({ label, value, change }) => (
  <div className="card">
    <div className="text-secondary text-xs uppercase tracking-wider mb-2">
      {label}
    </div>
    <div className="text-2xl font-bold font-mono text-primary">
      {value}
    </div>
    {change && (
      <div className={`text-sm font-mono ${change >= 0 ? 'text-profit' : 'text-loss'}`}>
        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
      </div>
    )}
  </div>
);
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-01-24 | 初版发布，基于币安设计语言 |
| v1.1 | 2026-01-29 | 更新配色系统为极深黑主题；新增总览页面专属规范；新增交易指挥中心、职业生涯进度条、统计指标项、快速筛选标签、动态金句系统等组件规范 |

---

> 📌 **重要提醒**：此设计规范适用于 TradeWhy.AI 交易复盘平台的所有页面和组件。开发新功能时请严格遵循本规范，确保视觉一致性。
