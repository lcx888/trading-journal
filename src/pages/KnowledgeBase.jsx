/**
 * 成长知识库 - 交易智慧积累
 */
import { useState, useEffect, useMemo } from 'react';
import { Input, Spin, Empty, Tag, Button, Drawer, message, Popconfirm } from 'antd';
import {
  SearchOutlined,
  BookOutlined,
  PushpinOutlined,
  PushpinFilled,
  DeleteOutlined,
  EditOutlined,
  CalendarOutlined,
  TagOutlined,
  LoadingOutlined,
  CloseOutlined,
  CheckOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiRequest } from '../services/api';
import RichEditor from '../components/RichEditor';

// 交易技术分类颜色映射 - 优化后的配色方案（更柔和、更统一）
const CATEGORY_COLORS = {
  // 核心交易行为（绿色系）
  '突破成功': '#10B981',
  '回调做多': '#34D399',
  '趋势跟踪': '#059669',
  '供需区域': '#6EE7B7',
  
  // 风险与亏损（红色/橙色系）
  '突破失败': '#EF4444',
  '回调做空': '#F87171',
  '止损管理': '#DC2626',
  '过度交易': '#B91C1C',
  '假突破': '#F97316',
  '情绪控制': '#FB923C',
  
  // 策略与系统（蓝色/紫色系）
  '均值回归': '#3B82F6',
  '区间震荡': '#60A5FA',
  '开盘策略': '#2563EB',
  '交易系统': '#1D4ED8',
  '反转信号': '#8B5CF6',
  '尾盘策略': '#A78BFA',
  
  // 其他（中性色/特殊色）
  '缺口交易': '#EC4899',
  '动量交易': '#F59E0B',
  '关键位测试': '#6366F1',
  '仓位管理': '#06B6D4',
  '复盘总结': '#D4AF37',
  '其他': '#6B7280',
  '未分类': '#9CA3AF',
};

