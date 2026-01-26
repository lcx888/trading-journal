import { useState } from 'react';
import { 
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  DownOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  PieChartOutlined,
  FieldTimeOutlined,
  FundOutlined,
  WarningOutlined,
  RobotOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  AimOutlined,
  BarChartOutlined,
  LineChartOutlined,
  AlertOutlined,
  ExperimentOutlined,
  HeartOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  SettingOutlined,
  UserOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';

// FAQ 项目组件
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

// 文档卡片组件
const DocCard = ({ icon, title, description, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-4 rounded-lg border transition-all ${
      isActive 
        ? 'bg-[#c9a227]/10 border-[#c9a227]/40' 
        : 'bg-[#111114] border-[#1a1a1f] hover:border-[#c9a227]/30'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
        isActive ? 'bg-[#c9a227]/20' : 'bg-[#1a1a1f]'
      }`}>
        <span className="text-lg text-[#c9a227]">{icon}</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#fff]">{title}</h3>
        <p className="text-xs text-[#666]">{description}</p>
      </div>
    </div>
  </button>
);

// 文档区块组件
const DocSection = ({ icon, title, children }) => (
  <div className="mb-12">
    <h2 className="text-xl font-bold text-[#fff] mb-6 flex items-center gap-3">
      <span className="text-[#c9a227]">{icon}</span>
      {title}
    </h2>
    {children}
  </div>
);

// 文档条目组件
const DocItem = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-base font-semibold text-[#c9a227] mb-3">{title}</h3>
    <div className="text-sm text-[#888] leading-relaxed space-y-3">
      {children}
    </div>
  </div>
);

// 步骤组件
const StepList = ({ steps }) => (
  <div className="space-y-3">
    {steps.map((step, i) => (
      <div key={i} className="flex gap-3">
        <div className="w-6 h-6 rounded-full bg-[#c9a227]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-[#c9a227]">{i + 1}</span>
        </div>
        <div className="text-sm text-[#888]">{step}</div>
      </div>
    ))}
  </div>
);

// 提示框组件
const Tip = ({ type = 'info', children }) => {
  const styles = {
    info: 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#60a5fa]',
    warning: 'bg-[#eab308]/10 border-[#eab308]/30 text-[#facc15]',
    success: 'bg-[#10b981]/10 border-[#10b981]/30 text-[#34d399]',
  };
  
  return (
    <div className={`p-4 rounded-lg border ${styles[type]} text-sm`}>
      {children}
    </div>
  );
};

// 主文档页面
const Docs = ({ onBack, onStart }) => {
  const [activeSection, setActiveSection] = useState('quickstart');
  const [openFAQ, setOpenFAQ] = useState(null);

  const sections = [
    { key: 'quickstart', icon: <PlayCircleOutlined />, title: '快速开始', description: '5 分钟上手' },
    { key: 'import', icon: <CloudUploadOutlined />, title: '数据导入', description: '多平台支持' },
    { key: 'analysis', icon: <PieChartOutlined />, title: '数据分析', description: '统计与图表' },
    { key: 'ai-coach', icon: <RobotOutlined />, title: 'AI 教练', description: '智能诊断' },
    { key: 'concepts', icon: <BookOutlined />, title: '核心概念', description: '术语解释' },
    { key: 'faq', icon: <QuestionCircleOutlined />, title: '常见问题', description: 'FAQ' },
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

  const renderContent = () => {
    switch (activeSection) {
      case 'quickstart':
        return (
          <>
            <DocSection icon={<PlayCircleOutlined />} title="快速开始">
              <DocItem title="1. 注册账号">
                <p>访问 MetworthAI 官网，点击"免费开始"按钮进行注册。</p>
                <StepList steps={[
                  '输入您的邮箱地址',
                  '设置登录密码（建议使用强密码）',
                  '点击"注册"完成账号创建',
                  '登录后即可开始使用',
                ]} />
                <Tip type="info">
                  注册后建议完成邮箱验证，以便使用密码找回等功能。
                </Tip>
              </DocItem>

              <DocItem title="2. 创建账本">
                <p>账本是管理交易数据的基本单位，您可以为不同账户或策略创建独立账本。</p>
                <StepList steps={[
                  '进入"数据" → "账本管理"',
                  '点击"新建账本"按钮',
                  '输入账本名称（如"主账户"、"日内策略"等）',
                  '点击确认创建',
                ]} />
                <Tip type="success">
                  您可以创建多个账本来区分不同的交易账户或策略，便于独立分析。
                </Tip>
              </DocItem>

              <DocItem title="3. 导入交易数据">
                <p>从您的交易软件导出数据，然后导入到 MetworthAI 进行分析。</p>
                <StepList steps={[
                  '从 Jigsaw/ATAS 等软件导出 CSV 格式交易记录',
                  '进入"数据" → "导入数据"',
                  '选择目标账本',
                  '选择数据来源类型',
                  '上传 CSV 文件',
                  '系统自动解析并导入',
                ]} />
              </DocItem>

              <DocItem title="4. 查看分析报告">
                <p>数据导入后，即可使用丰富的分析功能。</p>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">📊 总览</div>
                    <p className="text-xs">查看整体交易表现、权益曲线、关键指标</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">📋 交易明细</div>
                    <p className="text-xs">查看每笔交易详情、筛选、导出</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">🤖 AI 教练</div>
                    <p className="text-xs">智能诊断、行为分析、优化建议</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">📅 交易日历</div>
                    <p className="text-xs">按日期查看交易记录和盈亏</p>
                  </div>
                </div>
              </DocItem>
            </DocSection>
          </>
        );

      case 'import':
        return (
          <>
            <DocSection icon={<CloudUploadOutlined />} title="数据导入">
              <DocItem title="Jigsaw Daytradr 数据导入">
                <p>Jigsaw 是专业的订单流交易软件，导出的数据包含丰富的 MAE/MFE 信息。</p>
                
                <h4 className="text-sm font-semibold text-[#fff] mt-4 mb-2">从 Jigsaw 导出数据：</h4>
                <StepList steps={[
                  '打开 Jigsaw Daytradr',
                  '进入 Trade Performance 模块',
                  '选择要导出的日期范围',
                  '点击 Export 按钮',
                  '选择 CSV 格式保存到本地',
                ]} />

                <h4 className="text-sm font-semibold text-[#fff] mt-4 mb-2">在 MetworthAI 中导入：</h4>
                <StepList steps={[
                  '登录后进入"数据" → "导入数据"',
                  '选择目标账本',
                  '数据来源选择"Jigsaw"',
                  '点击上传区域或拖拽 CSV 文件',
                  '确认字段映射无误',
                  '点击"导入"完成',
                ]} />

                <Tip type="info">
                  Jigsaw 数据包含：时间、品种、方向、数量、盈亏、MAE、MFE、Fills、持仓时间等字段，系统会自动解析。
                </Tip>
              </DocItem>

              <DocItem title="ATAS 数据导入">
                <p>ATAS 是另一款流行的订单流分析软件。</p>
                <StepList steps={[
                  '在 ATAS 中打开交易历史',
                  '选择日期范围',
                  '导出为 CSV 格式',
                  '在 MetworthAI 中选择"ATAS"作为数据来源',
                  '上传文件完成导入',
                ]} />
              </DocItem>

              <DocItem title="通用 CSV 格式">
                <p>如果您使用其他交易软件，可以使用通用 CSV 格式导入。</p>
                
                <h4 className="text-sm font-semibold text-[#fff] mt-4 mb-2">必需字段：</h4>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] font-mono text-xs">
                  <div className="text-[#c9a227]">Open Time</div>
                  <div className="text-[#888]">开仓时间，格式：YYYY-MM-DD HH:mm:ss</div>
                  <div className="text-[#c9a227] mt-2">Instrument</div>
                  <div className="text-[#888]">品种代码，如 NQ、ES、GC</div>
                  <div className="text-[#c9a227] mt-2">Side / Direction</div>
                  <div className="text-[#888]">方向，Long/Short 或 Buy/Sell</div>
                  <div className="text-[#c9a227] mt-2">Quantity</div>
                  <div className="text-[#888]">数量</div>
                  <div className="text-[#c9a227] mt-2">PnL / Profit</div>
                  <div className="text-[#888]">盈亏金额</div>
                </div>

                <h4 className="text-sm font-semibold text-[#fff] mt-4 mb-2">可选字段（增强分析）：</h4>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-[#c9a227]">MAE</span> - 最大逆向波动</div>
                    <div><span className="text-[#c9a227]">MFE</span> - 最大顺向波动</div>
                    <div><span className="text-[#c9a227]">Fills</span> - 成交次数</div>
                    <div><span className="text-[#c9a227]">Time In</span> - 持仓时间</div>
                    <div><span className="text-[#c9a227]">Close Time</span> - 平仓时间</div>
                    <div><span className="text-[#c9a227]">Account</span> - 账户</div>
                  </div>
                </div>
              </DocItem>

              <DocItem title="数据去重机制">
                <p>系统会自动检测并跳过重复的交易记录，判断依据：</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>相同的开仓时间</li>
                  <li>相同的品种</li>
                  <li>相同的方向</li>
                  <li>相同的盈亏金额</li>
                </ul>
                <Tip type="success">
                  您可以放心地重复导入同一时间段的数据，系统不会产生重复记录。
                </Tip>
              </DocItem>
            </DocSection>
          </>
        );

      case 'analysis':
        return (
          <>
            <DocSection icon={<PieChartOutlined />} title="数据分析">
              <DocItem title="总览仪表盘">
                <p>总览页面展示您的整体交易表现，包括：</p>
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">权益曲线</div>
                    <p className="text-xs">累计盈亏走势图，标注最大回撤点</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">关键指标</div>
                    <p className="text-xs">胜率、利润因子、期望值、最大回撤等</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">多维度统计</div>
                    <p className="text-xs">按品种、方向、时段分组分析</p>
                  </div>
                </div>
              </DocItem>

              <DocItem title="交易明细">
                <p>交易明细页面提供完整的交易记录表格，支持：</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li><strong>筛选功能</strong>：按品种、方向、日期范围、盈亏状态筛选</li>
                  <li><strong>排序功能</strong>：按任意列排序</li>
                  <li><strong>详情查看</strong>：点击单笔交易查看完整分析</li>
                  <li><strong>数据导出</strong>：导出为 Excel 格式</li>
                </ul>

                <h4 className="text-sm font-semibold text-[#fff] mt-4 mb-2">交易明细新增列（AI 增强）：</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-[#c9a227] font-semibold">R倍数</span>
                    <span className="text-[#888] text-xs ml-2">风险回报比 = PnL / |MAE|</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-[#c9a227] font-semibold">留存率</span>
                    <span className="text-[#888] text-xs ml-2">利润留存比例，越低越好</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-[#c9a227] font-semibold">压力</span>
                    <span className="text-[#888] text-xs ml-2">1-5 级心理压力评分</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-[#c9a227] font-semibold">诊断</span>
                    <span className="text-[#888] text-xs ml-2">自动归因标签（获利回吐/止损极点等）</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-[#c9a227] font-semibold">波动区间</span>
                    <span className="text-[#888] text-xs ml-2">MAE/MFE 可视化条形图</span>
                  </div>
                </div>
              </DocItem>

              <DocItem title="统计指标说明">
                <div className="space-y-4">
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-1">胜率 (Win Rate)</div>
                    <p className="text-xs text-[#888]">盈利交易数 / 总交易数 × 100%</p>
                    <p className="text-xs text-[#666] mt-1">一般认为 50% 以上为良好，但需结合盈亏比评估</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-1">利润因子 (Profit Factor)</div>
                    <p className="text-xs text-[#888]">总盈利 / 总亏损（绝对值）</p>
                    <p className="text-xs text-[#666] mt-1">&gt;1 表示盈利，&gt;2 表示优秀</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-1">期望值 (Expectancy)</div>
                    <p className="text-xs text-[#888]">(胜率 × 平均盈利) - (败率 × 平均亏损)</p>
                    <p className="text-xs text-[#666] mt-1">正值表示系统长期盈利，负值应停止交易</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-1">最大回撤 (Max Drawdown)</div>
                    <p className="text-xs text-[#888]">权益曲线从峰值到谷底的最大跌幅</p>
                    <p className="text-xs text-[#666] mt-1">反映最坏情况下的亏损幅度</p>
                  </div>
                </div>
              </DocItem>
            </DocSection>
          </>
        );

      case 'ai-coach':
        return (
          <>
            <DocSection icon={<RobotOutlined />} title="AI 交易教练">
              <DocItem title="功能概述">
                <p>AI 交易教练是 MetworthAI 的核心功能，通过分析您的历史交易数据，提供智能诊断和优化建议。</p>
                
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">🧠 智能诊断</div>
                    <p className="text-xs">自动识别交易行为模式和潜在问题</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">🎲 蒙特卡洛模拟</div>
                    <p className="text-xs">预测未来交易的盈亏概率分布</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">🎯 最优止损分析</div>
                    <p className="text-xs">回测不同止损位的效果，推荐最优策略</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-2">📊 期望值分布</div>
                    <p className="text-xs">按时段/方向/品种分析，找出优势时段</p>
                  </div>
                </div>
              </DocItem>

              <DocItem title="使用方法">
                <StepList steps={[
                  '进入 AI 教练页面',
                  '选择要分析的账本（或全部账本）',
                  '可选：设置日期范围筛选',
                  '点击"开始分析"按钮',
                  '等待分析完成（通常几秒钟）',
                  '查看分析报告和智能诊断结果',
                ]} />
                <Tip type="info">
                  建议至少有 50 笔以上交易数据再进行 AI 分析，数据越多分析结果越准确。
                </Tip>
              </DocItem>

              <DocItem title="行为归因标签">
                <p>系统会自动为每笔交易和整体表现打上行为标签：</p>
                <div className="space-y-3 mt-4">
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-xs px-2 py-1 bg-[#f43f5e]/20 text-[#f43f5e] rounded mr-2">🔥 报复性交易</span>
                    <span className="text-xs text-[#888]">亏损后 5 分钟内开新仓，冲动交易倾向</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-xs px-2 py-1 bg-[#eab308]/20 text-[#eab308] rounded mr-2">⏳ 执行犹豫</span>
                    <span className="text-xs text-[#888]">成交次数过多，反映入场/出场不果断</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-xs px-2 py-1 bg-[#8b5cf6]/20 text-[#8b5cf6] rounded mr-2">🎯 止损极点</span>
                    <span className="text-xs text-[#888]">止损价接近 MAE 最低点，可能止损位不合理</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-xs px-2 py-1 bg-[#3b82f6]/20 text-[#3b82f6] rounded mr-2">📉 处置效应</span>
                    <span className="text-xs text-[#888]">亏损单持仓时间长于盈利单，扛单倾向</span>
                  </div>
                  <div className="p-3 bg-[#0a0a0c] rounded border border-[#1a1a1f]">
                    <span className="text-xs px-2 py-1 bg-[#10b981]/20 text-[#10b981] rounded mr-2">💰 利润回吐</span>
                    <span className="text-xs text-[#888]">MFE 与实际盈利差距大，止盈不及时</span>
                  </div>
                </div>
              </DocItem>

              <DocItem title="操作建议解读">
                <p>系统会基于诊断结果给出下周操作建议：</p>
                <div className="space-y-3 mt-4">
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#10b981] font-semibold mb-1">✅ 继续执行</div>
                    <p className="text-xs text-[#888]">交易系统运行良好，保持当前策略</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#c9a227] font-semibold mb-1">⚡ 早出策略</div>
                    <p className="text-xs text-[#888]">利润留存率低，建议更快止盈，减少利润回吐</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#eab308] font-semibold mb-1">📉 减仓操作</div>
                    <p className="text-xs text-[#888]">近期表现不佳，建议降低仓位，控制风险</p>
                  </div>
                  <div className="p-4 bg-[#0a0a0c] rounded-lg border border-[#1a1a1f]">
                    <div className="text-[#f43f5e] font-semibold mb-1">🛑 多看少动</div>
                    <p className="text-xs text-[#888]">系统表现较差，建议暂停交易，深入复盘</p>
                  </div>
                </div>
              </DocItem>
            </DocSection>
          </>
        );

      case 'concepts':
        return (
          <>
            <DocSection icon={<BookOutlined />} title="核心概念">
              <DocItem title="MAE（最大逆向波动）">
                <p><strong>Maximum Adverse Excursion</strong></p>
                <p className="mt-2">定义：持仓期间价格向不利方向移动的最大幅度。</p>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] mt-3">
                  <p className="text-xs">举例：您做多后，价格最低跌到了 -$200，即使最后盈利，MAE = -$200</p>
                </div>
                <p className="mt-3">意义：</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>反映您承受的最大浮亏压力</li>
                  <li>用于评估止损位是否合理</li>
                  <li>帮助计算 R倍数</li>
                  <li>量化交易过程中的心理压力</li>
                </ul>
              </DocItem>

              <DocItem title="MFE（最大顺向波动）">
                <p><strong>Maximum Favorable Excursion</strong></p>
                <p className="mt-2">定义：持仓期间价格向有利方向移动的最大幅度。</p>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] mt-3">
                  <p className="text-xs">举例：您做多后，价格最高涨到了 +$500，最后平仓盈利 $300，MFE = $500</p>
                </div>
                <p className="mt-3">意义：</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>反映您曾经触及的最大浮盈</li>
                  <li>用于评估止盈策略效果</li>
                  <li>MFE - PnL = 利润回吐金额</li>
                  <li>帮助优化出场时机</li>
                </ul>
              </DocItem>

              <DocItem title="R倍数 (R-Multiple)">
                <p><strong>风险回报倍数</strong></p>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] mt-3 font-mono">
                  <p className="text-[#c9a227]">R倍数 = 实际盈亏 / |MAE|</p>
                </div>
                <p className="mt-3">解读：</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>R = 2：盈利是承担风险的 2 倍</li>
                  <li>R = 1：盈亏等于风险</li>
                  <li>R = 0.5：盈利只有风险的一半</li>
                  <li>R &lt; 0：亏损交易</li>
                </ul>
                <Tip type="success">
                  追求高 R倍数交易是专业交易者的核心目标之一。平均 R倍数 &gt; 1 意味着系统具有正期望值。
                </Tip>
              </DocItem>

              <DocItem title="利润留存率">
                <p><strong>Profit Retention Rate</strong></p>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] mt-3 font-mono">
                  <p className="text-[#c9a227]">利润留存率 = (MFE - max(0, PnL)) / MFE</p>
                </div>
                <p className="mt-3">解读：</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>0%：完美止盈，在最高点平仓</li>
                  <li>50%：回吐了一半利润</li>
                  <li>100%：从盈利变成亏损</li>
                </ul>
                <Tip type="warning">
                  留存率持续偏高（&gt;50%）说明止盈策略需要优化，考虑使用移动止盈或更早出场。
                </Tip>
              </DocItem>

              <DocItem title="期望值 (Expectancy)">
                <p><strong>每笔交易的平均预期收益</strong></p>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] mt-3 font-mono">
                  <p className="text-[#c9a227]">期望值 = (胜率 × 平均盈利) - (败率 × 平均亏损)</p>
                </div>
                <p className="mt-3">解读：</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>期望值 &gt; 0：系统长期盈利</li>
                  <li>期望值 = 0：长期盈亏平衡</li>
                  <li>期望值 &lt; 0：系统长期亏损</li>
                </ul>
                <Tip type="info">
                  即使胜率只有 40%，只要平均盈利足够大，期望值仍可为正。反之，90% 胜率但盈亏比极低，期望值也可能为负。
                </Tip>
              </DocItem>

              <DocItem title="处置效应 (Disposition Effect)">
                <p><strong>行为金融学概念</strong></p>
                <p className="mt-2">定义：投资者倾向于过早卖出盈利仓位，过晚卖出亏损仓位。</p>
                <div className="bg-[#0a0a0c] rounded-lg p-4 border border-[#1a1a1f] mt-3">
                  <p className="text-xs">表现：</p>
                  <ul className="list-disc list-inside space-y-1 mt-1 text-xs">
                    <li>盈利单持仓时间短（急于落袋为安）</li>
                    <li>亏损单持仓时间长（不愿承认错误）</li>
                    <li>结果：截断利润，放大亏损</li>
                  </ul>
                </div>
                <Tip type="warning">
                  如果您的亏损单平均持仓时间明显长于盈利单，说明存在处置效应，需要改进出场纪律。
                </Tip>
              </DocItem>
            </DocSection>
          </>
        );

      case 'faq':
        return (
          <>
            <DocSection icon={<QuestionCircleOutlined />} title="常见问题">
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
            </DocSection>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* 顶部导航 */}
      <nav className="fixed w-full z-50 bg-[#0d0d10]/95 backdrop-blur-xl border-b border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-[#888] hover:text-[#c9a227] transition-colors"
            >
              <ArrowLeftOutlined />
              <span className="text-sm">返回首页</span>
            </button>
            <div className="w-px h-5 bg-[#1a1a1f]"></div>
            <div className="flex items-center gap-2">
              <BookOutlined className="text-[#c9a227]" />
              <span className="text-sm font-semibold text-[#fff]">帮助文档</span>
            </div>
          </div>
          
          <button 
            onClick={onStart}
            className="text-sm font-semibold bg-[#c9a227] text-[#0a0a0c] px-5 py-2 rounded hover:bg-[#d4af37] transition-all"
          >
            免费开始
          </button>
        </div>
      </nav>

      {/* 主内容区 */}
      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* 标题 */}
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-[#fff] mb-4">MetworthAI 帮助中心</h1>
            <p className="text-[#666] max-w-xl mx-auto">详细的使用文档和常见问题解答，帮助您快速上手</p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* 左侧导航 */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-2">
                {sections.map((section) => (
                  <DocCard
                    key={section.key}
                    icon={section.icon}
                    title={section.title}
                    description={section.description}
                    isActive={activeSection === section.key}
                    onClick={() => setActiveSection(section.key)}
                  />
                ))}
              </div>
            </div>

            {/* 右侧内容 */}
            <div className="lg:col-span-3">
              <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-8">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <section className="py-16 px-6 bg-[#0d0d10] border-t border-[#1a1a1f]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-[#fff] mb-4">准备好开始了吗？</h2>
          <p className="text-[#666] mb-8">免费注册，立即体验 AI 交易教练</p>
          <button 
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-[#c9a227] text-[#0a0a0c] px-8 py-3 rounded-lg font-semibold hover:bg-[#d4af37] transition-all"
          >
            立即免费开始
            <ArrowRightOutlined />
          </button>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-[#555]">
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 免费使用</span>
            <span className="flex items-center gap-1"><CheckCircleOutlined className="text-[#c9a227]" /> 无需信用卡</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-[#1a1a1f]">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded object-cover" />
            <span className="font-semibold text-[#fff] text-sm">MetworthAI</span>
          </div>
          <div className="text-xs text-[#444]">© 2026 MetworthAI</div>
        </div>
      </footer>
    </div>
  );
};

export default Docs;
