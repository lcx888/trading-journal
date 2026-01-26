import { useState, useEffect } from 'react';
import { 
  ArrowRightOutlined,
  BarChartOutlined,
  RiseOutlined,
  MenuOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  AimOutlined,
  BulbOutlined,
  StarOutlined,
  RobotOutlined,
  ExperimentOutlined,
  AlertOutlined,
  DashboardOutlined,
  LineChartOutlined,
  HeartOutlined,
  FireOutlined,
  TrophyOutlined,
  QuestionCircleOutlined,
  BookOutlined,
  RightOutlined,
  DownOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  PieChartOutlined,
  FieldTimeOutlined,
  FundOutlined,
  WarningOutlined,
  SyncOutlined,
} from '@ant-design/icons';

// 导航栏
const Navbar = ({ onStart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0d0d10]/95 backdrop-blur-xl border-b border-[#1a1a1f]' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 rounded-lg object-cover" />
          <div>
            <span className="text-lg font-bold text-[#ffffff]">Metworth</span>
            <span className="text-lg font-bold text-[#c9a227]">AI</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-[#888] hover:text-[#c9a227] transition-colors">功能</a>
          <a href="#ai-coach" className="text-sm font-medium text-[#888] hover:text-[#c9a227] transition-colors">AI教练</a>
          <a href="#docs" className="text-sm font-medium text-[#888] hover:text-[#c9a227] transition-colors">文档</a>
          <a href="#faq" className="text-sm font-medium text-[#888] hover:text-[#c9a227] transition-colors">FAQ</a>
          <button onClick={onStart} className="text-sm font-medium text-[#888] hover:text-[#fff] transition-colors">
            登录
          </button>
          <button onClick={onStart} className="text-sm font-semibold bg-[#c9a227] text-[#0a0a0c] px-5 py-2 rounded hover:bg-[#d4af37] transition-all">
            免费开始
          </button>
        </div>

        <button className="md:hidden text-xl text-[#666]" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden bg-[#0d0d10] border-t border-[#1a1a1f] p-6 flex flex-col gap-4">
          <a href="#features" className="text-base font-medium text-[#888] hover:text-[#c9a227]">功能</a>
          <a href="#ai-coach" className="text-base font-medium text-[#888] hover:text-[#c9a227]">AI教练</a>
          <a href="#docs" className="text-base font-medium text-[#888] hover:text-[#c9a227]">文档</a>
          <a href="#faq" className="text-base font-medium text-[#888] hover:text-[#c9a227]">FAQ</a>
          <button onClick={onStart} className="w-full py-3 border border-[#1a1a1f] text-[#fff] rounded font-medium hover:border-[#c9a227]">登录</button>
          <button onClick={onStart} className="w-full py-3 bg-[#c9a227] text-[#0a0a0c] rounded font-semibold">免费开始</button>
        </div>
      )}
    </nav>
  );
};

