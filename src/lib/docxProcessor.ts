// DOCX Processor - Import and Export Word Documents
// Обработка документов Word (.docx)

import mammoth from 'mammoth'
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    UnderlineType,
} from 'docx'
import { cleanText, type CleaningOptions, type CleaningResult } from './cleaningEngine'
import type { AIPattern } from './aiPatterns'
import type { DetailedCleaningSettings } from '@/store/useCleaningStore'
import { cleanHtmlPreservingTags, extractPlainTextFromHtml, isProbablyHtml } from '@/lib/htmlCleaner'

export interface DocxImportResult {
    html: string
    text: string
    messages: string[]
    success: boolean
    error?: string
}

export interface ProcessedDocument {
    originalHtml: string
    cleanedHtml: string
    originalText: string
    cleanedText: string
    cleaningResult: CleaningResult
    fileName: string
}

/**
 * Import a .docx file and convert to HTML
 */
export async function importDocx(file: File): Promise<DocxImportResult> {
    try {
        const arrayBuffer = await file.arrayBuffer()

        const result = await mammoth.convertToHtml(
            { arrayBuffer },
            {
                styleMap: [
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Heading 3'] => h3:fresh",
                    "p[style-name='Heading 4'] => h4:fresh",
                    "p[style-name='Heading 5'] => h5:fresh",
                    "p[style-name='Heading 6'] => h6:fresh",
                    "b => strong",
                    "i => em",
                    "u => u",
                    "strike => s",
                ],
            }
        )

        // Also get plain text version (fallback)
        const textResult = await mammoth.extractRawText({ arrayBuffer })
        const textFromHtml = extractPlainTextFromHtml(result.value)

        return {
            html: result.value,
            text: textFromHtml || textResult.value,
            messages: result.messages.map(m => m.message),
            success: true,
        }
    } catch (error) {
        return {
            html: '',
            text: '',
            messages: [],
            success: false,
            error: error instanceof Error ? error.message : 'Неизвестная ошибка при импорте',
        }
    }
}

/**
 * Process a DOCX file with cleaning options
 */
export async function processDocx(
    file: File,
    options: CleaningOptions,
    patterns?: AIPattern[],
    detailedSettings?: DetailedCleaningSettings
): Promise<ProcessedDocument> {
    const importResult = await importDocx(file)

    if (!importResult.success) {
        throw new Error(importResult.error || 'Ошибка импорта документа')
    }

    // Clean the text content
    const cleaningResult = cleanText(importResult.text, options, patterns, detailedSettings)

    const cleanedHtml = cleanHtmlPreservingTags(importResult.html, options, patterns, detailedSettings)

    return {
        originalHtml: importResult.html,
        cleanedHtml,
        originalText: importResult.text,
        cleanedText: cleaningResult.cleanedText,
        cleaningResult,
        fileName: file.name,
    }
}

// HTML cleaning is implemented in src/lib/htmlCleaner.ts

/**
 * Parse cleaned text back to document structure
 */
interface ParsedElement {
    type: 'heading' | 'paragraph' | 'list' | 'table'
    level?: number
    content: string
    children?: ParsedElement[]
    rows?: string[][]
    bold?: boolean
    italic?: boolean
}

function parseTextToStructure(text: string): ParsedElement[] {
    const lines = text.split('\n')
    const elements: ParsedElement[] = []

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Detect headings (lines starting with # or in all caps)
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
        if (headingMatch) {
            elements.push({
                type: 'heading',
                level: headingMatch[1].length,
                content: headingMatch[2],
            })
            continue
        }

        // Detect list items
        if (trimmed.match(/^[•●○◦▪▫-]\s+/) || trimmed.match(/^\d+\.\s+/)) {
            elements.push({
                type: 'list',
                content: trimmed.replace(/^[•●○◦▪▫-]\s+/, '').replace(/^\d+\.\s+/, ''),
            })
            continue
        }

        // Regular paragraph
        elements.push({
            type: 'paragraph',
            content: trimmed,
        })
    }

    return elements
}

/**
 * Export content to a new .docx file
 */
export async function exportDocx(
    content: string,
    fileName: string = 'cleaned-document.docx'
): Promise<Blob> {
    const children: (Paragraph | Table)[] = isProbablyHtml(content)
        ? parseHtmlToDocChildren(content)
        : parsePlainTextToDocChildren(content)

    const doc = new Document({
        title: fileName,
        sections: [
            {
                properties: {},
                children,
            },
        ],
    })

    const blob = await Packer.toBlob(doc)
    return blob
}

