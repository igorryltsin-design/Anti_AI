import { cleanText, type CleaningOptions } from '@/lib/cleaningEngine'
import type { AIPattern } from '@/lib/aiPatterns'
import type { DetailedCleaningSettings } from '@/store/useCleaningStore'

export function isProbablyHtml(value: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(value)
}

export function textToHtmlParagraphs(text: string): string {
    const escape = (str: string) =>
        str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')

    if (!text) return '<p></p>'
    return text
        .split('\n')
        .map((line) => `<p>${escape(line) || '<br>'}</p>`)
        .join('')
}

export function extractPlainTextFromHtml(html: string): string {
    if (!html) return ''
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const parts: string[] = []

    const pushBlock = (s: string) => {
        const normalized = s.replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n')
        parts.push(normalized)
    }

    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push((node.nodeValue ?? '').replace(/\s+/g, ' '))
            return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return

        const el = node as HTMLElement
        const tag = el.tagName.toLowerCase()

        if (tag === 'br') {
            parts.push('\n')
            return
        }

        const isBlock =
            tag === 'p' ||
            tag === 'div' ||
            tag === 'section' ||
            tag === 'article' ||
            tag === 'header' ||
            tag === 'footer' ||
            tag === 'h1' ||
            tag === 'h2' ||
            tag === 'h3' ||
            tag === 'h4' ||
            tag === 'h5' ||
            tag === 'h6' ||
            tag === 'li' ||
            tag === 'tr'

        const isTableCell = tag === 'td' || tag === 'th'

        if (tag === 'table') {
            // Table: rows split by newlines, cells by tabs.
            const rows = Array.from(el.querySelectorAll('tr'))
            for (const row of rows) {
                const cells = Array.from(row.querySelectorAll('th,td'))
                const rowTexts = cells.map((c) => (c.textContent ?? '').trim().replace(/\s+/g, ' '))
                pushBlock(rowTexts.join('\t'))
            }
            parts.push('\n')
            return
        }

        if (isTableCell) {
            // Don't add extra newlines here; tables handle row structure above.
            for (const child of Array.from(el.childNodes)) walk(child)
            return
        }

        if (isBlock) {
            const beforeLen = parts.length
            for (const child of Array.from(el.childNodes)) walk(child)
            const afterLen = parts.length
            if (afterLen > beforeLen) parts.push('\n')
            return
        }

        for (const child of Array.from(el.childNodes)) walk(child)
    }

    for (const child of Array.from(doc.body.childNodes)) walk(child)

    return parts
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

export function cleanHtmlPreservingTags(
    html: string,
    options: CleaningOptions,
    patterns?: AIPattern[],
    detailedSettings?: DetailedCleaningSettings
): string {
    if (!html) return html

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
        textNodes.push(node)
    }

    for (const textNode of textNodes) {
        const result = cleanText(textNode.textContent || '', options, patterns, detailedSettings)
        textNode.textContent = result.cleanedText
    }

    return doc.body.innerHTML
}

