# 🟡 MetworthAI 设计系统规范

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
  /* ========== 背景色 ========== */
  --bg-primary: #181A20;      /* 页面主背景 */
  --bg-secondary: #1E2026;    /* 卡片/模块背景 */
  --bg-tertiary: #2B3139;     /* 悬浮/选中/输入框背景 */
  --bg-hover: #363C47;        /* 悬浮高亮 */
  
  /* ========== 品牌色 ========== */
  --color-brand: #F0B90B;           /* 币安金 - 主品牌色 */
  --color-brand-light: #FCD535;     /* 品牌色浅 */
  --color-brand-dark: #C99400;      /* 品牌色深 */
  --color-brand-bg: rgba(240, 185, 11, 0.1); /* 品牌色背景 */
  
  /* ========== 盈亏语义色 ========== */
  --color-profit: #0ECB81;          /* 盈利/涨幅 - 绿色 */
  --color-profit-light: #2EE59D;    /* 盈利色浅 */
  --color-profit-bg: rgba(14, 203, 129, 0.1); /* 盈利背景 */
  
  --color-loss: #F6465D;            /* 亏损/跌幅 - 红色 */
  --color-loss-light: #FF707E;      /* 亏损色浅 */
  --color-loss-bg: rgba(246, 70, 93, 0.1); /* 亏损背景 */
  
  /* ========== 文字色 ========== */
  --text-primary: #EAECEF;    /* 主要文字 */
  --text-secondary: #848E9C;  /* 次要文字 */
  --text-tertiary: #5E6673;   /* 辅助文字 */
  --text-disabled: #474D57;   /* 禁用文字 */
  
  /* ========== 边框色 ========== */
  --border-primary: #2B3139;  /* 主边框 */
  --border-secondary: #363C47; /* 次边框/分割线 */
  --border-hover: #474D57;    /* 悬浮边框 */
  
  /* ========== 功能色 ========== */
  --color-info: #1E9EF5;      /* 信息蓝 */
  --color-warning: #F0B90B;   /* 警告黄 */
  --color-error: #F6465D;     /* 错误红 */
  --color-success: #0ECB81;   /* 成功绿 */
}
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
const BINANCE_CHART_THEME = {
  backgroundColor: 'transparent',
  
  // 文字样式
  textStyle: {
    color: '#848E9C',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
  },
  
  // 标题
  title: {
    textStyle: { color: '#EAECEF', fontSize: 16, fontWeight: 600 }
  },
  
  // 图例
  legend: {
    textStyle: { color: '#848E9C' }
  },
  
  // 提示框
  tooltip: {
    backgroundColor: '#1E2026',
    borderColor: '#2B3139',
    borderWidth: 1,
    textStyle: { color: '#EAECEF' },
    extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-radius: 4px;'
  },
  
  // 坐标轴
  xAxis: {
    axisLine: { lineStyle: { color: '#2B3139' } },
    axisLabel: { color: '#5E6673' },
    splitLine: { lineStyle: { color: '#2B3139', type: 'dashed' } }
  },
  
  yAxis: {
    axisLine: { show: false },
    axisLabel: { color: '#5E6673' },
    splitLine: { lineStyle: { color: '#2B3139', type: 'dashed' } }
  },
  
  // K线图颜色
  candlestick: {
    itemStyle: {
      color: '#0ECB81',        // 涨 - 实心绿
      color0: '#F6465D',       // 跌 - 实心红
      borderColor: '#0ECB81',  // 涨边框
      borderColor0: '#F6465D'  // 跌边框
    }
  },
  
  // 折线图颜色
  line: {
    itemStyle: { color: '#F0B90B' },
    lineStyle: { width: 2 }
  },
  
  // 柱状图颜色
  bar: {
    itemStyle: { borderRadius: [2, 2, 0, 0] }
  }
};

// 盈亏曲线配色
const EQUITY_CURVE_COLORS = {
  profit: {
    line: '#0ECB81',
    area: 'rgba(14, 203, 129, 0.1)'
  },
  loss: {
    line: '#F6465D',
    area: 'rgba(246, 70, 93, 0.1)'
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

---

## 开发检查清单

在开发每个页面/组件时，请确认：

- [ ] 使用 `--bg-primary` 作为页面背景
- [ ] 使用 `--bg-secondary` 作为卡片背景
- [ ] 盈利数据使用 `--color-profit` (#0ECB81)
- [ ] 亏损数据使用 `--color-loss` (#F6465D)
- [ ] 数字使用 `--font-mono` 等宽字体
- [ ] 按钮圆角为 4px
- [ ] 卡片圆角为 6px
- [ ] 避免使用阴影（仅弹出层使用）
- [ ] 表格行高紧凑（40-48px）
- [ ] 动画时长不超过 0.3s

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

---

> 📌 **重要提醒**：此设计规范适用于 MetworthAI 交易复盘平台的所有页面和组件。开发新功能时请严格遵循本规范，确保视觉一致性。
