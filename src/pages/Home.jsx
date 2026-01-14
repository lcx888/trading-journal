import { useState, useEffect } from 'react';
import { 
  ArrowRightOutlined,
  RobotOutlined,
  BulbOutlined,
  BarChartOutlined,
  RiseOutlined,
  MenuOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';

// 极简风格的导航栏
const Navbar = ({ onStart }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md border-b border-gray-100 py-4' : 'bg-transparent py-6'}`}>
      <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xl">M</div>
          <span className="text-xl font-bold tracking-tight text-gray-900">Metworth<span className="text-gray-400">AI</span></span>
        </div>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">功能特性</a>
          <a href="#workflow" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">工作流</a>
          <a href="#pricing" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">定价</a>
          <button onClick={onStart} className="text-sm font-medium px-5 py-2 rounded-full border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-all duration-300">
            登录
          </button>
          <button onClick={onStart} className="text-sm font-medium bg-black text-white px-5 py-2 rounded-full hover:bg-gray-800 transition-all shadow-lg shadow-gray-200">
            免费试用
          </button>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-xl" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-gray-100 p-6 flex flex-col gap-4 shadow-lg">
          <a href="#features" className="text-base font-medium text-gray-600">功能特性</a>
          <a href="#workflow" className="text-base font-medium text-gray-600">工作流</a>
          <button onClick={onStart} className="w-full text-center py-3 border border-gray-200 rounded-lg">登录</button>
          <button onClick={onStart} className="w-full text-center py-3 bg-black text-white rounded-lg">免费试用</button>
        </div>
      )}
    </nav>
  );
};

