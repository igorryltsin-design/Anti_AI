import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { useCallback, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const severityRank: Record<'low' | 'medium' | 'high', number> = {
    low: 0,
    medium: 1,
    high: 2,
}

const severityPalette: Record<'low' | 'medium' | 'high', { bg: string; text: string }> = {
    low: { bg: 'rgba(234,179,8,0.18)', text: '#854d0e' },
    medium: { bg: 'rgba(249,115,22,0.22)', text: '#9a3412' },
    high: { bg: 'rgba(239,68,68,0.25)', text: '#b91c1c' },
}

interface RichTextEditorProps {
    content: string
    onChange?: (content: string) => void
    onHtmlChange?: (html: string) => void
    readOnly?: boolean
    className?: string
    highlightRanges?: { start: number; end: number; severity?: 'low' | 'medium' | 'high' }[]
    contentRef?: React.RefObject<HTMLDivElement | null>
    onEditorReady?: (editor: Editor | null) => void
}

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
    if (!editor) return null

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

export function RichTextEditor({
    content,
    onChange,
    onHtmlChange,
    readOnly = false,
    className,
    highlightRanges = [],
    contentRef,
    onEditorReady,
}: RichTextEditorProps) {
    const lastPlainRef = useRef<string>(content)

    const escapeHtml = useCallback(
        (str: string) =>
            str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;'),
        []
    )

    const buildHighlighted = useCallback((text: string) => {
        if (!highlightRanges?.length) return escapeHtml(text)

        const MIN_LENGTH = 3

        const normalized = highlightRanges
            .map(r => ({
                start: Math.max(0, Math.min(text.length, r.start)),
                end: Math.max(0, Math.min(text.length, r.end)),
                severity: (r.severity ?? 'medium') as 'low' | 'medium' | 'high',
            }))
            .filter(r => r.end > r.start && (r.end - r.start) >= MIN_LENGTH)
            .sort((a, b) => a.start - b.start)

        const merged: { start: number; end: number; severity: 'low' | 'medium' | 'high' }[] = []
        for (const range of normalized) {
            const last = merged[merged.length - 1]
            if (last && range.start <= last.end) {
                last.end = Math.max(last.end, range.end)
                if (severityRank[range.severity] > severityRank[last.severity]) {
                    last.severity = range.severity
                }
            } else {
                merged.push({ ...range })
            }
        }

        let result = ''
        let cursor = 0

        for (const range of merged) {
            if (cursor < range.start) {
                result += escapeHtml(text.slice(cursor, range.start))
            }
            const slice = escapeHtml(text.slice(range.start, range.end))
            const colors = severityPalette[range.severity] || severityPalette.medium
            result += `<mark style="background-color: ${colors.bg}; color: ${colors.text}; border-radius: 4px; padding: 0 2px; outline: none;">${slice}</mark>`
            cursor = range.end
        }

        if (cursor < text.length) {
            result += escapeHtml(text.slice(cursor))
        }

        return result
    }, [escapeHtml, highlightRanges])

    // Функция конвертации текста в HTML с сохранением пробелов
    const textToHtml = useCallback((text: string) => {
        if (!text) return '<p></p>'
        const highlighted = buildHighlighted(text)
        return highlighted
            .split('\n')
            .map(line => {
                // сохраняем завершающие пробелы в строке
                const withTrailing = line.replace(/(\s)$/g, '&nbsp;')
                return `<p>${withTrailing || '<br>'}</p>`
            })
            .join('')
    }, [buildHighlighted])

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4, 5, 6],
                },
            }),
            Highlight.configure({
                multicolor: true,
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: textToHtml(content),
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            const plain = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', ' ')
            if (plain !== lastPlainRef.current) {
                lastPlainRef.current = plain
                onChange?.(plain)
            }
            onHtmlChange?.(editor.getHTML())
        },
    })

    useEffect(() => {
        onEditorReady?.(editor ?? null)
        return () => onEditorReady?.(null)
    }, [editor, onEditorReady])

    // Update content when prop changes (only from external source)
    useEffect(() => {
        if (!editor) return
        const normalizeText = (text: string) => text.replace(/\n+/g, '\n')
        const current = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', ' ')
        const textChanged = normalizeText(content) !== normalizeText(current)
        if (!textChanged) return

        // Сохраняем позицию курсора и восстанавливаем после обновления
        const { from, to } = editor.state.selection
        editor.commands.setContent(textToHtml(content), { emitUpdate: false })
        editor.commands.setTextSelection({ from, to })
    }, [content, editor, textToHtml])

    // Перерисовываем подсветку при смене диапазонов
    useEffect(() => {
        if (!editor) return
        // Save current selection
        const { from, to } = editor.state.selection
        // Update content with highlighting
        editor.commands.setContent(textToHtml(content), { emitUpdate: false })
        // Restore selection to maintain cursor position
        try {
            editor.commands.setTextSelection({ from: Math.min(from, editor.state.doc.content.size), to: Math.min(to, editor.state.doc.content.size) })
        } catch {
            // Selection restoration failed, ignore
        }
    }, [content, editor, highlightRanges, textToHtml])

    // Update editable state
    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly)
        }
    }, [readOnly, editor])

    return (
        <div className={cn(
            'relative rounded-lg border border-border bg-card',
            className
        )}>
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