// 模拟交易界面
const MockInterface = () => {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-12">
      <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1f]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#333]"></div>
            <div className="w-3 h-3 rounded-full bg-[#333]"></div>
            <div className="w-3 h-3 rounded-full bg-[#333]"></div>
          </div>
          <div className="text-xs text-[#555] font-mono">AI Trading Coach</div>
          <div className="w-16"></div>
        </div>
        
        <div className="p-5 grid grid-cols-4 gap-4">
          <div className="col-span-3 bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#888] font-medium">权益曲线</div>
              <div className="text-2xl font-bold text-[#c9a227] font-mono">+$24,580</div>
            </div>
            <div className="h-36 flex items-end justify-between gap-1">
              {[40, 50, 35, 60, 45, 70, 55, 80, 65, 90, 75, 85, 70, 95, 80, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-[#c9a227]/60 to-[#c9a227] rounded-t opacity-80" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-[#0a0a0c] rounded-lg p-3 border border-[#1a1a1f]">
              <div className="text-xs text-[#555] mb-1">胜率</div>
              <div className="text-xl font-bold text-[#fff] font-mono">68.5%</div>
            </div>
            <div className="bg-[#0a0a0c] rounded-lg p-3 border border-[#1a1a1f]">
              <div className="text-xs text-[#555] mb-1">R倍数</div>
              <div className="text-xl font-bold text-[#c9a227] font-mono">2.35R</div>
            </div>
            <div className="bg-[#0a0a0c] rounded-lg p-3 border border-[#1a1a1f]">
              <div className="text-xs text-[#555] mb-1">压力系数</div>
              <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-3 h-3 bg-[#c9a227] rounded-sm"></div>)}
                {[4,5].map(i => <div key={i} className="w-3 h-3 bg-[#222] rounded-sm"></div>)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-5 py-4 bg-[#0a0a0c] border-t border-[#1a1a1f]">
          <div className="flex items-center gap-2 mb-3">
            <RobotOutlined className="text-[#c9a227]" />
            <span className="text-sm font-medium text-[#888]">AI 智能诊断</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">✓ 执行果断</span>
            <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#c9a227] rounded border border-[#252528]">⚡ 提款机: 09:30-10:30</span>
            <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">📊 建议: 早出策略</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 功能卡片
const FeatureCard = ({ icon, title, description, isNew }) => (
  <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-6 hover:border-[#c9a227]/40 transition-all group relative">
    {isNew && (
      <div className="absolute top-4 right-4 text-[10px] px-1.5 py-0.5 bg-[#c9a227]/20 text-[#c9a227] rounded font-medium">NEW</div>
    )}
    <div className="w-11 h-11 rounded-lg bg-[#1a1a1f] flex items-center justify-center mb-4 group-hover:bg-[#c9a227]/10 transition-colors">
      <span className="text-xl text-[#c9a227]">{icon}</span>
    </div>
    <h3 className="text-base font-semibold text-[#fff] mb-2">{title}</h3>
    <p className="text-sm text-[#666] leading-relaxed">{description}</p>
  </div>
);

// AI 教练功能项
const AICoachItem = ({ icon, title, description }) => (
  <div className="flex gap-4 p-4 rounded-lg hover:bg-[#1a1a1f]/50 transition-all">
    <div className="w-9 h-9 rounded-lg bg-[#1a1a1f] flex items-center justify-center flex-shrink-0">
      <span className="text-lg text-[#c9a227]">{icon}</span>
    </div>
    <div>
      <h4 className="text-sm font-semibold text-[#fff] mb-1">{title}</h4>
      <p className="text-xs text-[#666] leading-relaxed">{description}</p>
    </div>
  </div>
);

// 文档卡片
const DocCard = ({ icon, title, description, items }) => (
  <div className="bg-[#111114] border border-[#1a1a1f] rounded-xl p-6 hover:border-[#c9a227]/30 transition-all">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-lg bg-[#1a1a1f] flex items-center justify-center">
        <span className="text-lg text-[#c9a227]">{icon}</span>
      </div>
      <div>
        <h3 className="text-base font-semibold text-[#fff]">{title}</h3>
        <p className="text-xs text-[#666]">{description}</p>
      </div>
    </div>
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm text-[#888] hover:text-[#c9a227] cursor-pointer transition-colors">
          <RightOutlined className="text-[10px] text-[#555]" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  </div>
);

// FAQ 项目
const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border-b border-[#1a1a1f] last:border-0">
    <button
      className="w-full py-5 flex items-center justify-between text-left hover:text-[#c9a227] transition-colors"
      onClick={onClick}
    >
      <span className="text-sm font-medium text-[#fff] pr-4">{question}</span>
      <span className={`text-[#666] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
        <DownOutlined />
      </span>
    </button>
    {isOpen && (
      <div className="pb-5 text-sm text-[#888] leading-relaxed whitespace-pre-line">
        {answer}
      </div>
    )}
  </div>
);

// 主页组件
const Home = ({ onStart }) => {
  const [openFAQ, setOpenFAQ] = useState(null);

  const features = [
    { icon: <RobotOutlined />, title: 'AI 智能诊断', description: '自动识别交易行为模式，诊断报复性交易、处置效应、执行焦虑等问题', isNew: true },
    { icon: <ExperimentOutlined />, title: '蒙特卡洛模拟', description: '基于历史数据进行 1000 次模拟，预测未来交易盈亏概率分布', isNew: true },
    { icon: <AimOutlined />, title: '最优止损预测', description: '回测不同止损位对总盈亏的影响，智能推荐最佳止损策略', isNew: true },
    { icon: <BarChartOutlined />, title: '期望值分布', description: '按时段、方向、品种分析期望值，找出提款机时段和碎钞机时段', isNew: true },
    { icon: <HeartOutlined />, title: '心理压力评分', description: '基于 MAE 深度和持仓时长，为每笔交易打出 1-5 级压力分', isNew: true },
    { icon: <DashboardOutlined />, title: 'R倍数追踪', description: '计算每笔交易的风险回报倍数，评估盈亏质量', isNew: true },
    { icon: <ThunderboltOutlined />, title: 'MAE/MFE 可视化', description: '直观展示每笔交易的波动区间，标注利润回吐区域' },
    { icon: <RiseOutlined />, title: '权益曲线分析', description: '可视化权益变化，自动标注关键节点和最大回撤' },
    { icon: <SafetyCertificateOutlined />, title: '风险管理', description: '全面的风险指标监控，帮助建立稳健的交易系统' },
  ];

  const aiCoachFeatures = [
    { icon: <AlertOutlined />, title: '报复性交易检测', description: '自动识别亏损后 5 分钟内的冲动交易' },
    { icon: <FireOutlined />, title: '利润留存率分析', description: '计算 (MFE - PnL) / MFE，识别严重的获利回吐' },
    { icon: <LineChartOutlined />, title: '处置效应诊断', description: '对比盈亏单持仓时长，检测过早止盈过晚止损' },
    { icon: <TrophyOutlined />, title: '行动建议生成', description: '基于诊断结果生成下周操作建议' },
  ];

  const steps = [
    { num: '01', title: '导入数据', desc: '支持 ATAS、Jigsaw 等' },
    { num: '02', title: 'AI 诊断', desc: '智能分析交易行为' },
    { num: '03', title: '获取洞察', desc: '生成优化建议' },
    { num: '04', title: '持续改进', desc: '追踪进步轨迹' },
  ];

  const docs = [
    {
      icon: <PlayCircleOutlined />,
      title: '快速开始',
      description: '5 分钟上手指南',
      items: ['注册与登录', '创建第一个账本', '导入交易数据', '查看分析报告']
    },
    {
      icon: <CloudUploadOutlined />,
      title: '数据导入',
      description: '多平台数据支持',
      items: ['Jigsaw 数据导入', 'ATAS 数据导入', 'CSV 格式说明', '数据字段映射']
    },
    {
      icon: <PieChartOutlined />,
      title: '数据分析',
      description: '深度理解您的交易',
      items: ['交易明细解读', '统计指标说明', '图表功能介绍', '筛选与导出']
    },
    {
      icon: <RobotOutlined />,
      title: 'AI 教练',
      description: '智能诊断系统',
      items: ['智能诊断功能', '蒙特卡洛模拟', '最优止损分析', '行为归因标签']
    },
  ];

  const faqs = [
    {
      question: 'MetworthAI 是什么？有什么用？',
      answer: `MetworthAI 是一款专为期货交易者设计的 AI 驱动交易复盘平台。

主要功能：
• 交易数据管理：支持多账本管理，自动解析 Jigsaw、ATAS 等主流交易软件导出的数据
• 多维度统计分析：按品种、时段、方向等维度分析您的交易表现
• AI 智能诊断：自动识别交易行为模式，发现潜在问题
• 策略优化建议：基于历史数据回测，提供最优止损、早出策略等建议

适用人群：期货日内交易者、订单流交易者、想要系统性提升交易水平的专业交易员`
    },
    {
      question: '支持哪些交易软件的数据导入？',
      answer: `目前支持以下交易软件的数据导入：

✅ Jigsaw Daytradr
• 支持 Trade Performance 报告导出的 CSV 文件
• 自动解析 MAE、MFE、Fills、持仓时间等高级字段

✅ ATAS
• 支持交易历史导出的标准格式
• 支持多品种、多账户数据

✅ 通用 CSV 格式
• 支持自定义字段映射
• 最低要求：开仓时间、品种、方向、数量、盈亏

即将支持：NinjaTrader、Sierra Chart、Bookmap 等`
    },
    {
      question: '什么是 MAE 和 MFE？为什么重要？',
      answer: `MAE（Maximum Adverse Excursion）最大逆向波动：
• 定义：持仓期间价格向不利方向移动的最大幅度
• 意义：反映您承受的最大浮亏，评估止损设置是否合理

MFE（Maximum Favorable Excursion）最大顺向波动：
• 定义：持仓期间价格向有利方向移动的最大幅度  
• 意义：反映您曾经触及的最大浮盈，评估止盈策略效果

为什么重要？
1. 评估执行质量：MFE 很大但实际盈利很小 = 存在利润回吐问题
2. 优化止损位：分析 MAE 分布，找到最优止损距离
3. 量化心理压力：MAE 越大，持仓期间心理压力越大
4. 改进入场时机：MAE 过大可能意味着入场位置不佳`
    },
    {
      question: 'AI 智能诊断是如何工作的？',
      answer: `AI 智能诊断系统通过分析您的历史交易数据，自动识别以下行为模式：

🔥 报复性交易检测
• 逻辑：检测亏损后 5 分钟内是否立即开新仓
• 意义：冲动交易往往导致连续亏损

⏳ 执行焦虑检测  
• 逻辑：检测成交次数（Fills）是否远大于计划数量
• 意义：频繁加减仓反映执行过程中的犹豫和焦虑

🎯 止损极点检测
• 逻辑：检测止损触发价是否接近 MAE 最低点
• 意义：经常在最低点止损说明止损位设置可能有问题

📊 处置效应诊断
• 逻辑：对比盈利单和亏损单的平均持仓时长
• 意义：如果亏损单持仓更久，说明存在"扛单"倾向

💰 利润留存率分析
• 公式：(MFE - max(0, PnL)) / MFE
• 意义：数值越高，说明利润回吐越严重`
    },
    {
      question: '什么是蒙特卡洛模拟？如何解读结果？',
      answer: `蒙特卡洛模拟是一种统计学方法，通过大量随机抽样来预测未来可能的结果。

在 MetworthAI 中的应用：
• 基于您的历史胜率和盈亏比
• 随机模拟未来 100 笔交易的结果
• 重复 1000 次模拟
• 统计盈利/亏损/持平的概率分布

如何解读：
• 盈利概率 > 60%：交易系统具有正期望值，可继续执行
• 盈利概率 50-60%：系统边际有效，需要优化
• 盈利概率 < 50%：系统可能存在问题，建议暂停并复盘

注意事项：
• 模拟基于历史数据，不代表未来一定会如此
• 样本量越大（交易越多），模拟结果越可靠
• 建议至少有 50 笔以上交易再进行模拟分析`
    },
    {
      question: '如何找到我的"提款机时段"？',
      answer: `"提款机时段"是指您历史表现最好的交易时间段。

查看方法：
1. 进入 AI 教练页面
2. 点击"开始分析"
3. 切换到"智能诊断"标签页
4. 查看"期望值分布"图表

期望值计算公式：
期望值 = (胜率 × 平均盈利) - (败率 × 平均亏损)

解读建议：
• 期望值 > 0 的时段：这是您的优势时段，可以加大投入
• 期望值 < 0 的时段：这是您的劣势时段，建议减少或避免交易
• 波动较大的时段：需要更严格的风险控制

常见发现：
• 大多数交易者在开盘前 30 分钟表现较差（情绪波动大）
• 午间时段交易量低，假突破多
• 收盘前可能存在结算压力`
    },
    {
      question: 'R倍数是什么？如何计算？',
      answer: `R倍数（R-Multiple）是衡量单笔交易风险回报比的指标。

计算公式：
R倍数 = 实际盈亏 / 初始风险（|MAE|）

举例说明：
• 您的 MAE 是 -$100（最大浮亏 $100）
• 最终盈利 $250
• R倍数 = 250 / 100 = 2.5R

如何解读：
• R > 2：优秀的交易，盈利是风险的 2 倍以上
• R = 1-2：良好的交易
• R = 0-1：盈利但风险回报一般
• R < 0：亏损交易

为什么使用 R倍数？
• 统一衡量标准：不同品种、不同金额的交易可以横向对比
• 评估交易质量：不仅看赚了多少，更看承担了多少风险
• 优化目标：追求高 R倍数交易，而非高频小利交易`
    },
    {
      question: '最优止损分析是如何计算的？',
      answer: `最优止损分析通过回测历史数据，模拟不同止损位对总盈亏的影响。

计算逻辑：
1. 设定一系列固定止损值（如 $50, $100, $150...）
2. 对每笔历史交易应用该止损值
3. 如果 MAE 超过止损值，则该笔交易以止损价平仓
4. 计算在该止损设置下的总盈亏
5. 找出使总盈亏最大化的止损值

结果解读：
• 最优止损值：使历史总盈亏最大化的止损距离
• 改善幅度：相比实际结果可能提升的金额
• 触发比例：该止损值会触发多少比例的交易

使用建议：
• 这是基于历史数据的回测，仅供参考
• 不同市场环境可能需要不同止损策略
• 建议结合 ATR 等波动率指标动态调整`
    },
    {
      question: '心理压力评分是如何计算的？',
      answer: `心理压力评分（1-5 级）基于交易过程中的客观数据评估主观压力。

计算因素：
1. MAE 深度：浮亏越大，压力越大
2. 持仓时间：持仓越久，累积压力越大
3. MAE 与 PnL 关系：如果最终止损，压力系数更高

评分标准：
⭐ 1级：MAE 较小，持仓时间短，顺利盈利离场
⭐⭐ 2级：有一定浮亏，但最终盈利
⭐⭐⭐ 3级：较大浮亏后回本或小盈
⭐⭐⭐⭐ 4级：经历大幅浮亏，长时间持仓
⭐⭐⭐⭐⭐ 5级：极端浮亏，最终止损离场

应用价值：
• 识别高压力交易模式
• 评估心理承受能力
• 优化持仓管理策略
• 预防过度交易和情绪化决策`
    },
    {
      question: '如何导入 Jigsaw Daytradr 的数据？',
      answer: `从 Jigsaw Daytradr 导出数据的步骤：

1. 打开 Jigsaw Daytradr
2. 进入 Trade Performance 模块
3. 选择要导出的日期范围
4. 点击 Export 按钮
5. 选择 CSV 格式保存

在 MetworthAI 中导入：
1. 登录后进入"数据" → "导入数据"
2. 选择目标账本（或创建新账本）
3. 选择"Jigsaw"作为数据来源
4. 上传 CSV 文件
5. 系统自动解析并导入

支持的字段：
• 基础字段：时间、品种、方向、数量、盈亏
• 高级字段：MAE、MFE、Fills、持仓时间、账户等

提示：
• 建议每日或每周定期导入
• 系统会自动去重，不用担心重复导入
• 导入后可在"交易明细"查看完整数据`
    },
    {
      question: '数据安全吗？会被泄露吗？',
      answer: `我们非常重视您的数据安全：

数据存储：
• 所有数据加密存储在云端服务器
• 使用 HTTPS 加密传输
• 服务器位于安全的数据中心

访问控制：
• 每个用户只能访问自己的数据
• 密码使用行业标准加密算法存储
• 支持邮箱验证增强账户安全

隐私承诺：
• 我们不会向任何第三方出售或分享您的交易数据
• 不会使用您的数据进行商业分析
• 您可以随时导出或删除自己的数据

建议：
• 使用强密码保护账户
• 定期更换密码
• 不要在公共设备上保存登录状态`
    },
    {
      question: '免费版和付费版有什么区别？',
      answer: `目前 MetworthAI 完全免费使用！

免费功能包括：
✅ 无限账本创建
✅ 无限交易数据导入
✅ 完整的统计分析功能
✅ AI 智能诊断系统
✅ 蒙特卡洛模拟
✅ 最优止损分析
✅ 行为归因标签
✅ 数据导出功能

未来可能的付费功能（规划中）：
• 实时数据同步
• 团队协作功能
• 高级报告定制
• API 接口调用
• 优先技术支持

我们的目标是让每位交易者都能免费使用核心功能，持续提升交易水平。`
    },
    {
      question: '遇到问题如何获取帮助？',
      answer: `如果您在使用过程中遇到任何问题：

自助解决：
1. 查看本页面的常见问题解答
2. 阅读使用文档和操作指南
3. 检查数据格式是否符合要求

联系我们：
• 发送邮件描述您的问题
• 提供截图或错误信息
• 我们会在 24 小时内回复

反馈建议：
• 我们欢迎任何功能建议和改进意见
• 您的反馈将帮助我们不断完善产品

常见问题自查：
• 导入失败 → 检查 CSV 文件格式是否正确
• 数据不显示 → 刷新页面或检查账本选择
• 分析结果异常 → 确认数据量是否足够（建议 50 笔以上）`
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Navbar onStart={onStart} />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1f] border border-[#252528] rounded-full mb-8">
            <StarOutlined className="text-[#c9a227]" />
            <span className="text-sm text-[#888] font-medium">全新升级 · AI 智能诊断系统</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-[#fff] mb-6 leading-tight">
            您的专属<span className="text-[#c9a227]"> AI 交易教练</span><br />
            <span className="text-[#888]">精准诊断 · 科学优化</span>
          </h1>
          
          <p className="text-lg text-[#666] mb-10 max-w-2xl mx-auto leading-relaxed">
            蒙特卡洛模拟预测未来风险，行为归因识别交易陋习，最优止损回测提升盈利能力。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onStart}
              className="inline-flex items-center justify-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-8 py-3 rounded-lg font-semibold hover:bg-[#d4af37] transition-all"
            >
              免费开始使用
              <ArrowRightOutlined />
            </button>
            <a 
              href="#docs"
              className="inline-flex items-center justify-center gap-2 border border-[#1a1a1f] text-[#888] px-8 py-3 rounded-lg font-medium hover:border-[#c9a227] hover:text-[#c9a227] transition-all"
            >
              查看文档
            </a>
          </div>
        </div>
        
        <MockInterface />
      </section>
      
      {/* 新功能亮点横幅 */}
      <section className="py-6 border-y border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {['智能诊断', '蒙特卡洛模拟', '最优止损', '压力评分', '期望值分析'].map((name, i) => (
              <div key={i} className="text-sm font-medium text-[#555]">{name}</div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#fff] mb-4">强大的分析能力</h2>
            <p className="text-[#666] max-w-xl mx-auto">全面的交易数据分析工具，帮助您成为更优秀的交易者</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* AI 教练专属区块 */}
      <section id="ai-coach" className="py-20 px-6 bg-[#0d0d10]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] border border-[#252528] rounded-full mb-6">
                <RobotOutlined className="text-[#c9a227]" />
                <span className="text-xs text-[#888] font-medium">AI 交易教练</span>
              </div>
              <h2 className="text-3xl font-bold text-[#fff] mb-4">智能诊断与决策支持</h2>
              <p className="text-[#666] mb-8 leading-relaxed">
                基于量化交易架构设计，专注于交易者行为分析与策略优化。
                通过回溯历史订单表现，自动识别交易模式并提供科学建议。
              </p>
              
              <div className="space-y-1">
                {aiCoachFeatures.map((f, i) => (
                  <AICoachItem key={i} {...f} />
                ))}
              </div>
              
              <button 
                onClick={onStart}
                className="mt-8 inline-flex items-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-6 py-3 rounded-lg font-semibold hover:bg-[#d4af37] transition-all"
              >
                体验 AI 教练
                <ArrowRightOutlined />
              </button>
            </div>
            
            {/* 诊断结果示例 */}
            <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-6">
              <div className="flex items-center gap-2 mb-6">
                <BulbOutlined className="text-[#c9a227]" />
                <span className="text-sm font-medium text-[#888]">诊断报告示例</span>
              </div>
              
              <div className="bg-[#0a0a0c] border border-[#1a1a1f] rounded-lg p-4 mb-4">
                <div className="text-xs text-[#c9a227] mb-1">下周操作建议</div>
                <div className="text-lg font-bold text-[#fff]">早出策略 · 减少持仓时间</div>
                <div className="text-xs text-[#555] mt-1">基于利润留存率分析，您的交易存在 23% 利润回吐</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">蒙特卡洛盈利概率</span>
                  <span className="text-sm font-bold text-[#c9a227]">72.3%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">最优止损建议</span>
                  <span className="text-sm font-bold text-[#fff]">-$180</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">平均压力系数</span>
                  <div className="flex gap-1">
                    {[1,2,3].map(i => <div key={i} className="w-2.5 h-2.5 bg-[#c9a227] rounded-sm"></div>)}
                    {[4,5].map(i => <div key={i} className="w-2.5 h-2.5 bg-[#222] rounded-sm"></div>)}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                  <span className="text-sm text-[#666]">提款机时段</span>
                  <span className="text-sm font-bold text-[#c9a227]">09:30 - 10:30</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-[#1a1a1f]">
                <div className="text-xs text-[#555] mb-2">检测到的行为模式</div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">报复性交易 2次</span>
                  <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#888] rounded border border-[#252528]">处置效应</span>
                  <span className="text-xs px-2.5 py-1 bg-[#1a1a1f] text-[#c9a227] rounded border border-[#252528]">执行果断</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Workflow Section */}
      <section id="workflow" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#fff] mb-4">简单四步，开始优化</h2>
            <p className="text-[#666]">从导入数据到获得洞察，一切如此简单</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-[#1a1a1f] border border-[#252528] flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-[#c9a227]">{step.num}</span>
                </div>
                <h3 className="text-base font-semibold text-[#fff] mb-1">{step.title}</h3>
                <p className="text-sm text-[#666]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 文档区块 */}
      <section id="docs" className="py-20 px-6 bg-[#0d0d10]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] border border-[#252528] rounded-full mb-6">
              <BookOutlined className="text-[#c9a227]" />
              <span className="text-xs text-[#888] font-medium">使用文档</span>
            </div>
            <h2 className="text-3xl font-bold text-[#fff] mb-4">快速上手指南</h2>
            <p className="text-[#666] max-w-xl mx-auto">详细的使用说明，帮助您充分发挥平台功能</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {docs.map((doc, i) => (
              <DocCard key={i} {...doc} />
            ))}
          </div>

          {/* 核心概念说明 */}
          <div className="mt-16 bg-[#111114] rounded-xl border border-[#1a1a1f] p-8">
            <h3 className="text-xl font-bold text-[#fff] mb-6 flex items-center gap-2">
              <FileTextOutlined className="text-[#c9a227]" />
              核心概念说明
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-[#c9a227] mb-2 flex items-center gap-2">
                    <FundOutlined /> MAE（最大逆向波动）
                  </h4>
                  <p className="text-sm text-[#888] leading-relaxed">
                    Maximum Adverse Excursion，指持仓期间价格向不利方向移动的最大幅度。
                    MAE 越大，说明您在该笔交易中承受的浮亏压力越大。通过分析 MAE 分布，可以优化止损策略。
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-[#c9a227] mb-2 flex items-center gap-2">
                    <FundOutlined /> MFE（最大顺向波动）
                  </h4>
                  <p className="text-sm text-[#888] leading-relaxed">
                    Maximum Favorable Excursion，指持仓期间价格向有利方向移动的最大幅度。
                    如果 MFE 很大但实际盈利较小，说明存在利润回吐问题，需要优化止盈策略。
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-[#c9a227] mb-2 flex items-center gap-2">
                    <DashboardOutlined /> R倍数
                  </h4>
                  <p className="text-sm text-[#888] leading-relaxed">
                    R-Multiple = 实际盈亏 / |MAE|。衡量每单位风险获得的回报。
                    R = 2 表示盈利是承担风险的 2 倍，是评估交易质量的重要指标。
                  </p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-[#c9a227] mb-2 flex items-center gap-2">
                    <PieChartOutlined /> 利润留存率
                  </h4>
                  <p className="text-sm text-[#888] leading-relaxed">
                    公式：(MFE - max(0, PnL)) / MFE。反映从最高盈利到平仓之间回吐了多少利润。
                    留存率越高，说明利润回吐越严重，需要改进止盈时机。
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-[#c9a227] mb-2 flex items-center gap-2">
                    <FieldTimeOutlined /> 期望值
                  </h4>
                  <p className="text-sm text-[#888] leading-relaxed">
                    期望值 = (胜率 × 平均盈利) - (败率 × 平均亏损)。
                    正期望值意味着长期交易会盈利，是评估交易系统有效性的核心指标。
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-[#c9a227] mb-2 flex items-center gap-2">
                    <WarningOutlined /> 处置效应
                  </h4>
                  <p className="text-sm text-[#888] leading-relaxed">
                    行为金融学概念：投资者倾向于过早卖出盈利仓位，过晚卖出亏损仓位。
                    表现为盈利单持仓时间短，亏损单持仓时间长。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ 区块 */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] border border-[#252528] rounded-full mb-6">
              <QuestionCircleOutlined className="text-[#c9a227]" />
              <span className="text-xs text-[#888] font-medium">常见问题</span>
            </div>
            <h2 className="text-3xl font-bold text-[#fff] mb-4">FAQ</h2>
            <p className="text-[#666]">关于 MetworthAI 的常见问题解答</p>
          </div>
          
          <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-6">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 数据支持标识 */}
      <section className="py-10 border-y border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-4">
            <span className="text-xs text-[#444]">支持主流交易软件数据导入</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {['ATAS', 'Jigsaw', 'NinjaTrader', 'CME', 'NQ · ES · GC'].map((name, i) => (
              <div key={i} className="text-base font-bold text-[#333] tracking-wider">{name}</div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-6 bg-[#0d0d10]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#fff] mb-6">准备好让 AI 教练帮您进步了吗？</h2>
          <p className="text-[#666] mb-10 text-lg">智能诊断 · 蒙特卡洛预测 · 最优止损 · 行为归因</p>
          <button 
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-10 py-4 rounded-lg font-semibold text-lg hover:bg-[#d4af37] transition-all"
          >
            立即免费开始
            <ArrowRightOutlined />
          </button>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-[#555]">
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 免费使用</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 无需信用卡</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 数据安全</span>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-md object-cover" />
            <span className="font-semibold text-[#fff]">MetworthAI</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#555]">
            <a href="#docs" className="hover:text-[#c9a227] transition-colors">文档</a>
            <a href="#faq" className="hover:text-[#c9a227] transition-colors">FAQ</a>
            <a href="#features" className="hover:text-[#c9a227] transition-colors">功能</a>
          </div>
          <div className="text-sm text-[#444]">© 2026 MetworthAI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