function parsePlainTextToDocChildren(content: string): (Paragraph | Table)[] {
    const elements = parseTextToStructure(content)
    const children: (Paragraph | Table)[] = []

    for (const element of elements) {
        switch (element.type) {
            case 'heading':
                children.push(
                    new Paragraph({
                        text: element.content,
                        heading: getHeadingLevel(element.level || 1),
                    })
                )
                break

            case 'list':
                children.push(
                    new Paragraph({
                        children: [new TextRun(element.content)],
                        bullet: { level: 0 },
                    })
                )
                break

            case 'table':
                if (element.rows) {
                    children.push(createTable(element.rows))
                }
                break

            case 'paragraph':
            default:
                children.push(
                    new Paragraph({
                        children: parseTextRuns(element.content),
                    })
                )
                break
        }
    }

    return children
}

type InlineStyle = {
    bold?: boolean
    italics?: boolean
    underline?: boolean
    strike?: boolean
}

function parseHtmlToDocChildren(html: string): (Paragraph | Table)[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const children: (Paragraph | Table)[] = []

    const push = (items: (Paragraph | Table)[]) => {
        for (const item of items) children.push(item)
    }

    for (const node of Array.from(doc.body.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.nodeValue ?? '').trim()
            if (text) {
                children.push(new Paragraph({ children: [new TextRun(text)] }))
            }
            continue
        }
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        push(parseHtmlElement(node as HTMLElement))
    }

    return children.length ? children : [new Paragraph('')]
}

function parseHtmlElement(el: HTMLElement): (Paragraph | Table)[] {
    const tag = el.tagName.toLowerCase()

    if (tag === 'table') {
        return [htmlTableToDocx(el as HTMLTableElement)]
    }

    if (tag === 'td' || tag === 'th') {
        const isHeader = tag === 'th'
        const out: (Paragraph | Table)[] = []
        for (const child of Array.from(el.childNodes)) {
            if (child.nodeType !== Node.ELEMENT_NODE) continue
            out.push(...parseHtmlElement(child as HTMLElement))
        }
        const paragraphs = out.filter((b): b is Paragraph => b instanceof Paragraph)
        if (paragraphs.length) return paragraphs
        return [new Paragraph({ children: parseInlineRuns(el, isHeader ? { bold: true } : {}) })]
    }

    if (tag === 'ul' || tag === 'ol') {
        const items: Paragraph[] = []
        const li = Array.from(el.querySelectorAll(':scope > li'))
        for (const item of li) {
            items.push(
                new Paragraph({
                    children: parseInlineRuns(item as HTMLElement, {}),
                    bullet: { level: 0 },
                })
            )
        }
        return items
    }

    if (tag === 'p') {
        return [new Paragraph({ children: parseInlineRuns(el, {}) })]
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        const level = Number(tag.slice(1)) || 1
        return [new Paragraph({ children: parseInlineRuns(el, { bold: true }), heading: getHeadingLevel(level) })]
    }

    if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer') {
        const out: (Paragraph | Table)[] = []
        for (const child of Array.from(el.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = (child.nodeValue ?? '').trim()
                if (text) out.push(new Paragraph({ children: [new TextRun(text)] }))
                continue
            }
            if (child.nodeType !== Node.ELEMENT_NODE) continue
            out.push(...parseHtmlElement(child as HTMLElement))
        }
        return out
    }

    // Fallback: treat as paragraph text
    const text = (el.textContent ?? '').trim()
    if (!text) return []
    return [new Paragraph({ children: [new TextRun(text)] })]
}

