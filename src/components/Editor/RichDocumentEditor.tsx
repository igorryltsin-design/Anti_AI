import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { useEffect } from 'react'
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Undo,
    Redo,
    Highlighter,
    Table2,
    Rows3,
    Columns3,
    Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SuspiciousDecorations, type SuspiciousHighlightRange } from '@/components/Editor/suspiciousDecorations'
import { getProseMirrorTextAndMap } from '@/lib/proseMirrorTextMap'

function ToolbarButton({
    onClick,
    isActive,
    disabled,
    children,
    title,
}: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                'rounded-md p-2 transition-colors',
                isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed'
            )}
        >
            {children}
        </button>
    )
}

function EditorToolbar({ editor }: { editor: Editor }) {
    return (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-2">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Жирный"
            >
                <Bold className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Курсив"
            >
                <Italic className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="Подчёркнутый"
            >
                <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Зачёркнутый"
            >
                <Strikethrough className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                isActive={editor.isActive('highlight')}
                title="Выделение"
            >
                <Highlighter className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Заголовок 1"
            >
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Заголовок 2"
            >
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Заголовок 3"
            >
                <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="По левому краю"
            >
                <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="По центру"
            >
                <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="По правому краю"
            >
                <AlignRight className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Маркированный список"
            >
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Нумерованный список"
            >
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-6 w-px bg-border" />

            <ToolbarButton
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                title="Вставить таблицу 3×3"
            >
                <Table2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().addRowAfter().run()}
                disabled={!editor.can().addRowAfter()}
                title="Добавить строку"
            >
                <Rows3 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                disabled={!editor.can().addColumnAfter()}
                title="Добавить столбец"
            >
                <Columns3 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().deleteTable().run()}
                disabled={!editor.can().deleteTable()}
                title="Удалить таблицу"
            >
                <Trash2 className="h-4 w-4" />
            </ToolbarButton>

            <div className="ml-auto flex gap-1">
                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Отменить"
                >
                    <Undo className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Повторить"
                >
                    <Redo className="h-4 w-4" />
                </ToolbarButton>
            </div>
        </div>
    )
}

export function RichDocumentEditor({
    html,
    onHtmlChange,
    onTextChange,
    highlightRanges = [],
    readOnly = false,
    className,
    contentRef,
    onEditorReady,
}: {
    html: string
    onHtmlChange?: (html: string) => void
    onTextChange?: (text: string) => void
    highlightRanges?: SuspiciousHighlightRange[]
    readOnly?: boolean
    className?: string
    contentRef?: React.RefObject<HTMLDivElement | null>
    onEditorReady?: (editor: Editor | null) => void
}) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4, 5, 6] },
            }),
            Highlight.configure({ multicolor: true }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            SuspiciousDecorations,
        ],
        editorProps: {
            attributes: {
                class: 'tiptap',
            },
        },
        content: html || '<p></p>',
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            onHtmlChange?.(editor.getHTML())
            onTextChange?.(getProseMirrorTextAndMap(editor.state.doc).text)
        },
    })

    useEffect(() => {
        onEditorReady?.(editor ?? null)
        return () => onEditorReady?.(null)
    }, [editor, onEditorReady])

    useEffect(() => {
        if (!editor) return
        const next = html || '<p></p>'
        if (editor.getHTML() === next) return
        const { from, to } = editor.state.selection
        editor.commands.setContent(next, { emitUpdate: false })
        try {
            editor.commands.setTextSelection({
                from: Math.min(from, editor.state.doc.content.size),
                to: Math.min(to, editor.state.doc.content.size),
            })
        } catch {
            // ignore
        }
    }, [editor, html])

    useEffect(() => {
        editor?.setEditable(!readOnly)
    }, [editor, readOnly])

    useEffect(() => {
        if (!editor) return
        editor.commands.setSuspiciousRanges(highlightRanges)
    }, [editor, highlightRanges])

    return (
        <div className={cn('relative rounded-lg border border-border bg-card', className)}>
            {!readOnly && editor && (
                <div className="sticky top-20 z-10 border-b border-border bg-card">
                    <EditorToolbar editor={editor} />
                </div>
            )}
            <div className="p-3" ref={contentRef}>
                <EditorContent
                    editor={editor}
                    className={cn(
                        'prose prose-sm max-w-none whitespace-pre-wrap',
                        'dark:prose-invert',
                        'min-h-[400px]'
                    )}
                />
            </div>
        </div>
    )
}
