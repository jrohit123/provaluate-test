import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Undo,
  Redo
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const RichTextEditor = ({ 
  content, 
  onChange, 
  placeholder = 'Start typing your job description...',
  className,
  minHeight = '300px'
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    children, 
    disabled = false,
    title 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode;
    disabled?: boolean;
    title?: string;
  }) => (
    <Button
      type="button"
      variant={isActive ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-primary text-primary-foreground'
      )}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className={cn('border rounded-lg overflow-hidden bg-white', className)}>
      {/* Toolbar */}
      <div className="border-b bg-gray-50 p-2 flex flex-wrap items-center gap-1">
        {/* Text Formatting */}
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Highlight */}
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            title="Highlight (Ctrl+Shift+H)"
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <span className="text-xs font-bold">H1</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <span className="text-xs font-bold">H2</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <span className="text-xs font-bold">H3</span>
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content */}
      <div style={{ minHeight }} className="overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Character count */}
      <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
        {editor.storage.characterCount?.characters() || 0} characters
        {editor.storage.characterCount?.words() && ` • ${editor.storage.characterCount.words()} words`}
      </div>
    </div>
  );
};

// Helper function to extract plain text from HTML while preserving line breaks
export const extractPlainText = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // Preserve line breaks by converting HTML structure to newlines
  // Replace <p> tags with double newlines (paragraphs)
  let text = html
    .replace(/<p[^>]*>/gi, '\n\n')  // Paragraphs become double newlines
    .replace(/<\/p>/gi, '')          // Remove closing paragraph tags
    .replace(/<br\s*\/?>/gi, '\n')   // Line breaks become single newlines
    .replace(/<\/?h[1-6][^>]*>/gi, '\n\n')  // Headings become double newlines
    .replace(/<\/?li[^>]*>/gi, '\n') // List items become newlines
    .replace(/<\/?ul[^>]*>/gi, '\n') // Lists add newlines
    .replace(/<\/?ol[^>]*>/gi, '\n') // Ordered lists add newlines
    .replace(/<\/?div[^>]*>/gi, '\n') // Divs add newlines
    .replace(/<[^>]+>/g, '')          // Remove all other HTML tags
    .replace(/&nbsp;/g, ' ')          // Convert non-breaking spaces
    .replace(/&amp;/g, '&')           // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{4,}/g, '\n\n\n')    // Limit excessive newlines
    .replace(/[ \t]+/g, ' ')          // Normalize spaces (but keep newlines)
    .trim();
  
  // Fallback to textContent if the above doesn't work
  if (!text || text.length < 10) {
    text = div.textContent || div.innerText || '';
    // Try to preserve some structure from textContent
    text = text.replace(/\n\s*\n/g, '\n\n'); // Normalize paragraph breaks
  }
  
  return text;
};

// Helper function to extract highlighted text
export const extractHighlightedText = (html: string): string[] => {
  const div = document.createElement('div');
  div.innerHTML = html;
  const highlights = div.querySelectorAll('mark');
  return Array.from(highlights).map(mark => mark.textContent || '').filter(Boolean);
};