function parseInlineRuns(node: Node, style: InlineStyle): TextRun[] {
    if (node.nodeType === Node.TEXT_NODE) {
        const raw = node.nodeValue ?? ''
        const text = raw.replace(/\s+/g, ' ')
        if (!text) return []
        return [new TextRun({
            text,
            bold: style.bold,
            italics: style.italics,
            strike: style.strike,
            underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
        })]
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return []
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (tag === 'br') {
        return [new TextRun({ break: 1 })]
    }

    const nextStyle: InlineStyle = { ...style }
    if (tag === 'strong' || tag === 'b') nextStyle.bold = true
    if (tag === 'em' || tag === 'i') nextStyle.italics = true
    if (tag === 'u') nextStyle.underline = true
    if (tag === 's' || tag === 'strike' || tag === 'del') nextStyle.strike = true

    const runs: TextRun[] = []
    for (const child of Array.from(el.childNodes)) {
        runs.push(...parseInlineRuns(child, nextStyle))
    }
    return runs
}

function htmlTableToDocx(tableEl: HTMLTableElement): Table {
    const rowEls = Array.from(tableEl.querySelectorAll('tr'))

    const rows = rowEls.map((tr, rowIndex) => {
        const cellEls = Array.from(tr.querySelectorAll(':scope > th, :scope > td'))
        const children = cellEls.map((cell) => {
            const tag = cell.tagName.toLowerCase()
            const isHeader = rowIndex === 0 && tag === 'th'
            const paragraphs = parseTableCellToParagraphs(cell as HTMLElement, isHeader ? { bold: true } : {})
            return new TableCell({
                children: paragraphs,
            })
        })

        return new TableRow({ children })
    })

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'D0D0D0' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D0D0D0' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'D0D0D0' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'D0D0D0' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
        },
    })
}

function parseTableCellToParagraphs(cell: HTMLElement, defaultStyle: InlineStyle): Paragraph[] {
    const blocks: Paragraph[] = []

    const children = Array.from(cell.childNodes).filter((n) => n.nodeType === Node.ELEMENT_NODE) as HTMLElement[]
    for (const child of children) {
        const tag = child.tagName.toLowerCase()

        if (tag === 'p') {
            blocks.push(new Paragraph({ children: parseInlineRuns(child, defaultStyle) }))
            continue
        }

        if (tag === 'ul' || tag === 'ol') {
            const li = Array.from(child.querySelectorAll(':scope > li'))
            for (const item of li) {
                blocks.push(new Paragraph({ children: parseInlineRuns(item as HTMLElement, defaultStyle), bullet: { level: 0 } }))
            }
            continue
        }

        if (tag === 'div' || tag === 'section' || tag === 'article') {
            const nested = parseTableCellToParagraphs(child, defaultStyle)
            blocks.push(...nested)
            continue
        }
    }

    if (blocks.length) return blocks

    const text = (cell.textContent ?? '').trim()
    if (!text) return [new Paragraph('')]
    return [new Paragraph({
        children: [new TextRun({
            text,
            bold: defaultStyle.bold,
            italics: defaultStyle.italics,
            strike: defaultStyle.strike,
            underline: defaultStyle.underline ? { type: UnderlineType.SINGLE } : undefined,
        })]
    })]
}

function getHeadingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
    const levels = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
    } as const
    return levels[level as keyof typeof levels] || HeadingLevel.HEADING_1
}

function parseTextRuns(text: string): TextRun[] {
    // Simple parsing for bold and italic
    const runs: TextRun[] = []

    // Split by **bold** and *italic* markers
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)

    for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(new TextRun({
                text: part.slice(2, -2),
                bold: true,
            }))
        } else if (part.startsWith('*') && part.endsWith('*')) {
            runs.push(new TextRun({
                text: part.slice(1, -1),
                italics: true,
            }))
        } else if (part) {
            runs.push(new TextRun({ text: part }))
        }
    }

    return runs.length > 0 ? runs : [new TextRun({ text })]
}

function createTable(rows: string[][]): Table {
    return new Table({
        width: {
            size: 100,
            type: WidthType.PERCENTAGE,
        },
        rows: rows.map((row, rowIndex) =>
            new TableRow({
                children: row.map(cell =>
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: cell,
                                bold: rowIndex === 0,
                            })],
                            alignment: AlignmentType.LEFT,
                        })],
                        width: {
                            size: Math.floor(100 / row.length),
                            type: WidthType.PERCENTAGE,
                        },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1 },
                            bottom: { style: BorderStyle.SINGLE, size: 1 },
                            left: { style: BorderStyle.SINGLE, size: 1 },
                            right: { style: BorderStyle.SINGLE, size: 1 },
                        },
                    })
                ),
            })
        ),
    })
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/**
 * Export clean document and trigger download
 */
export async function exportAndDownload(
    content: string,
    originalFileName: string
): Promise<void> {
    const cleanFileName = originalFileName.replace(/\.docx$/i, '') + '_cleaned.docx'
    const blob = await exportDocx(content, cleanFileName)
    downloadBlob(blob, cleanFileName)
}
