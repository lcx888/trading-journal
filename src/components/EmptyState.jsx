import { Button } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  CalendarOutlined,
  LineChartOutlined,
  ImportOutlined
} from '@ant-design/icons';

/**
 * 差异化空状态组件 - 币安风格
 */
const EmptyState = ({ 
  type = 'no-data', 
  onAction,
  filterText = ''
}) => {
  const configs = {
    'new-user': {
      icon: <ImportOutlined className="text-4xl text-[var(--color-brand)]" />,
      title: '开始您的交易复盘之旅',
      description: '导入您的第一份交易记录，让 AI 帮助您分析交易表现',
      actionText: '导入交易数据',
      actionIcon: <PlusOutlined />,
    },
    'no-filter-result': {
      icon: <SearchOutlined className="text-4xl text-[var(--text-tertiary)]" />,
      title: '未找到匹配的交易记录',
      description: filterText ? `当前筛选条件「${filterText}」无匹配结果` : '试试调整筛选条件？',
      actionText: '清除筛选条件',
      actionIcon: null,
    },
    'no-today': {
      icon: <CalendarOutlined className="text-4xl text-[var(--text-tertiary)]" />,
      title: '今日暂无交易',
      description: '休息也是策略的一部分，保持良好的交易纪律',
      actionText: null,
      actionIcon: null,
    },
    'no-data': {
      icon: <LineChartOutlined className="text-4xl text-[var(--text-tertiary)]" />,
      title: '暂无交易数据',
      description: '导入交易记录后，这里将展示您的交易统计',
      actionText: '去导入数据',
      actionIcon: <ImportOutlined />,
    }
  };

  const config = configs[type] || configs['no-data'];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md">
      <div className="w-16 h-16 rounded bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
        {config.icon}
      </div>
      
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
        {config.title}
      </h3>
      
      <p className="text-sm text-[var(--text-secondary)] text-center max-w-md mb-5">
        {config.description}
      </p>
      
      {config.actionText && onAction && (
        <Button 
          type="primary" 
          icon={config.actionIcon}
          onClick={onAction}
        >
          {config.actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
