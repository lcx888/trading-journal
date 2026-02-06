/**
 * ECharts 按需引入包装器
 * 仅导入项目实际使用的图表类型，节省 ~600KB
 */
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  VisualMapComponent,
} from 'echarts/components';
import EChartsReactCore from 'echarts-for-react/lib/core';
import { forwardRef, memo } from 'react';

// 注册必要的组件（只注册一次）
echarts.use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  VisualMapComponent,
]);

/**
 * 轻量级 ECharts 组件
 * 用法与 echarts-for-react 完全一致，直接替换 import 即可
 */
const Chart = memo(forwardRef((props, ref) => (
  <EChartsReactCore
    ref={ref}
    echarts={echarts}
    {...props}
  />
)));

Chart.displayName = 'Chart';

export default Chart;
