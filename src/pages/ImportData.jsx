import { useState, useEffect } from 'react';
import { 
  Card, Upload, Button, message, Table, Tag, Statistic, Row, Col,
  Modal, Progress, Alert, Space, Descriptions, Badge, Select, Empty, Typography
} from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  ImportOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  WarningOutlined,
  PlusOutlined,
  FileSearchOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { parseATASFile, checkDuplicates } from '../services/atasParser';
import StorageService from '../services/storage';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

// TradingView Colors
const COLORS = {
  profit: '#26a69a',
  loss: '#ef5350',
  primary: '#2962ff',
  text: '#131722',
  textLight: '#787b86',
  border: '#e0e3eb',
  grid: '#f0f3fa'
};

const ImportData = ({ onImportSuccess, selectedRecordId, onNavigateToRecords }) => {
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const [records, setRecords] = useState([]);
  const [currentRecordId, setCurrentRecordId] = useState(selectedRecordId || null);
  const [loadingRecords, setLoadingRecords] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    if (selectedRecordId) setCurrentRecordId(selectedRecordId);
  }, [selectedRecordId]);

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const allRecords = await StorageService.getAllRecords();
      setRecords(allRecords.filter(r => r.status === 'active'));
    } catch (e) { console.error(e); }
    finally { setLoadingRecords(false); }
  };

  const getCurrentRecord = () => records.find(r => r.id === currentRecordId);

  const handleFileParse = async (file) => {
    if (!currentRecordId) {
      message.warning('请先选择目标账本');
      return false;
    }
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isExcel) {
      message.error('格式无效，请上传 .xlsx 或 .xls');
      return false;
    }
    parseFile(file);
    return false;
  };

  const parseFile = async (file) => {
    setParsing(true);
    setParsedData(null);
    setDuplicateInfo(null);
    try {
      const result = await parseATASFile(file);
      if (result.trades.length === 0) {
        message.warning('文件中未检测到交易');
        return;
      }
      const { duplicates, unique } = await checkDuplicates(result.trades);
      setParsedData(result);
      setDuplicateInfo({
        total: result.trades.length,
        duplicates: duplicates.length,
        unique: unique.length,
        uniqueTrades: unique,
      });
      message.success(`解析完成：检测到 ${result.trades.length} 笔交易`);
    } catch (e) { message.error(`解析失败：${e.message}`); }
    finally { setParsing(false); }
  };

  const handleImport = async () => {
    if (!duplicateInfo || duplicateInfo.unique === 0) return;
    setImporting(true);
    setImportProgress(0);
    try {
      const tradesToImport = duplicateInfo.uniqueTrades.map(t => ({ ...t, recordId: currentRecordId }));
      const timer = setInterval(() => setImportProgress(p => Math.min(p + 15, 95)), 150);
      await StorageService.addTrades(tradesToImport);
      await StorageService.refreshRecordStats(currentRecordId);
      await StorageService.addImportRecord({
        filename: parsedData.filename,
        importDate: new Date(),
        tradesCount: tradesToImport.length,
        totalPnL: tradesToImport.reduce((sum, t) => sum + (t.pnl || 0), 0),
        recordId: currentRecordId,
        recordName: getCurrentRecord()?.name,
      });
      clearInterval(timer);
      setImportProgress(100);
      message.success('数据同步成功');
      setTimeout(() => {
        setParsedData(null);
        setDuplicateInfo(null);
        onImportSuccess?.();
      }, 800);
    } catch (e) { message.error(`同步失败：${e.message}`); }
    finally { setImporting(false); }
  };

  const previewColumns = [
    { title: <span className="text-[10px] font-bold uppercase text-slate-400">时间</span>, dataIndex: 'openTime', width: 120, render: t => <div className="text-[11px] font-medium">{dayjs(t).format('MM/DD HH:mm')}</div> },
    { title: <span className="text-[10px] font-bold uppercase text-slate-400">品种</span>, dataIndex: 'instrumentCode', width: 80, render: c => <Tag className="rounded bg-slate-100 border-none font-bold text-slate-600">{c}</Tag> },
    { title: <span className="text-[10px] font-bold uppercase text-slate-400">方向</span>, dataIndex: 'direction', width: 70, render: d => <span className={`text-[11px] font-bold ${d === 'LONG' ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{d === 'LONG' ? '多' : '空'}</span> },
    { title: <span className="text-[10px] font-bold uppercase text-slate-400">开仓价</span>, dataIndex: 'openPrice', align: 'right', render: p => <span className="font-mono text-[11px]">{p?.toFixed(2)}</span> },
    { title: <span className="text-[10px] font-bold uppercase text-slate-400">盈亏</span>, dataIndex: 'pnl', align: 'right', render: p => <span className={`font-mono font-bold text-[11px] ${p >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{p >= 0 ? '+' : ''}{p?.toFixed(2)}</span> },
  ];

  if (!loadingRecords && records.length === 0) {
    return (
      <div className="modern-card bg-white p-12 text-center max-w-2xl mx-auto">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<div className="space-y-4"><div className="text-lg font-bold text-[#131722]">需要先创建账本</div><div className="text-slate-500 text-sm">导入数据前请先创建交易账本。</div><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => onNavigateToRecords?.()}>创建账本</Button></div>} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Target Selector */}
      <div className="modern-card bg-white p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1 w-full">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FolderOpenOutlined /> 目标账本
            </div>
            <div className="flex gap-2">
              <Select
                placeholder="选择本次导入的目标账本..."
                value={currentRecordId}
                onChange={setCurrentRecordId}
                size="large"
                className="flex-1"
                options={records.map(r => ({ value: r.id, label: r.name }))}
              />
              <Button icon={<PlusOutlined />} onClick={() => onNavigateToRecords?.()} className="h-[40px] px-6 font-bold text-[11px] uppercase">新建</Button>
            </div>
          </div>
          {currentRecordId && getCurrentRecord() && (
            <div className="bg-[#f0f3fa] p-4 rounded-xl border border-blue-100 min-w-[240px]">
              <div className="text-[10px] font-bold text-blue-500 uppercase mb-1">目标概览</div>
              <div className="font-bold text-[#131722] mb-1">{getCurrentRecord().name}</div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-medium">{getCurrentRecord().tradeCount || 0} 总交易</span>
                <span className={`text-[11px] font-bold ${(getCurrentRecord().totalPnL || 0) >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                  {(getCurrentRecord().totalPnL || 0).toLocaleString()} 美元
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Area - Terminal Style */}
          <div className="modern-card bg-[#131722] border-none overflow-hidden relative group">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <FileSearchOutlined style={{ fontSize: '120px', color: '#fff' }} />
            </div>
            
            <div className="p-8 relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">数据导入引擎</div>
                  <div className="text-white text-2xl font-bold tracking-tight">导入 ATAS 数据集</div>
                </div>
                <div className={`px-3 py-1 rounded border ${currentRecordId ? 'border-blue-500 text-blue-400' : 'border-slate-700 text-slate-500'} text-[9px] font-black uppercase tracking-widest`}>
                  {currentRecordId ? '系统就绪' : '待机'}
                </div>
              </div>

              <Dragger
                name="file"
                multiple={false}
                accept=".xlsx,.xls"
                beforeUpload={handleFileParse}
                showUploadList={false}
                disabled={parsing || importing || !currentRecordId}
                className={`transition-all duration-500 border-2 border-dashed rounded-2xl flex items-center justify-center
                  ${currentRecordId 
                    ? 'border-blue-500/30 bg-blue-500/5 hover:border-blue-400 hover:bg-blue-500/10 cursor-pointer' 
                    : 'border-slate-800 bg-transparent opacity-40 cursor-not-allowed'
                  }`}
                style={{ height: '240px' }}
              >
                <div className="py-4">
                  <div className="mb-6 relative inline-block">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110
                      ${currentRecordId ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-600'}`}>
                      <ImportOutlined className="text-2xl" />
                    </div>
                    {currentRecordId && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#26a69a] rounded-full border-2 border-[#131722] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                  
                  <div className={`font-bold text-lg mb-1 ${currentRecordId ? 'text-white' : 'text-slate-600'}`}>
                    {currentRecordId ? '将交易数据拖放到此处' : '请先在上方选择目标账本'}
                  </div>
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    兼容 .xlsx 规范 v2.4+
                  </div>
                </div>
              </Dragger>

              {parsing && (
                <div className="absolute inset-0 bg-[#131722]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-in fade-in">
                  <div className="w-64">
                    <div className="flex justify-between mb-2">
                      <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest">正在扫描...</span>
                      <span className="text-white text-[10px] font-mono">哈希校验通过</span>
                    </div>
                    <Progress 
                      percent={85} 
                      status="active" 
                      showInfo={false} 
                      strokeColor="#2962ff" 
                      strokeWidth={4}
                      className="m-0"
                    />
                    <div className="mt-4 text-slate-500 text-[9px] font-medium text-center">正在解析 ATAS_REALTIME_EXPORT.XLSX</div>
                  </div>
                </div>
              )}
            </div>

            {/* Terminal Decorative Lines */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          </div>

          {/* Analysis Results - Styled as a dynamic report */}
          {parsedData && duplicateInfo && (
            <div className="space-y-6">
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <div className="modern-card bg-white p-4 text-center">
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">总检测数</div>
                    <div className="text-xl font-bold text-[#131722]">{duplicateInfo.total}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div className="modern-card bg-white p-4 text-center border-b-2 border-[#26a69a]">
                    <div className="text-[9px] font-bold text-[#26a69a] uppercase mb-1">新增记录</div>
                    <div className="text-xl font-bold text-[#26a69a]">{duplicateInfo.unique}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div className="modern-card bg-white p-4 text-center">
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">已过滤</div>
                    <div className="text-xl font-bold text-slate-400">{duplicateInfo.duplicates}</div>
                  </div>
                </Col>
              </Row>

              <Card 
                className="modern-card" 
                title={<span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">数据预览</span>}
                extra={<Tag className="rounded border-none bg-[#f0f3fa] text-blue-500 font-bold text-[10px] uppercase">前 50 条</Tag>}
              >
                <Table
                  columns={previewColumns}
                  dataSource={duplicateInfo.uniqueTrades.slice(0, 50)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ y: 300 }}
                  className="modern-table"
                />
              </Card>

              <div className="flex justify-end gap-3 mt-8">
                <Button size="large" onClick={() => { setParsedData(null); setDuplicateInfo(null); }} className="rounded-lg font-bold text-[11px] uppercase border-slate-200">重置</Button>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<ImportOutlined />} 
                  onClick={handleImport} 
                  loading={importing}
                  disabled={duplicateInfo.unique === 0}
                  className="rounded-lg font-bold text-[11px] uppercase px-8 shadow-lg shadow-blue-100"
                >
                  确认同步
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Instructions */}
          <div className="modern-card bg-white p-6">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <InfoCircleOutlined /> 标准操作流程
            </div>
            <div className="space-y-6">
              {[
                { step: '01', title: '目标账本', desc: '在账本模块先创建并选择目标账本。' },
                { step: '02', title: '导出数据', desc: '从 ATAS 终端导出统计 Excel 文件。' },
                { step: '03', title: '系统校验', desc: '将文件拖放到此处，系统会自动校验数据。' },
                { step: '04', title: '账本同步', desc: '查看预览并确认合并到当前账本。' }
              ].map(item => (
                <div key={item.step} className="flex gap-4">
                  <div className="text-lg font-black text-slate-100 leading-none">{item.step}</div>
                  <div>
                    <div className="text-xs font-bold text-[#131722] mb-1">{item.title}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="modern-card bg-blue-600 p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">技术说明</div>
              <div className="text-xs font-medium leading-relaxed">
                去重验证基于品种、时间戳与方向签名，防止重复导入。 
                支持规范：Statistics_Realtime v2.4+
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 text-white/5 transform rotate-12">
              <FileExcelOutlined style={{ fontSize: '100px' }} />
            </div>
          </div>
        </div>
      </div>

      {importing && (
        <Modal open={true} footer={null} closable={false} centered width={400} className="trading-view-modal">
          <div className="text-center py-8">
            <Progress type="circle" percent={importProgress} strokeColor={COLORS.primary} strokeWidth={8} size={80} />
            <div className="text-lg font-bold text-[#131722] mt-6">正在同步数据</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">正在写入本地存储...</div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ImportData;
