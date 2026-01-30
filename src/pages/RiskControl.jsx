/**
 * 风控测试 - PropFirm Risk Tester
 * 
 * 设计理念：
 * 1. 首次使用：引导用户配置风控规则
 * 2. 配置后：展示回撤追踪结果
 * 3. 极简布局：聚焦核心数据
 */
import { useState, useEffect, useMemo } from 'react';
import { WarningOutlined } from '@ant-design/icons';
import { Spin, InputNumber, Switch, Form, Modal, message, Tooltip } from 'antd';
import { 
  SafetyOutlined,
  SettingOutlined,
  PlusOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import StorageService from '../services/storage';
import DrawdownTracker from '../components/DrawdownTracker';

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

const RiskControl = ({ activeRecordId = 'all' }) => {
  const [trades, setTrades] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  
  // 检查是否已配置
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

  useEffect(() => {
    loadData();
    loadInstruments();
  }, [activeRecordId]);

  const loadData = async () => {
    setLoading(true);
    try {
      let allTrades = await StorageService.getAllTrades();
      if (activeRecordId && activeRecordId !== 'all') {
        allTrades = allTrades.filter(t => t.recordId === activeRecordId);
      }
      allTrades.sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
      setTrades(allTrades);
    } catch (error) {
      console.error('Failed to load trades:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算没有 MAE 数据的交易数量
  const tradesWithoutMAE = useMemo(() => {
    return trades.filter(t => {
      const mae = t.mae ?? t.jigsawData?.mae;
      return mae === undefined || mae === null || mae === 0;
    });
  }, [trades]);

  const loadInstruments = async () => {
    try {
      const data = await StorageService.getInstruments();
      setInstruments(data || []);
    } catch (error) {
      console.error('Failed to load instruments:', error);
    }
  };

  // 保存配置
  const saveConfig = (values) => {
    const newConfig = { ...config, ...values };
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    localStorage.setItem(CONFIGURED_KEY, 'true');
    setIsConfigured(true);
    setShowSetup(false);
    message.success('风控规则已保存');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  // 首次使用：引导配置
  if (!isConfigured) {
    return (
      <div className="max-w-[1600px] mx-auto p-6">
        <div className="max-w-2xl mx-auto py-6">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-[var(--color-brand-bg)] border border-[var(--color-brand)] flex items-center justify-center mx-auto mb-6">
            <SafetyOutlined className="text-4xl text-[var(--color-brand)]" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)] mb-3">风控测试</h1>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
            验证您的交易策略是否符合 PropFirm 回撤规则。<br/>
            首次使用，请先配置您的风控参数。
          </p>
        </div>

        {/* 配置表单 */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-8">
          <Form
            layout="vertical"
            initialValues={config}
            onFinish={saveConfig}
          >
            <div className="grid grid-cols-2 gap-6">
              <Form.Item 
                label={<span className="text-[var(--text-secondary)] text-sm">初始资金</span>}
                name="initialBalance"
              >
                <InputNumber 
                  className="w-full"
                  prefix="$" 
                  min={1000}
                  step={1000}
                  size="large"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
              
              <Form.Item 
                label={<span className="text-[var(--text-secondary)] text-sm">最大总回撤</span>}
                name="maxDrawdownPercent"
              >
                <InputNumber 
                  className="w-full"
                  min={1} 
                  max={50}
                  suffix="%"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item 
                label={<span className="text-[var(--text-secondary)] text-sm">日内最大回撤</span>}
                name="dailyDrawdownPercent"
              >
                <InputNumber 
                  className="w-full"
                  min={1} 
                  max={20}
                  suffix="%"
                  size="large"
                />
              </Form.Item>
              
              <Form.Item 
                label={<span className="text-[var(--text-secondary)] text-sm">追踪回撤</span>}
                name="trailingEnabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>

            {/* PropFirm 预设 */}
            <div className="mt-6 p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-3">
                <InfoCircleOutlined className="text-[var(--color-brand)]" />
                <span className="text-xs font-bold text-[var(--text-secondary)]">常见 PropFirm 规则</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'FTMO', maxDD: 10, dailyDD: 5 },
                  { name: 'MFF', maxDD: 12, dailyDD: 5 },
                  { name: 'Funded Next', maxDD: 10, dailyDD: 5 },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      saveConfig({ 
                        ...config, 
                        maxDrawdownPercent: preset.maxDD, 
                        dailyDrawdownPercent: preset.dailyDD 
                      });
                    }}
                    className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--color-brand)] transition-colors text-left"
                  >
                    <div className="text-xs font-bold text-[var(--text-primary)] mb-1">{preset.name}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      总 {preset.maxDD}% / 日 {preset.dailyDD}%
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <Form.Item className="mt-8 mb-0">
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-[var(--color-brand)] text-[var(--bg-primary)] font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <PlusOutlined />
                创建风控规则
              </button>
            </Form.Item>
          </Form>
        </div>
        </div>
      </div>
    );
  }

  // 已配置：显示风控测试结果
  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* 极简标题栏 */}
      <div className="flex items-end justify-between border-b border-[var(--border-primary)] pb-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)] mb-2">风控测试</h1>
          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <span>{trades.length} 笔交易</span>
            <span className="w-1 h-1 rounded-full bg-[var(--border-primary)]" />
            <span>初始资金 ${(config.initialBalance ?? 100000).toLocaleString()}</span>
            <span className="w-1 h-1 rounded-full bg-[var(--border-primary)]" />
            <span>限制 {config.maxDrawdownPercent ?? 10}% / {config.dailyDrawdownPercent ?? 5}%</span>
          </div>
        </div>
        
        <button
          onClick={() => setShowSetup(true)}
          className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] hover:border-[var(--text-secondary)] transition-all rounded"
        >
          修改规则
        </button>
      </div>

      {/* MAE 数据缺失警告 - 极简风格 */}
      {tradesWithoutMAE.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border border-[var(--border-primary)] bg-[var(--bg-secondary)] rounded">
          <div className="flex items-center gap-3">
            <WarningOutlined className="text-[var(--text-tertiary)] text-xs" />
            <span className="text-[11px] text-[var(--text-secondary)]">
              {tradesWithoutMAE.length} 笔交易缺少 MAE 数据，统计结果可能存在偏差
            </span>
          </div>
          <Tooltip title="MAE 数据来源于 Jigsaw 或 ATAS 导出的交易数据。缺失数据将按 0 计算。">
            <InfoCircleOutlined className="text-[var(--text-tertiary)] text-xs cursor-help" />
          </Tooltip>
        </div>
      )}

      {/* 核心：回撤追踪组件 */}
      <div className="bg-transparent">
        <DrawdownTracker 
          trades={trades} 
          instruments={instruments}
          hideSettings={true}
        />
      </div>

      {/* 设置弹窗 */}
      <Modal
        title="修改风控规则"
        open={showSetup}
        onCancel={() => setShowSetup(false)}
        footer={null}
        width={480}
        styles={{
          content: { background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' },
          header: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' },
        }}
      >
        <Form
          layout="vertical"
          initialValues={config}
          onFinish={saveConfig}
          className="mt-4"
        >
          <Form.Item label="初始资金" name="initialBalance">
            <InputNumber 
              className="w-full" prefix="$" min={1000} step={1000}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>
          <Form.Item label="最大总回撤 (%)" name="maxDrawdownPercent">
            <InputNumber className="w-full" min={1} max={50} suffix="%" />
          </Form.Item>
          <Form.Item label="日内最大回撤 (%)" name="dailyDrawdownPercent">
            <InputNumber className="w-full" min={1} max={20} suffix="%" />
          </Form.Item>
          <Form.Item label="追踪回撤" name="trailingEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item className="mb-0">
            <button type="submit" className="w-full py-2.5 rounded bg-[var(--color-brand)] text-[var(--bg-primary)] font-bold text-sm">
              保存规则
            </button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RiskControl;