// 模拟的 AI 分析演示组件 - 交易版
const MockInterface = ({ onStart }) => {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-16 md:mt-24" style={{ perspective: '1000px' }}>
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden p-1 transition-all duration-700 ease-out hover:rotate-0" style={{ transform: 'rotateX(12deg)', transformStyle: 'preserve-3d' }}>
        
        {/* Window Controls */}
        <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-100">
          <div className="w-3 h-3 rounded-full bg-gray-200"></div>
          <div className="w-3 h-3 rounded-full bg-gray-200"></div>
          <div className="w-3 h-3 rounded-full bg-gray-200"></div>
          <div className="ml-4 text-xs text-gray-400 font-mono">metworth.ai/dashboard/weekly-review</div>
        </div>

        {/* Dashboard Content */}
        <div className="flex h-[400px] md:h-[500px]">
          {/* Sidebar */}
          <div className="w-16 md:w-64 border-r border-gray-100 p-4 flex flex-col gap-6 bg-gray-50/50">
            <div className="h-8 w-8 bg-gray-200 rounded md:w-3/4"></div>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded shadow-sm">
                 <div className="w-4 h-4 bg-black rounded-full"></div>
                 <div className="hidden md:block text-xs font-bold">交易日记</div>
              </div>
              {[2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2">
                  <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
                  <div className="hidden md:block w-2/3 h-2 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 p-6 md:p-8 bg-white">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">本周 NQ 期货交易复盘</h3>
                <p className="text-gray-400 text-sm mt-1">关联账户: Binance & IBKR • 周期: 10/16 - 10/22</p>
              </div>
              <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-100">盈利因子 2.4</span>
            </div>

            {/* AI Insights Block */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-medium">
                  <RiseOutlined className="text-green-500" />
                  <span>盈亏比 (R:R)</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">1:3.2</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-medium">
                  <SafetyCertificateOutlined className="text-red-500" />
                  <span>违规操作</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">2次</div>
                <div className="text-xs text-red-400 mt-1">检测到 FOMO 追高</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-medium">
                  <RobotOutlined className="text-purple-500" />
                  <span>AI 建议</span>
                </div>
                <div className="text-sm font-medium text-gray-600 leading-tight mt-1">
                  你在上午 10:30 的波动区间表现最佳。建议减少午盘低流动性时段的交易频率。
                </div>
              </div>
            </div>

            {/* Equity Curve Mock */}
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
              <div className="flex justify-between mb-4">
                  <span className="text-xs font-bold text-gray-400 uppercase">资金权益曲线</span>
                  <span className="text-xs text-green-600">+12.5% 本周</span>
              </div>
              <div className="h-24 w-full flex items-end gap-1">
                 {[40, 45, 42, 50, 55, 52, 60, 65, 58, 70, 75, 80, 78, 85].map((h, i) => (
                    <div key={i} style={{height: `${h}%`}} className="flex-1 bg-black/5 hover:bg-black transition-colors rounded-t-sm"></div>
                 ))}
              </div>
            </div>
            
            {/* Floating Action Button */}
            <div className="absolute bottom-8 right-8">
              <button onClick={onStart} className="bg-black text-white px-4 py-2 rounded-lg text-sm shadow-xl flex items-center gap-2 hover:scale-105 transition-transform">
                <BulbOutlined /> 生成下周交易计划
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative Glow */}
      <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-green-100/40 via-transparent to-gray-200/40 blur-3xl opacity-50"></div>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, desc }) => (
  <div className="group p-8 rounded-2xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300">
    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-gray-100 shadow-sm text-xl">
      <Icon className="text-gray-900" />
    </div>
    <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
    <p className="text-gray-500 leading-relaxed text-sm">{desc}</p>
  </div>
);

const Home = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-200">
      <Navbar onStart={onStart} />

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600 mb-8 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Metworth AI 交易版 2.0
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-6 leading-[1.1]">
            告别感性交易，<br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500">
              用数据重塑你的交易系统。
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            MetworthAI 自动同步你的交易记录，利用 AI 识别情绪化操作、分析策略漏洞，助你从亏损走向稳定盈利。
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <button onClick={onStart} className="w-full md:w-auto px-8 py-4 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group">
              连接交易账户
              <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={onStart} className="w-full md:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-full font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
              <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <PlayCircleOutlined />
              </span>
              查看示例报告
            </button>
          </div>

          <MockInterface onStart={onStart} />
        </div>
      </section>

      {/* Logos / Trust */}
      <section className="py-10 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm text-gray-400 font-medium mb-8">完美支持主流交易所与平台</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {['Binance', 'MetaTrader 5', 'InteractiveBrokers', 'TradingView', 'Coinbase'].map((logo, i) => (
              <span key={i} className="text-lg md:text-xl font-bold text-gray-800 font-mono tracking-tight">{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-20 max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">不仅是记账，<br/>更是私人交易教练。</h2>
            <p className="text-gray-500 text-lg">90% 的交易员亏损是因为缺乏一致性。MetworthAI 帮你像机构一样思考，像算法一样执行。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={SafetyCertificateOutlined}
              title="坏习惯识别"
              desc="AI 自动检测报复性交易、过度交易（Over-trading）和扛单行为，并在周报中发出警示。"
            />
            <FeatureCard 
              icon={BarChartOutlined}
              title="深度归因分析"
              desc="不仅仅看盈亏。分析你的入场胜率、持仓时间与收益的关系，找到属于你的「黄金设置」。"
            />
            <FeatureCard 
              icon={RobotOutlined}
              title="智能心理复盘"
              desc="结合交易时的语音/文字笔记，关联市场行情，AI 帮你复原当时的情绪状态，克服人性弱点。"
            />
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-24 bg-black text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-16">
            <div className="flex-1 space-y-12">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                简单三步，<br/>
                构建稳定盈利系统。
              </h2>
              
              <div className="space-y-8">
                {[
                  { title: "1. 自动同步", desc: "一键连接 API 或导入交割单，支持 Crypto、外汇与美股。" },
                  { title: "2. 策略诊断", desc: "AI 分析每笔交易的执行质量，计算你的真实 Edge（优势）。" },
                  { title: "3. 优化执行", desc: "生成下周风控计划：最大亏损限制、最佳交易时段建议。" }
                ].map((step, idx) => (
                  <div key={idx} className="flex gap-4 group cursor-default">
                    <div className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-sm font-mono text-gray-400 group-hover:bg-white group-hover:text-black transition-colors">
                      0{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2 group-hover:text-gray-300 transition-colors">{step.title}</h4>
                      <p className="text-gray-500 leading-relaxed max-w-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full relative">
              <div className="aspect-square bg-gray-900 rounded-2xl p-8 border border-gray-800 relative overflow-hidden">
                 {/* Abstract representation of workflow */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4">
                    <div className="absolute top-0 left-0 w-full p-4 bg-gray-800 rounded-lg animate-pulse border border-gray-700/50">
                      <div className="flex justify-between items-center mb-2">
                        <div className="h-2 w-12 bg-gray-600 rounded"></div>
                        <div className="h-2 w-8 bg-green-900 rounded"></div>
                      </div>
                      <div className="h-10 w-full bg-gradient-to-r from-gray-800 to-gray-700 rounded mb-2"></div>
                    </div>
                    
                    <div className="absolute top-[30%] left-1/2 -translate-x-1/2 text-gray-600 rotate-90">
                      <ArrowRightOutlined />
                    </div>
                    
                    <div className="absolute top-1/2 left-0 w-full p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-10 transform -translate-y-1/2">
                       <div className="flex items-center gap-2 mb-2">
                         <ThunderboltOutlined className="text-yellow-400" />
                         <span className="text-xs text-gray-300">AI Analysis</span>
                       </div>
                       <div className="h-1 w-full bg-gray-700 rounded mb-2 overflow-hidden">
                          <div className="h-full w-2/3 bg-yellow-400"></div>
                       </div>
                       <div className="text-[10px] text-gray-400">识别到非策略性入场...</div>
                    </div>
                    
                    <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 text-gray-600 rotate-90">
                      <ArrowRightOutlined />
                    </div>
                    
                    <div className="absolute bottom-0 left-0 w-full p-4 bg-white rounded-lg text-black">
                       <div className="text-xs font-bold mb-2">风控指令</div>
                       <div className="flex gap-2 text-[10px]">
                          <span className="px-2 py-1 bg-red-100 text-red-600 rounded">停止开仓</span>
                          <span className="px-2 py-1 bg-gray-100 rounded">强制冷静 24h</span>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 bg-gray-50 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">像专业基金经理一样复盘</h2>
          <p className="text-gray-500 mb-10 text-lg">不要让昂贵的学费白交。立即找出你的交易漏洞。</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <button onClick={onStart} className="w-full sm:w-auto px-8 py-4 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-all shadow-xl shadow-gray-300/50">
              开始免费复盘
            </button>
            <button onClick={onStart} className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-full font-medium hover:bg-gray-100 transition-all">
              查看演示账户
            </button>
          </div>
          <p className="mt-6 text-xs text-gray-400">无需信用卡 • 数据本地加密 • 支持 CSV 导入</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black rounded text-white flex items-center justify-center text-xs font-bold">M</div>
            <span className="font-bold text-gray-900">MetworthAI</span>
          </div>
          
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-black transition-colors">常见问题</a>
            <a href="#" className="hover:text-black transition-colors">数据安全</a>
            <a href="#" className="hover:text-black transition-colors">支持交易所</a>
            <a href="#" className="hover:text-black transition-colors">联系我们</a>
          </div>

          <div className="text-xs text-gray-400">
            © 2026 Metworth Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
