import React, { useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Tooltip, Divider, Upload, message, Spin } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  LinkOutlined,
  UndoOutlined,
  RedoOutlined,
  MinusOutlined,
} from '@ant-design/icons';

// API 基础路径
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// 工具栏按钮组件
const ToolbarButton = ({ icon, title, active, disabled, onClick }) => (
  <Tooltip title={title}>
    <Button
      type="text"
      size="small"
      icon={icon}
      disabled={disabled}
      onClick={onClick}
      style={{
        color: active ? 'var(--color-brand)' : 'var(--text-secondary)',
        backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  </Tooltip>
);

// 编辑器工具栏
const Toolbar = ({ editor, onImageUpload, uploading }) => {
  const fileInputRef = useRef(null);

  if (!editor) return null;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await onImageUpload(file);
    }
    // 清空 input 以便可以再次选择同一文件
    e.target.value = '';
  };

  const addLink = () => {
    const url = window.prompt('输入链接地址：');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        flexWrap: 'wrap',
      }}
    >
      {/* 撤销/重做 */}
      <ToolbarButton
        icon={<UndoOutlined />}
        title="撤销"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={<RedoOutlined />}
        title="重做"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />

      <Divider type="vertical" style={{ margin: '0 4px', borderColor: 'var(--border-primary)' }} />

      {/* 文本格式 */}
      <ToolbarButton
        icon={<BoldOutlined />}
        title="加粗"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<ItalicOutlined />}
        title="斜体"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<StrikethroughOutlined />}
        title="删除线"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <Divider type="vertical" style={{ margin: '0 4px', borderColor: 'var(--border-primary)' }} />

      {/* 标题 */}
      <Tooltip title="标题1">
        <Button
          type="text"
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={{
            color: editor.isActive('heading', { level: 1 }) ? 'var(--color-brand)' : 'var(--text-secondary)',
            backgroundColor: editor.isActive('heading', { level: 1 }) ? 'var(--bg-tertiary)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            padding: '0 8px',
            height: 28,
          }}
        >
          H1
        </Button>
      </Tooltip>
      <Tooltip title="标题2">
        <Button
          type="text"
          size="small"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={{
            color: editor.isActive('heading', { level: 2 }) ? 'var(--color-brand)' : 'var(--text-secondary)',
            backgroundColor: editor.isActive('heading', { level: 2 }) ? 'var(--bg-tertiary)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
            padding: '0 8px',
            height: 28,
          }}
        >
          H2
        </Button>
      </Tooltip>

      <Divider type="vertical" style={{ margin: '0 4px', borderColor: 'var(--border-primary)' }} />

      {/* 列表 */}
      <ToolbarButton
        icon={<UnorderedListOutlined />}
        title="无序列表"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<OrderedListOutlined />}
        title="有序列表"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      <Divider type="vertical" style={{ margin: '0 4px', borderColor: 'var(--border-primary)' }} />

      {/* 分割线 */}
      <ToolbarButton
        icon={<MinusOutlined />}
        title="分割线"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      {/* 链接 */}
      <ToolbarButton
        icon={<LinkOutlined />}
        title="添加链接"
        active={editor.isActive('link')}
        onClick={addLink}
      />

      {/* 图片上传 */}
      <Tooltip title="插入图片">
        <Button
          type="text"
          size="small"
          icon={uploading ? <Spin size="small" /> : <PictureOutlined />}
          disabled={uploading}
          onClick={handleImageClick}
          style={{
            color: 'var(--text-secondary)',
            border: 'none',
            borderRadius: 4,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </Tooltip>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

// 富文本编辑器主组件
const RichEditor = ({ 
  value = '', 
  onChange, 
  placeholder = '开始记录你的复盘...',
  minHeight = 200,
  maxHeight = 400,
  readOnly = false,
}) => {
  const [uploading, setUploading] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html === '<p></p>' ? '' : html);
    },
  });

  // 图片上传处理
  const handleImageUpload = useCallback(async (file) => {
    if (!editor) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件');
      return;
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过 5MB');
      return;
    }

    setUploading(true);

    try {
      // 获取 token
      const token = localStorage.getItem('auth_token');
      
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_BASE}/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('上传失败');
      }

      const data = await response.json();
      
      // 插入图片到编辑器
      editor.chain().focus().setImage({ src: data.url }).run();
      message.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      
      // 如果服务器上传失败，使用 base64 作为备选
      const reader = new FileReader();
      reader.onload = (e) => {
        editor.chain().focus().setImage({ src: e.target.result }).run();
        message.info('图片已添加（本地模式）');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  }, [editor]);

  // 更新编辑器内容
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  return (
    <div
      style={{
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {!readOnly && (
        <Toolbar 
          editor={editor} 
          onImageUpload={handleImageUpload}
          uploading={uploading}
        />
      )}
      <EditorContent
        editor={editor}
        style={{
          minHeight,
        }}
      />
      <style>{`
        .ProseMirror {
          padding: 16px;
          outline: none;
          min-height: ${minHeight}px;
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.7;
        }
        
        .ProseMirror p {
          margin: 0 0 8px 0;
        }
        
        .ProseMirror h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 16px 0 8px 0;
          color: var(--text-primary);
        }
        
        .ProseMirror h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 14px 0 8px 0;
          color: var(--text-primary);
        }
        
        .ProseMirror h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 12px 0 6px 0;
          color: var(--text-primary);
        }
        
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 24px;
          margin: 8px 0;
        }
        
        .ProseMirror li {
          margin: 4px 0;
        }
        
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 12px 0;
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .ProseMirror img:hover {
          transform: scale(1.02);
        }
        
        .ProseMirror a {
          color: var(--color-brand);
          text-decoration: underline;
        }
        
        .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--border-primary);
          margin: 16px 0;
        }
        
        .ProseMirror blockquote {
          border-left: 3px solid var(--color-brand);
          padding-left: 16px;
          margin: 12px 0;
          color: var(--text-secondary);
        }
        
        .ProseMirror code {
          background: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 13px;
        }
        
        .ProseMirror pre {
          background: var(--bg-secondary);
          padding: 12px 16px;
          border-radius: 8px;
          overflow-x: auto;
        }
        
        .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-tertiary);
          pointer-events: none;
          height: 0;
        }
        
        .ProseMirror:focus {
          outline: none;
        }
        
        .ProseMirror strong {
          font-weight: 700;
        }
        
        .ProseMirror em {
          font-style: italic;
        }
        
        .ProseMirror s {
          text-decoration: line-through;
        }
      `}</style>
    </div>
  );
};

export default RichEditor;