const KnowledgeBase = () => {
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // 新增状态

  useEffect(() => {
    loadEntries();
  }, [activeCategory]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (searchText) params.set('search', searchText);
      const data = await apiRequest(`/knowledge?${params.toString()}`);
      setEntries(data.entries || []);
      setCategories(data.categories || {});
      setTotal(data.total || 0);
    } catch (e) {
      console.error('加载知识库失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadEntries();
  };

  const openDetail = async (entry) => {
    setDetailLoading(true);
    setSelectedEntry(entry);
    try {
      const full = await apiRequest(`/knowledge/${entry.id}`);
      setSelectedEntry(full);
      setEditContent(full.content);
      setEditTitle(full.title);
      setEditTags((full.tags || '').split(',').map(t => t.trim()).filter(Boolean));
    } catch (e) {
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePin = async (id, isPinned) => {
    try {
      await apiRequest(`/knowledge/${id}`, { method: 'PATCH', body: { isPinned: !isPinned } });
      loadEntries();
      if (selectedEntry?.id === id) setSelectedEntry(prev => ({ ...prev, isPinned: !isPinned }));
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiRequest(`/knowledge/${id}`, { method: 'DELETE' });
      message.success('已删除');
      setSelectedEntry(null);
      loadEntries();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry && !isCreating) return;
    
    try {
      const newTags = editTags.join(',');
      
      if (isCreating) {
        // 创建新条目
        await apiRequest('/knowledge', {
          method: 'POST',
          body: {
            title: editTitle || '未命名知识',
            content: editContent,
            tags: newTags,
            sourceType: 'manual',
            sourceDate: dayjs().format('YYYY-MM-DD'),
          }
        });
        message.success('创建成功');
        setIsCreating(false);
        setEditing(false);
        setSelectedEntry(null);
      } else {
        // 更新现有条目
        await apiRequest(`/knowledge/${selectedEntry.id}`, { 
          method: 'PATCH', 
          body: { title: editTitle, content: editContent, tags: newTags } 
        });
        message.success('已保存');
        setEditing(false);
        setSelectedEntry(prev => ({ ...prev, title: editTitle, content: editContent, tags: newTags }));
      }
      loadEntries();
    } catch (e) {
      message.error(isCreating ? '创建失败' : '保存失败');
    }
  };

  const [createStep, setCreateStep] = useState('template'); // 'template' | 'edit'
  
  const TEMPLATES = [
    { key: 'blank', icon: '📝', title: '空白文档', desc: '从零开始写', content: '' },
    { key: 'trade_note', icon: '📈', title: '交易笔记', desc: '记录一次具体交易', content: '<h2>交易概述</h2><p>品种 / 方向 / 时间段</p><h2>入场逻辑</h2><p>是什么信号触发了入场？</p><h2>出场分析</h2><p>出场是否按计划执行？</p><h2>关键收获</h2><p>这笔交易教会了我什么？</p>' },
    { key: 'strategy', icon: '🎯', title: '策略记录', desc: '沉淀一套交易策略', content: '<h2>策略名称</h2><p></p><h2>适用市场环境</h2><p>趋势 / 震荡 / 波动率高低</p><h2>入场条件 (If)</h2><ol><li>条件1</li><li>条件2</li></ol><h2>出场规则 (Then)</h2><ol><li>止损：</li><li>止盈：</li></ol><h2>仓位管理</h2><p></p><h2>注意事项</h2><p></p>' },
    { key: 'market', icon: '🌍', title: '市场观察', desc: '记录市场洞察', content: '<h2>市场状态</h2><p>日期 / 品种 / 波动率环境</p><h2>关键价位</h2><p>支撑位 / 阻力位 / POC</p><h2>观察到的规律</h2><p></p><h2>未来关注点</h2><p></p>' },
    { key: 'mistake', icon: '⚠️', title: '错误复盘', desc: '记录并避免重复犯错', content: '<h2>错误描述</h2><p>发生了什么？</p><h2>根本原因</h2><p>为什么会犯这个错？（情绪？认知？执行？）</p><h2>损失评估</h2><p>造成了多少损失？</p><h2>预防规则</h2><p><strong>If</strong> 出现...情况 → <strong>Then</strong> 必须...</p>' },
    { key: 'rule', icon: '📐', title: '交易规则', desc: '写入个人规则手册', content: '<h2>规则名称</h2><p></p><h2>规则内容</h2><p><strong>触发条件：</strong></p><p><strong>执行动作：</strong></p><p><strong>例外情况：</strong></p><h2>规则来源</h2><p>是什么经历让我制定了这条规则？</p>' },
  ];

  const handleCreate = () => {
    setEditTitle('');
    setEditContent('');
    setEditTags([]);
    setCreateStep('template');
    setSelectedEntry({ 
      title: '', content: '', category: '未分类', 
      sourceDate: dayjs().format('YYYY-MM-DD'), isNew: true 
    });
    setIsCreating(true);
    setEditing(true);
  };

  const applyTemplate = (tpl) => {
    setEditContent(tpl.content);
    setCreateStep('edit');
  };

  const filteredEntries = useMemo(() => {
    if (!searchText) return entries;
    const kw = searchText.toLowerCase();
    return entries.filter(e =>
      e.title.toLowerCase().includes(kw) ||
      (e.summary || '').toLowerCase().includes(kw) ||
      (e.tags || '').toLowerCase().includes(kw)
    );
  }, [entries, searchText]);

  const categoryList = useMemo(() => {
    return Object.entries(categories).sort((a, b) => b[1] - a[1]);
  }, [categories]);

  return (
    <div className="max-w-[1600px] mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOutlined style={{ color: '#8B5CF6' }} />
            成长知识库
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            每次复盘的 AI 知识文档自动归档于此 · 共 {total} 篇
          </p>
        </div>
        <Input
          placeholder="搜索知识..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 260, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 8 }}
          allowClear
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreate}
          style={{ 
            background: 'var(--color-brand)', 
            borderColor: 'var(--color-brand)', 
            color: '#000', 
            fontWeight: 600 
          }}
        >
          添加知识
        </Button>
      </div>

      {/* 分类标签栏 - 优化间距和视觉 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tag
          onClick={() => setActiveCategory('all')}
          style={{
            cursor: 'pointer', borderRadius: 16, padding: '4px 16px', fontSize: 13, fontWeight: 500,
            background: activeCategory === 'all' ? 'var(--text-primary)' : 'var(--bg-tertiary)',
            color: activeCategory === 'all' ? 'var(--bg-primary)' : 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            transition: 'all 0.2s',
          }}
        >
          全部 {total}
        </Tag>
        {categoryList.map(([cat, count]) => (
          <Tag
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              cursor: 'pointer', borderRadius: 16, padding: '4px 12px', fontSize: 12, fontWeight: 500,
              background: activeCategory === cat ? `${CATEGORY_COLORS[cat] || '#6B7280'}20` : 'var(--bg-tertiary)',
              color: activeCategory === cat ? (CATEGORY_COLORS[cat] || '#6B7280') : 'var(--text-secondary)',
              border: activeCategory === cat ? `1px solid ${CATEGORY_COLORS[cat] || '#6B7280'}40` : '1px solid var(--border-primary)',
              transition: 'all 0.2s',
            }}
          >
            {cat} {count}
          </Tag>
        ))}
      </div>

      {/* 内容区 */}
      {loading ? (
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: '#8B5CF6' }} spin />} />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div style={{ padding: 80 }}>
          <Empty
            description={
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {searchText ? '没有找到匹配的知识' : '知识库为空'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {searchText ? '换个关键词试试' : '在复盘页面生成 AI 知识文档后保存，将自动归档到这里'}
                </div>
              </div>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {filteredEntries.map(entry => (
            <div
              key={entry.id}
              onClick={() => openDetail(entry)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 16,
                padding: 24,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.borderColor = 'var(--border-hover)'; 
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.borderColor = 'var(--border-primary)'; 
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {entry.isPinned && (
                <div style={{ 
                  position: 'absolute', top: 0, right: 0, 
                  padding: '4px 8px', 
                  background: 'rgba(234, 179, 8, 0.15)', 
                  borderBottomLeftRadius: 12,
                  borderTopRightRadius: 16,
                  color: 'var(--color-brand)'
                }}>
                  <PushpinFilled style={{ fontSize: 12 }} />
                </div>
              )}
              
              <div style={{ marginBottom: 16 }}>
                <Tag style={{
                  margin: 0, borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none',
                  background: `${CATEGORY_COLORS[entry.category] || '#6B7280'}15`,
                  color: CATEGORY_COLORS[entry.category] || '#6B7280',
                  padding: '2px 8px',
                }}>
                  {entry.category}
                </Tag>
              </div>

              <h3 style={{ 
                fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', 
                marginBottom: 12, lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
              }}>
                {entry.title}
              </h3>
              
              {entry.summary && (
                <p style={{ 
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16, flex: 1,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                  {entry.summary}
                </p>
              )}
              
              <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {entry.sourceDate || dayjs(entry.createdAt).format('YYYY-MM-DD')}
                </span>
                {entry.tags && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {entry.tags.split(',').slice(0, 2).filter(Boolean).map(tag => (
                      <span key={tag} style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>#{tag.trim()}</span>
                    ))}
                    {entry.tags.split(',').length > 2 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>...</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 详情抽屉 - 铺满右侧 */}
      <Drawer
        open={!!selectedEntry}
        onClose={() => { 
          if (isCreating) {
            Modal.confirm({
              title: '确认放弃？',
              content: '当前内容未保存，是否确认放弃创建？',
              onOk: () => {
                setSelectedEntry(null); 
                setEditing(false);
                setIsCreating(false);
              }
            });
          } else {
            setSelectedEntry(null); 
            setEditing(false); 
          }
        }}
        placement="right"
        width="calc(100vw - 240px)"
        closable={false}
        styles={{
          header: { display: 'none' },
          body: { padding: 0, background: 'var(--bg-primary)' },
          wrapper: { boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' },
        }}
        className="knowledge-detail-drawer"
      >
        {selectedEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* ===== 创建模式 - 选模板步骤 ===== */}
            {isCreating && createStep === 'template' ? (
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div style={{ maxWidth: 640, width: '100%' }}>
                  <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>添加新知识</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>选择一个模板快速开始，或从空白文档写起</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {TEMPLATES.map(tpl => (
                      <div
                        key={tpl.key}
                        onClick={() => applyTemplate(tpl)}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 12,
                          padding: 20,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'center',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{tpl.icon}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{tpl.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tpl.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <Button type="text" onClick={() => { setSelectedEntry(null); setIsCreating(false); setEditing(false); }}
                      style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
            <>
            {/* ===== 顶部操作栏 ===== */}
            <div style={{ 
              padding: '12px 24px', 
              borderBottom: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button type="text" icon={<CloseOutlined />} 
                  onClick={() => { 
                    if (isCreating && editContent) {
                      if (window.confirm('内容未保存，确认放弃？')) {
                        setSelectedEntry(null); setEditing(false); setIsCreating(false);
                      }
                    } else {
                      setSelectedEntry(null); setEditing(false); setIsCreating(false);
                    }
                  }}
                  style={{ color: 'var(--text-secondary)' }} />
                {isCreating && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>新建知识</span>}
                {!isCreating && (
                  <>
                    <Tag style={{ margin: 0, borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none',
                      background: `${CATEGORY_COLORS[selectedEntry.category] || '#6B7280'}15`,
                      color: CATEGORY_COLORS[selectedEntry.category] || '#6B7280' }}>
                      {selectedEntry.category}
                    </Tag>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      <CalendarOutlined /> {selectedEntry.sourceDate || dayjs(selectedEntry.createdAt).format('YYYY-MM-DD')}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!isCreating && (
                  <Button type="text" size="small" 
                    icon={selectedEntry.isPinned ? <PushpinFilled style={{ color: 'var(--color-brand)' }} /> : <PushpinOutlined />}
                    onClick={() => handlePin(selectedEntry.id, selectedEntry.isPinned)} />
                )}
                {editing ? (
                  <>
                    <Button size="small" onClick={() => {
                      if (isCreating) { setSelectedEntry(null); setEditing(false); setIsCreating(false); }
                      else { setEditing(false); }
                    }} style={{ borderRadius: 6 }}>取消</Button>
                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleSaveEdit}
                      style={{ background: 'var(--color-brand)', borderColor: 'var(--color-brand)', color: '#000', borderRadius: 6, fontWeight: 600 }}>
                      {isCreating ? '发布' : '保存'}
                    </Button>
                  </>
                ) : (
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditing(true)} style={{ color: 'var(--text-secondary)' }} />
                )}
                {!isCreating && (
                  <Popconfirm title="确认删除？" onConfirm={() => handleDelete(selectedEntry.id)} okText="删除" cancelText="取消">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </div>
            </div>

            {/* 标题 + 标签 + 正文 — 统一滚动区 */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: '900px' }}>
                {/* 标题 */}
                <div style={{ padding: '24px 40px 0' }}>
                  {editing ? (
                    <Input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="文档标题..."
                      variant="borderless"
                      style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', padding: '0 0 12px', background: 'transparent', width: '100%' }}
                    />
                  ) : (
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', lineHeight: 1.4 }}>
                      {selectedEntry.title}
                    </h1>
                  )}

                  {/* 标签区 - 编辑模式支持增删 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 20, borderBottom: '1px solid var(--border-primary)' }}>
                    <TagOutlined style={{ color: 'var(--text-tertiary)', fontSize: 11 }} />
                    {(editing ? editTags : (selectedEntry.tags || '').split(',').filter(Boolean).map(t => t.trim())).map(tag => (
                      <Tag
                        key={tag}
                        closable={editing}
                        onClose={e => { e.preventDefault(); setEditTags(editTags.filter(t => t !== tag)); }}
                        style={{
                          margin: 0, fontSize: 11, borderRadius: 4,
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        #{tag}
                      </Tag>
                    ))}
                    {editing && (
                      tagInputVisible ? (
                        <Input
                          autoFocus
                          size="small"
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onBlur={() => {
                            if (tagInput.trim() && !editTags.includes(tagInput.trim())) {
                              setEditTags([...editTags, tagInput.trim()]);
                            }
                            setTagInput('');
                            setTagInputVisible(false);
                          }}
                          onPressEnter={() => {
                            if (tagInput.trim() && !editTags.includes(tagInput.trim())) {
                              setEditTags([...editTags, tagInput.trim()]);
                            }
                            setTagInput('');
                            setTagInputVisible(false);
                          }}
                          style={{ width: 100, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 4, fontSize: 11 }}
                        />
                      ) : (
                        <Tag
                          onClick={() => setTagInputVisible(true)}
                          style={{
                            margin: 0, cursor: 'pointer', borderRadius: 4, fontSize: 11,
                            background: 'transparent',
                            border: '1px dashed var(--border-secondary)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          <PlusOutlined /> 添加标签
                        </Tag>
                      )
                    )}
                    {!editing && (!selectedEntry.tags || selectedEntry.tags.trim() === '') && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>暂无标签</span>
                    )}
                  </div>
                </div>

                {/* 文档正文 - 铺满全宽 */}
                <div style={{ padding: editing ? '20px 40px' : '28px 40px' }}>
                  {detailLoading ? (
                    <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" /></div>
                  ) : editing ? (
                    <RichEditor value={editContent} onChange={setEditContent} minHeight={400} />
                  ) : (
                    <div
                      className="ai-report-minimal"
                      style={{ lineHeight: 1.9, fontSize: 15 }}
                      dangerouslySetInnerHTML={{ __html: selectedEntry.content }}
                    />
                  )}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}
      </Drawer>

      <style>{`
        .knowledge-detail-drawer .ant-drawer-content {
          background: var(--bg-primary) !important;
        }
        @media (max-width: 768px) {
          .knowledge-detail-drawer .ant-drawer-content-wrapper {
            width: 100vw !important;
          }
        }
      `}</style>
    </div>
  );
};

export default KnowledgeBase;
