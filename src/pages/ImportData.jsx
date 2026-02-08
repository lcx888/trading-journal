import { useState, useEffect } from 'react';
import { 
  Upload, Button, message, Table, Tag, Row, Col,
  Modal, Progress, Select, Empty
} from 'antd';
import {
  CheckCircleOutlined,
  FileExcelOutlined,
  ImportOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  InfoCircleOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { parseATASFile, checkDuplicates } from '../services/atasParser';
import { parseJigsawFile, checkJigsawDuplicates, detectFileType } from '../services/jigsawParser';
import StorageService from '../services/storage';
import { checkUsageLimit } from '../services/subscription';
import { UpgradeModal } from '../components/UpgradePrompt';

const { Dragger } = Upload;

const ImportData = ({ onImportSuccess, selectedRecordId, onNavigateToRecords, onShowUpgrade }) => {
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [fileType, setFileType] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const [records, setRecords] = useState([]);
  const [currentRecordId, setCurrentRecordId] = useState(selectedRecordId || null);
  const [loadingRecords, setLoadingRecords] = useState(true);
  
  // 移动端检测
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    setFileType(null);
    try {
      const detectedType = await detectFileType(file);
      setFileType(detectedType);
      
      let result;
      let duplicateCheck;
      
      if (detectedType === 'jigsaw') {
        result = await parseJigsawFile(file);
        duplicateCheck = await checkJigsawDuplicates(result.trades);
        message.info('检测到 Jigsaw RTP 格式');
      } else {
        result = await parseATASFile(file);
        duplicateCheck = await checkDuplicates(result.trades);
        if (detectedType === 'atas') {
          message.info('检测到 ATAS 格式');
        }
      }
      
      if (result.trades.length === 0) {
        message.warning('文件中未检测到交易');
        return;
      }
      
      const { duplicates, unique } = duplicateCheck;
      setParsedData({ ...result, fileType: detectedType });
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
    
    // 检查交易导入用量限制（免费用户）
    const usageCheck = await checkUsageLimit('trades');
    if (!usageCheck.allowed) {
      setShowUpgradeModal(true);
      message.warning(`本月交易导入额度已用完 (${usageCheck.used}/${usageCheck.limit})，请升级解锁无限导入`);
      return;
    }
    
    // 检查导入数量是否会超过限制
    if (usageCheck.limit !== -1 && usageCheck.remaining !== Infinity) {
      const tradesToImportCount = duplicateInfo.unique;
      if (tradesToImportCount > usageCheck.remaining) {
        message.warning(`本月剩余额度 ${usageCheck.remaining} 笔，本次导入 ${tradesToImportCount} 笔将超出限制。升级 Pro 可解锁无限导入。`);
        setShowUpgradeModal(true);
        return;
      }
    }
    
    setImporting(true);
    setImportProgress(0);
    try {
      const tradesToImport = duplicateInfo.uniqueTrades.map(t => ({ 
        ...t, 
        recordId: currentRecordId,
        source: parsedData?.fileType || fileType || 'atas',
      }));
      // 分批上传进度
      const totalCount = tradesToImport.length;
      const BATCH_SIZE = 50;
      let uploaded = 0;
      for (let i = 0; i < totalCount; i += BATCH_SIZE) {
        const batch = tradesToImport.slice(i, i + BATCH_SIZE);
        await StorageService.addTrades(batch);
        uploaded += batch.length;
        setImportProgress(Math.min(Math.round(uploaded / totalCount * 90), 90));
      }
      setImportProgress(92);
      await StorageService.refreshRecordStats(currentRecordId);
      setImportProgress(96);
      await StorageService.addImportRecord({
        filename: parsedData.filename,
        importDate: new Date(),
        tradesCount: tradesToImport.length,
        totalPnL: tradesToImport.reduce((sum, t) => sum + (t.pnl || 0), 0),
        recordId: currentRecordId,
        recordName: getCurrentRecord()?.name,
        fileType: parsedData?.fileType || fileType || 'atas',
      });
      setImportProgress(100);
      message.success('数据同步成功');
      setTimeout(() => {
        setParsedData(null);
        setDuplicateInfo(null);
        setFileType(null);
        onImportSuccess?.();
      }, 800);
    } catch (e) { message.error(`同步失败：${e.message}`); }
    finally { setImporting(false); }
  };

  const getPreviewColumns = () => {
    const baseColumns = [
      { 
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>时间</span>, 
        dataIndex: 'openTime', 
        width: 110, 
        render: t => <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{dayjs(t).format('MM/DD HH:mm')}</span> 
      },
      { 
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>品种</span>, 
        dataIndex: 'instrumentCode', 
        width: 70, 
        render: c => <Tag style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', borderRadius: 2, fontWeight: 600, fontSize: 11 }}>{c}</Tag> 
      },
      { 
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>方向</span>, 
        dataIndex: 'direction', 
        width: 50, 
        render: d => <span style={{ fontSize: 11, fontWeight: 700, color: d === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)' }}>{d === 'LONG' ? '多' : '空'}</span> 
      },
      { 
        title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>价格</span>, 
        dataIndex: 'openPrice', 
        width: 80, 
        align: 'right', 
        render: p => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{p?.toFixed(2)}</span> 
      },
    ];
    
    if (fileType === 'jigsaw') {
      baseColumns.push(
        { 
          title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MAE</span>, 
          dataIndex: ['jigsawData', 'mae'], 
          width: 50, 
          align: 'right', 
          render: v => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-loss)' }}>{v || 0}</span> 
        },
        { 
          title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>MFE</span>, 
          dataIndex: ['jigsawData', 'mfe'], 
          width: 50, 
          align: 'right', 
          render: v => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-profit)' }}>{v || 0}</span> 
        },
        { 
          title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>成交</span>, 
          dataIndex: ['jigsawData', 'fills'], 
          width: 45, 
          align: 'right', 
          render: v => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{v || 0}</span> 
        },
      );
    }
    
    baseColumns.push({
      title: <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>盈亏</span>, 
      dataIndex: 'pnl', 
      width: 80, 
      align: 'right', 
      render: p => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: p >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>{p >= 0 ? '+' : ''}{p?.toFixed(2)}</span>
    });
    
    return baseColumns;
  };
  
  const previewColumns = getPreviewColumns();

  // 空状态
  if (!loadingRecords && records.length === 0) {
    return (
      <div style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6, 
        padding: 64, 
        textAlign: 'center', 
        maxWidth: 480, 
        margin: '0 auto' 
      }}>
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>需要先创建账本</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>导入数据前请先创建交易账本</div>
              <Button 
                type="primary" 
                size="large" 
                icon={<PlusOutlined />} 
                onClick={() => onNavigateToRecords?.()}
                style={{ 
                  background: 'var(--color-brand)', 
                  borderColor: 'var(--color-brand)', 
                  color: 'var(--bg-primary)',
                  fontWeight: 600,
                  borderRadius: 4,
                  marginTop: 8
                }}
              >
                创建账本
              </Button>
            </div>
          } 
        />
      </div>
    );
  }

  // 统计卡片组件
  const StatCard = ({ label, value, color, highlight }) => (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 6,
      padding: 16,
      textAlign: 'center',
      borderBottom: highlight ? `3px solid ${highlight}` : undefined
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: color || 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 目标账本选择器 */}
      <div style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-primary)', 
        borderRadius: 6, 
        padding: 20 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ 
                fontSize: 10, 
                fontWeight: 600, 
                color: 'var(--text-secondary)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em', 
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <FolderOpenOutlined style={{ color: 'var(--color-brand)' }} />
                目标账本
            </div>
              <div style={{ display: 'flex', gap: 8 }}>
              <Select
                placeholder="选择本次导入的目标账本..."
                value={currentRecordId}
                onChange={setCurrentRecordId}
                size="large"
                  style={{ flex: 1 }}
                options={records.map(r => ({ value: r.id, label: r.name }))}
              />
                <Button 
                  icon={<PlusOutlined />} 
                  onClick={() => onNavigateToRecords?.()} 
                  style={{ 
                    height: 40, 
                    borderColor: 'var(--border-primary)', 
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: 11,
                    borderRadius: 4
                  }}
                >
                  新建
                </Button>
              </div>
            </div>
            
          {currentRecordId && getCurrentRecord() && (
              <div style={{ 
                background: 'var(--color-brand-bg)', 
                border: '1px solid var(--border-primary)', 
                borderRadius: 6, 
                padding: 16, 
                minWidth: 220 
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand)', textTransform: 'uppercase', marginBottom: 4 }}>目标概览</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{getCurrentRecord().name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{getCurrentRecord().tradeCount || 0} 笔交易</span>
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 700, 
                    fontFamily: 'var(--font-mono)',
                    color: (getCurrentRecord().totalPnL || 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' 
                  }}>
                    {(getCurrentRecord().totalPnL || 0) >= 0 ? '+' : ''}{(getCurrentRecord().totalPnL || 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
            </div>
            
      <div style={{ display: 'grid', flexDirection: 'column', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 上传区域 */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: 6, 
            padding: 24,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 0 }}>
                <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>数据导入引擎</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>导入交易数据</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>支持 ATAS / Jigsaw RTP 格式</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ 
                  padding: '4px 12px', 
                  borderRadius: 4, 
                  border: `1px solid ${currentRecordId ? 'var(--color-profit)' : 'var(--border-primary)'}`,
                  color: currentRecordId ? 'var(--color-profit)' : 'var(--text-tertiary)',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  {currentRecordId ? '系统就绪' : '待机'}
                </div>
                {fileType && (
                  <div style={{ 
                    padding: '4px 12px', 
                    borderRadius: 4, 
                    background: fileType === 'jigsaw' ? 'var(--color-brand-bg)' : 'var(--color-profit-bg)',
                    color: fileType === 'jigsaw' ? 'var(--color-brand)' : 'var(--color-profit)',
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                      {fileType === 'jigsaw' ? 'Jigsaw RTP' : 'ATAS'}
                    </div>
                  )}
                </div>
              </div>

              <Dragger
                name="file"
                multiple={false}
                accept=".xlsx,.xls"
                beforeUpload={handleFileParse}
                showUploadList={false}
                disabled={parsing || importing || !currentRecordId}
              style={{
                background: currentRecordId ? 'var(--color-brand-bg)' : 'var(--bg-tertiary)',
                border: `2px dashed ${currentRecordId ? 'var(--color-brand)' : 'var(--border-primary)'}`,
                borderRadius: 8,
                padding: '48px 24px',
                cursor: currentRecordId ? 'pointer' : 'not-allowed',
                opacity: currentRecordId ? 1 : 0.5,
                transition: 'all 0.2s'
              }}
              >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 12, 
                  background: currentRecordId ? 'var(--color-brand)' : 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16
                }}>
                  <CloudUploadOutlined style={{ fontSize: 24, color: currentRecordId ? 'var(--bg-primary)' : 'var(--text-tertiary)' }} />
                    </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: currentRecordId ? 'var(--text-primary)' : 'var(--text-tertiary)', marginBottom: 4 }}>
                  {currentRecordId ? '将交易数据拖放到此处' : '请先选择目标账本'}
                      </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    自动识别 ATAS / Jigsaw 格式
                  </div>
                </div>
              </Dragger>

              {parsing && (
              <div style={{ 
                position: 'absolute', 
                inset: 0, 
                background: 'rgba(24, 26, 32, 0.9)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                zIndex: 10
              }}>
                <div style={{ width: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>正在扫描...</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>哈希校验通过</span>
                    </div>
                    <Progress 
                      percent={85} 
                      status="active" 
                      showInfo={false} 
                    strokeColor="var(--color-brand)" 
                    trailColor="var(--bg-tertiary)"
                      strokeWidth={4}
                    />
                  </div>
                </div>
              )}
          </div>

          {/* 解析结果 */}
          {parsedData && duplicateInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 文件类型指示 */}
              {fileType && (
                <div style={{ 
                  background: fileType === 'jigsaw' ? 'var(--color-brand-bg)' : 'var(--color-profit-bg)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 6,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16
                }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 8, 
                    background: fileType === 'jigsaw' ? 'var(--color-brand)' : 'var(--color-profit)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileExcelOutlined style={{ color: 'var(--bg-primary)', fontSize: 18 }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {fileType === 'jigsaw' ? 'Jigsaw RTP-Positions' : 'ATAS Statistics'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {fileType === 'jigsaw' 
                        ? '包含 MAE/MFE 分析、成交次数等高级数据' 
                        : '标准交易日志格式'}
                    </div>
                  </div>
                </div>
              )}
              
              {/* 统计卡片 */}
              <Row gutter={16}>
                <Col span={fileType === 'jigsaw' ? 6 : 8}>
                  <StatCard label="总检测数" value={duplicateInfo.total} />
                </Col>
                <Col span={fileType === 'jigsaw' ? 6 : 8}>
                  <StatCard label="新增记录" value={duplicateInfo.unique} color="var(--color-profit)" highlight="var(--color-profit)" />
                </Col>
                <Col span={fileType === 'jigsaw' ? 6 : 8}>
                  <StatCard label="已过滤" value={duplicateInfo.duplicates} />
                </Col>
                {fileType === 'jigsaw' && (
                  <Col span={6}>
                    <StatCard 
                      label="平均 MFE/MAE" 
                      value={(() => {
                          const trades = duplicateInfo.uniqueTrades;
                          const totalMFE = trades.reduce((s, t) => s + (t.jigsawData?.mfe || 0), 0);
                          const totalMAE = trades.reduce((s, t) => s + (t.jigsawData?.mae || 0), 0);
                          const avgMFE = trades.length ? (totalMFE / trades.length).toFixed(1) : 0;
                          const avgMAE = trades.length ? (totalMAE / trades.length).toFixed(1) : 0;
                          return `${avgMFE}/${avgMAE}`;
                        })()}
                      color="var(--color-brand)"
                      highlight="var(--color-brand)"
                    />
                  </Col>
                )}
              </Row>

              {/* 数据预览表格 */}
              <div style={{ 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderRadius: 6,
                overflow: 'hidden'
              }}>
                <div style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>数据预览</span>
                  <Tag style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', borderRadius: 2, fontSize: 10, fontWeight: 600 }}>前 50 条</Tag>
                </div>
                <Table
                  columns={previewColumns}
                  dataSource={duplicateInfo.uniqueTrades.slice(0, 50)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ y: 280 }}
                  className="binance-table"
                />
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <Button 
                  size="large" 
                  onClick={() => { setParsedData(null); setDuplicateInfo(null); setFileType(null); }}
                  style={{ 
                    borderColor: 'var(--border-primary)', 
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: 12,
                    borderRadius: 4
                  }}
                >
                  重置
                </Button>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<ImportOutlined />} 
                  onClick={handleImport} 
                  loading={importing}
                  disabled={duplicateInfo.unique === 0}
                  style={{ 
                    background: 'var(--color-brand)', 
                    borderColor: 'var(--color-brand)', 
                    color: 'var(--bg-primary)',
                    fontWeight: 600,
                    fontSize: 12,
                    borderRadius: 4,
                    paddingLeft: 24,
                    paddingRight: 24
                  }}
                >
                  确认同步
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧说明栏 - 移动端改为水平排列的卡片 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexWrap: 'nowrap' }}>
          {/* 操作流程 */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: 6, 
            padding: 20,
            flex: 'none'
          }}>
            <div style={{ 
              fontSize: 10, 
              fontWeight: 600, 
              color: 'var(--text-secondary)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em', 
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <InfoCircleOutlined style={{ color: 'var(--color-brand)' }} />
              标准操作流程
            </div>
            <div style={{ display: 'flex', gridTemplateColumns: 'none', flexDirection: 'column', gap: 20 }}>
              {[
                { step: '01', title: '目标账本', desc: '选择目标账本' },
                { step: '02', title: '导出数据', desc: '从软件导出记录' },
                { step: '03', title: '自动识别', desc: '系统自动解析' },
                { step: '04', title: '账本同步', desc: '确认合并数据' }
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--bg-tertiary)', lineHeight: 1 }}>{item.step}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 支持格式 */}
          <div style={{ 
            background: 'var(--color-brand)', 
            borderRadius: 6, 
            padding: 20,
            position: 'relative',
            overflow: 'hidden',
            flex: 'none'
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(24, 26, 32, 0.6)', marginBottom: 8 }}>支持格式</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--bg-primary)', lineHeight: 1.8 }}>
                <div><strong>ATAS：</strong>Statistics_Realtime.xlsx</div>
                <div><strong>Jigsaw：</strong>RTP-Positions.xls</div>
              </div>
              {true && (
                <div style={{ fontSize: 10, color: 'rgba(24, 26, 32, 0.7)', marginTop: 12 }}>
                  Jigsaw 独有：MAE/MFE 分析、成交次数统计
                </div>
              )}
            </div>
            <FileExcelOutlined style={{ 
              position: 'absolute', 
              right: -10, 
              bottom: -10, 
              fontSize: 80, 
              color: 'rgba(24, 26, 32, 0.1)',
              transform: 'rotate(12deg)'
            }} />
          </div>
        </div>
      </div>

      {/* 导入进度弹窗 */}
      {importing && (
        <Modal open={true} footer={null} closable={false} centered width={360}>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Progress type="circle" percent={importProgress} strokeColor="var(--color-brand)" trailColor="var(--bg-tertiary)" strokeWidth={8} size={72} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 24 }}>正在同步数据</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>正在保存到服务器...</div>
          </div>
        </Modal>
      )}

      {/* 升级提示弹窗 */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureKey="trades"
        onUpgrade={() => {
          setShowUpgradeModal(false);
          onShowUpgrade?.('trades');
        }}
      />
    </div>
  );
};

export default ImportData;
