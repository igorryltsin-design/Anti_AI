// Deep Cleaning Engine for AI Text Purifier
// Движок глубокой очистки текста от артефактов ИИ

import {
    type AIPattern,
    defaultAIPatterns,
    invisibleCharacters,
    quoteToStraight,
    quoteToTypographic,
    dashNormalization
} from './aiPatterns'
import type { DetailedCleaningSettings } from '@/store/useCleaningStore'

export type SuspicionSeverity = 'low' | 'medium' | 'high'

export interface CleaningOptions {
    basic: boolean           // Zero-width spaces, quotes normalization
    structure: boolean       // Empty lines, list normalization
    aiPatterns: boolean      // AI phrase detection and removal
    humanizer: boolean       // Add micro-variations
}

export interface SuspicionHistogram {
    low: number
    medium: number
    high: number
}

export interface CleaningResult {
    cleanedText: string
    originalText: string
    stats: CleaningStats
    suspiciousRanges: SuspiciousRange[]
    suspicionScore: number
    severityHistogram: SuspicionHistogram
    softFixPreview?: string
}

export interface CleaningStats {
    invisibleCharsRemoved: number
    quotesNormalized: number
    dashesNormalized: number
    emptyLinesRemoved: number
    aiPatternsFound: number
    aiPatternsRemoved: number
    totalChanges: number
    aiSuspicionScore: number
    aiSeverity: SuspicionHistogram
}

export interface SuspiciousRange {
    start: number
    end: number
    pattern: string
    category: string
    severity: SuspicionSeverity
    score: number
    patternId?: string
    context?: string
}

const severityByCategory: Record<string, SuspicionSeverity> = {
    structure: 'high',
    phrase: 'medium',
    transition: 'low',
    filler: 'low',
}

const severityWeight: Record<SuspicionSeverity, number> = {
    low: 0.85,
    medium: 1,
    high: 1.35,
}

const whitelistTokens = new Set([
    'США', 'СССР', 'РФ', 'ООН', 'ЕС', 'EU', 'NASA', 'AI', 'ИИ'
])

function isAllCaps(token: string): boolean {
    return token.length > 1 && token === token.toUpperCase() && /[A-ZА-ЯЁ]/.test(token)
}

function isLikelyHeading(text: string, start: number, end: number): boolean {
    const lineStart = text.lastIndexOf('\n', start) + 1
    const lineEnd = text.indexOf('\n', end)
    const line = text.slice(lineStart < 0 ? 0 : lineStart, lineEnd === -1 ? text.length : lineEnd).trim()
    if (!line) return false
    const isShort = line.length <= 120
    const hasFewLower = (line.match(/[a-zа-яё]/g) || []).length < (line.length * 0.35)
    return isShort && (isAllCaps(line) || hasFewLower)
}

function hasAbbreviation(matchText: string): boolean {
    return /\b[А-ЯЁA-Z]{2,}\b/.test(matchText)
}

function looksLikePersonName(matchText: string): boolean {
    const tokens = matchText
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 5)

    if (tokens.length < 2 || tokens.length > 4) return false
    if (!tokens.every(t => /^[А-ЯЁ][а-яё-]+$/u.test(t))) return false

    const hasPatronymic = tokens.some(t => /(вич|вна|ична|евич|ович|евна|овна)$/iu.test(t))
    if (!hasPatronymic) return false

    const hasSurnameLike = tokens.some(t => /(ов|ев|ин|ын|ский|цкий|ова|ева|ина|ына|ская|цкая)$/iu.test(t))
    if (!hasSurnameLike) return false

    return true
}

function shouldIgnoreMatch(text: string, start: number, end: number, matchText: string): boolean {
    if (whitelistTokens.has(matchText.toUpperCase())) return true
    if (hasAbbreviation(matchText)) return true
    if (isLikelyHeading(text, start, end)) return true
    if (looksLikePersonName(matchText)) return true
    return false
}

export function smartGarbageCleanup(text: string): { text: string; count: number } {
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    const out: string[] = []
    let removed = 0

    const boxChars = /[░▒▓█■□▪▫▬─━│┃┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬═]/u
    const frameLine = /^[\s|+`~_=*#><\-\u2014\u2013\u2500-\u257F]+$/u

    const normalizeKey = (s: string) =>
        s
            .trim()
            .replace(/\u00A0/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .toLowerCase()

    const looksLikeNoiseToken = (trimmed: string) => {
        if (!trimmed) return false
        if (/^(null|undefined|nan)$/i.test(trimmed)) return true
        if (/^\{\.{3}\}$/.test(trimmed) || /^\[\.{3}\]$/.test(trimmed)) return true
        if (/^(?:\.{3,}|…{2,}|-{3,}|_{3,}|={3,}|\*{3,}|#{3,}|>{3,}|<{3,}|\/{3,})$/.test(trimmed)) return true
        if (/^#{1,6}\s*(start|end|begin|finish|section)\b/i.test(trimmed)) return true
        if (/^(?:start|end|begin|finish)\b.*(?:start|end|begin|finish)?$/i.test(trimmed) && /#{2,}|-{3,}/.test(trimmed)) return true
        return false
    }

    const isDecorativeLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return false

        if (looksLikeNoiseToken(trimmed)) return true

        const chars = Array.from(trimmed)
        let letters = 0
        let digits = 0
        let others = 0

        for (const ch of chars) {
            if (/\p{L}/u.test(ch)) letters++
            else if (/\p{N}/u.test(ch)) digits++
            else if (/\s/u.test(ch)) {
                // ignore
            } else {
                others++
            }
        }

        const hasAlphaNum = (letters + digits) > 0
        if (!hasAlphaNum && (boxChars.test(trimmed) || (frameLine.test(trimmed) && others >= 3))) return true

        // Lines that are overwhelmingly symbols (decorations/separators).
        const denom = Math.max(1, letters + digits + others)
        const symbolRatio = others / denom
        if (!hasAlphaNum && symbolRatio >= 0.6 && trimmed.length >= 4) return true
        if (hasAlphaNum && symbolRatio >= 0.92 && trimmed.length >= 12) return true

        // Table/grid borders without content.
        if (!hasAlphaNum && /^[\s|:+-]+$/.test(trimmed) && trimmed.length >= 6) return true

        return false
    }

    outer: for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]
        const line = raw.replace(/\s+$/g, '')

        if (isDecorativeLine(line)) {
            removed++
            continue
        }

        const key = normalizeKey(line)
        const prev = out.length ? normalizeKey(out[out.length - 1]) : ''
        if (key && key === prev) {
            removed++
            continue
        }

        // Remove immediate repeated blocks (2–4 lines) to kill duplicated headers/sections.
        for (const k of [4, 3, 2]) {
            if (out.length < k) continue
            if (i + k > lines.length) continue

            const prevBlock = out.slice(-k).map(normalizeKey)
            const nextBlock = lines.slice(i, i + k).map((s) => normalizeKey(s.replace(/\s+$/g, '')))

            if (nextBlock.every(Boolean) && prevBlock.every(Boolean) && prevBlock.join('\n') === nextBlock.join('\n')) {
                removed += k
                i += (k - 1)
                continue outer
            }
        }

        out.push(line)
    }

    const cleaned = out
        .join('\n')
        .replace(/\n[ \t]+\n/g, '\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    return { text: cleaned, count: removed }
}

function buildSeverityHistogram(ranges: SuspiciousRange[]): SuspicionHistogram {
    return ranges.reduce<SuspicionHistogram>((acc, range) => {
        acc[range.severity] += 1
        return acc
    }, { low: 0, medium: 0, high: 0 })
}

function computeContextualScore(matchText: string): number {
    const lengthBoost = Math.min(matchText.length / 40, 1.2)
    const repetitionPenalty = /\b(\w+)\b.*\b\1\b/.test(matchText) ? 1.1 : 1
    return Number((1 + (lengthBoost - 0.5) * 0.2) * repetitionPenalty)
}

function computeSuspicionScore(ranges: SuspiciousRange[], textLength: number): number {
    if (!ranges.length || textLength === 0) return 0
    const weighted = ranges.reduce((acc, range) => acc + range.score, 0)
    const normalizedLength = Math.max(1, textLength / 1200) // scale by text size to avoid tiny snippets going 1.0
    const density = weighted / normalizedLength
    const score = Math.min(1, density / 5) // dampen to keep range in 0..1
    return Number(score.toFixed(3))
}

/**
 * Detection-only analysis (no text transformations).
 * Returns suspicious ranges aligned to the input text, plus a preview of "soft fixes" based on pattern replacements.
 */
export function analyzeText(
    text: string,
    patterns: AIPattern[] = defaultAIPatterns
): CleaningResult {
    const suspiciousRanges = detectAIPatterns(text, patterns)
    const severityHistogram = buildSeverityHistogram(suspiciousRanges)
    const suspicionScore = computeSuspicionScore(suspiciousRanges, text.length)
    const aiRemoval = removeAIPatterns(text, patterns)

    const stats: CleaningStats = {
        invisibleCharsRemoved: 0,
        quotesNormalized: 0,
        dashesNormalized: 0,
        emptyLinesRemoved: 0,
        aiPatternsFound: suspiciousRanges.length,
        aiPatternsRemoved: aiRemoval.count,
        totalChanges: aiRemoval.count,
        aiSuspicionScore: suspicionScore,
        aiSeverity: severityHistogram,
    }

    return {
        cleanedText: text,
        originalText: text,
        stats,
        suspiciousRanges,
        suspicionScore,
        severityHistogram,
        softFixPreview: aiRemoval.text,
    }
}

// ============================================
// BASIC CLEANING
// ============================================

/**
 * Remove zero-width and invisible characters
 */
export function removeInvisibleCharacters(text: string, convertNbsp: boolean = true): { text: string; count: number } {
    let count = 0
    let result = text

    // Простые правила преобразования: все "видимые" пробельные варианты превращаем в обычный пробел,
    // чтобы слова не склеивались после очистки
    const spaceLikeChars = new Set(['\u00A0', '\u202F', '\u205F', '\u3000']) // nbsp, узкие/широкие пробелы
    const lineBreakChars = new Set(['\u2028', '\u2029']) // разделители строк/абзацев

    for (const char of Object.keys(invisibleCharacters)) {
        const regex = new RegExp(char, 'g')
        const matches = result.match(regex)
        if (matches) {
            // NBSP и родственные пробелы не считаем как "невидимые" (чтобы не пугать пользователя статистикой)
            const shouldCount = char !== '\u00A0'
            if (shouldCount) {
                count += matches.length
            }

            // Конвертируем все типы пробелов в обычный, если включена опция normalize spaces
            if (spaceLikeChars.has(char)) {
                if (convertNbsp) {
                    result = result.replace(regex, ' ')
                }
                continue
            }

            // Сохраняем разрывы строк, но приводим к \n
            if (lineBreakChars.has(char)) {
                result = result.replace(regex, '\n')
                continue
            }

            // Остальные невидимые символы удаляем
            result = result.replace(regex, '')
        }
    }

    return { text: result, count }
}

/**
 * Normalize quotes to straight (обычные) - для английского стиля
 */
export function normalizeQuotesToStraight(text: string): { text: string; count: number } {
    let count = 0
    let result = text

    for (const [fancy, standard] of Object.entries(quoteToStraight)) {
        const regex = new RegExp(fancy, 'g')
        const matches = result.match(regex)
        if (matches) {
            count += matches.length
            result = result.replace(regex, standard)
        }
    }

    return { text: result, count }
}

/**
 * Normalize quotes to typographic (типографские «ёлочки») - для русского стиля
 * Преобразует " в «» с учётом контекста (открывающие/закрывающие)
 */
export function normalizeQuotesToTypographic(text: string): { text: string; count: number } {
    let count = 0
    let result = text

    // Сначала заменяем все английские типографские кавычки на обычные
    result = result.replace(/[""]/g, () => {
        count++
        return '"'
    })

    // Теперь заменяем обычные кавычки на русские «ёлочки»
    // Используем простую эвристику: чётные кавычки - открывающие, нечётные - закрывающие
    let quoteIndex = 0
    result = result.replace(/"/g, () => {
        const replacement = quoteIndex % 2 === 0
            ? quoteToTypographic.openDouble
            : quoteToTypographic.closeDouble
        quoteIndex++
        return replacement
    })

    // Если количество кавычек нечётное, последняя осталась открытой - исправляем
    // (это может произойти при несбалансированных кавычках)

    count = quoteIndex
    return { text: result, count }
}

/**
 * Unified quote normalization with direction option
 */
export function normalizeQuotes(
    text: string,
    direction: 'toTypographic' | 'toStraight' = 'toTypographic'
): { text: string; count: number } {
    if (direction === 'toTypographic') {
        return normalizeQuotesToTypographic(text)
    } else {
        return normalizeQuotesToStraight(text)
    }
}

/**
 * Normalize dashes based on style preference
 */
export function normalizeDashes(
    text: string,
    style: 'emToEn' | 'enToEm' | 'toHyphen' = 'emToEn'
): { text: string; count: number } {
    let count = 0
    let result = text

    const mapping = dashNormalization[style]

    if (style === 'emToEn' || style === 'enToEm' || style === 'toHyphen') {
        for (const [from, to] of Object.entries(mapping)) {
            const regex = new RegExp(from, 'g')
            const matches = result.match(regex)
            if (matches) {
                count += matches.length
                result = result.replace(regex, to)
            }
        }
    }

    return { text: result, count }
}

/**
 * Normalize multiple spaces to single space
 */
export function normalizeSpaces(text: string): string {
    return text.replace(/ {2,}/g, ' ')
}

// ============================================
// STRUCTURE CLEANING
// ============================================

/**
 * Remove excessive empty lines (more than 2 consecutive)
 */
export function removeExcessiveEmptyLines(text: string): { text: string; count: number } {
    const original = text
    const result = text.replace(/\n{3,}/g, '\n\n')
    const originalLines = (original.match(/\n/g) || []).length
    const resultLines = (result.match(/\n/g) || []).length
    return { text: result, count: originalLines - resultLines }
}

/**
 * Normalize list formatting
 */
export function normalizeLists(text: string): string {
    // Normalize bullet points
    let result = text.replace(/^[\s]*[•●○◦▪▫‣⁃-]\s*/gm, '• ')

    // Normalize numbered lists
    result = result.replace(/^[\s]*(\d+)[.)]\s*/gm, '$1. ')

    return result
}

/**
 * Trim whitespace from each line
 */
export function trimLines(text: string): string {
    return text
        .split('\n')
        .map(line => line.trim())
        .join('\n')
}

// ============================================
// AI PATTERN DETECTION & CLEANING
// ============================================

/**
 * Find all AI patterns in text with their positions
 */
export function detectAIPatterns(
    text: string,
    patterns: AIPattern[] = defaultAIPatterns
): SuspiciousRange[] {
    const suspiciousRanges: SuspiciousRange[] = []

    for (const patternDef of patterns) {
        if (!patternDef.enabled) continue

        const flagsFromPattern = patternDef.pattern instanceof RegExp
            ? patternDef.pattern.flags
            : 'gi'
        const flags = flagsFromPattern.includes('g') ? flagsFromPattern : `${flagsFromPattern}g`

        // Use the pattern as-is for RegExp (they already have proper boundaries)
        // For string patterns, add word boundaries
        const regex = patternDef.pattern instanceof RegExp
            ? new RegExp(patternDef.pattern.source, flags)
            : new RegExp(`\\b${patternDef.pattern}\\b`, flags)

        let match
        while ((match = regex.exec(text)) !== null) {
            const matchedText = (match[0] || '').trim()
            if (matchedText.length < 3) {
                continue
            }

            const start = match.index
            const end = match.index + match[0].length

            if (shouldIgnoreMatch(text, start, end, matchedText)) {
                continue
            }

            const severity = patternDef.severity ?? severityByCategory[patternDef.category] ?? 'medium'
            const baseWeight = patternDef.weight ?? severityWeight[severity]
            const contextualScore = computeContextualScore(matchedText)
            const score = Number((baseWeight * contextualScore).toFixed(3))
            const context = text.slice(Math.max(0, start - 40), Math.min(text.length, end + 40))

            suspiciousRanges.push({
                start,
                end,
                pattern: patternDef.description,
                category: patternDef.category,
                severity,
                score,
                patternId: patternDef.id,
                context,
            })
        }
    }

    // Возвращаем точные попадания без слияния, чтобы подсветка была только на совпадшей фразе
    return suspiciousRanges.sort((a, b) => a.start - b.start)
}

/**
 * Remove AI patterns from text
 */
export function removeAIPatterns(
    text: string,
    patterns: AIPattern[] = defaultAIPatterns
): { text: string; count: number } {
    let result = text
    let count = 0

    for (const patternDef of patterns) {
        if (!patternDef.enabled) continue
        if (patternDef.replacement === undefined) continue

        const flagsFromPattern = patternDef.pattern instanceof RegExp
            ? patternDef.pattern.flags
            : 'gi'
        const flags = flagsFromPattern.includes('g') ? flagsFromPattern : `${flagsFromPattern}g`

        // Use the pattern as-is for RegExp, add word boundaries for string patterns
        const regex = patternDef.pattern instanceof RegExp
            ? new RegExp(patternDef.pattern.source, flags)
            : new RegExp(patternDef.pattern, flags)

        const matches = result.match(regex)
        if (matches) {
            count += matches.length
            const replacement = patternDef.replacement
            if (typeof replacement === 'string') {
                result = result.replace(regex, replacement)
            } else {
                result = result.replace(regex, replacement)
            }
        }
    }

    // Clean up resulting double spaces
    result = result.replace(/  +/g, ' ')

    // Clean up space at beginning of sentences
    result = result.replace(/([.!?])\s+\s+/g, '$1 ')

    return { text: result, count }
}

// ============================================
// HUMANIZER
// ============================================

const microTypos: Record<string, string[]> = {
    'а': ['а', 'а', 'а', 'a'],  // Occasional Latin 'a'
    'е': ['е', 'е', 'е', 'e'],  // Occasional Latin 'e'
    'о': ['о', 'о', 'о', 'o'],  // Occasional Latin 'o'
}

/**
 * Add subtle micro-variations to text (use sparingly!)
 */
export function humanizeText(text: string, intensity: number = 0.01): string {
    if (intensity <= 0) return text

    const chars = text.split('')
    let changeCount = 0
    const maxChanges = Math.floor(text.length * intensity)

    for (let i = 0; i < chars.length && changeCount < maxChanges; i++) {
        const char = chars[i]
        const variants = microTypos[char]

        if (variants && Math.random() < intensity) {
            const randomVariant = variants[Math.floor(Math.random() * variants.length)]
            chars[i] = randomVariant
            changeCount++
        }
    }

    return chars.join('')
}

// ============================================
// MAIN CLEANING FUNCTION
// ============================================

/**
 * Main text cleaning function with all options
 */
export function cleanText(
    text: string,
    options: CleaningOptions,
    customPatterns?: AIPattern[],
    detailedSettings?: DetailedCleaningSettings
): CleaningResult {
    const stats: CleaningStats = {
        invisibleCharsRemoved: 0,
        quotesNormalized: 0,
        dashesNormalized: 0,
        emptyLinesRemoved: 0,
        aiPatternsFound: 0,
        aiPatternsRemoved: 0,
        totalChanges: 0,
        aiSuspicionScore: 0,
        aiSeverity: { low: 0, medium: 0, high: 0 },
    }

    // Значения по умолчанию для детальных настроек
    const settings: DetailedCleaningSettings = detailedSettings || {
        removeInvisibleChars: true,
        removeZeroWidth: true,
        convertNbsp: true,
        normalizeQuotes: true,
        quotesDirection: 'toTypographic',
        normalizeDashes: true,
        dashStyle: 'emToEn',
        normalizeSpaces: true,
        removeExtraLines: true,
        trimLines: true,
        normalizeLists: true,
        lowercaseAfterColon: true,
        yoLetter: 'ignore',
        hangingPrepositions: false,
        removeEmojis: false,
        removeLinks: false,
        removeEmails: false,
        smartGarbageCleanup: false,
    }

    let result = text
    const originalText = text
    const basePatterns = customPatterns || defaultAIPatterns
    const patterns = basePatterns
    const detectionPatterns = patterns

    // Basic cleaning
    if (options.basic) {
        // Невидимые символы
        if (settings.removeInvisibleChars) {
            const invisible = removeInvisibleCharacters(result, settings.convertNbsp)
            result = invisible.text
            stats.invisibleCharsRemoved = invisible.count
        }

        // Кавычки
        if (settings.normalizeQuotes) {
            const quotes = normalizeQuotes(result, settings.quotesDirection)
            result = quotes.text
            stats.quotesNormalized = quotes.count
        }

        // Тире
        if (settings.normalizeDashes) {
            const dashes = normalizeDashes(result, settings.dashStyle)
            result = dashes.text
            stats.dashesNormalized = dashes.count
        }

        // Пробелы
        if (settings.normalizeSpaces) {
            result = normalizeSpaces(result)
        }
    }

    // Structure cleaning
    if (options.structure) {
        if (settings.smartGarbageCleanup) {
            const cleaned = smartGarbageCleanup(result)
            result = cleaned.text
            stats.totalChanges += cleaned.count
        }

        if (settings.removeExtraLines) {
            const emptyLines = removeExcessiveEmptyLines(result)
            result = emptyLines.text
            stats.emptyLinesRemoved = emptyLines.count
        }

        if (settings.normalizeLists) {
            result = normalizeLists(result)
        }

        if (settings.trimLines) {
            result = trimLines(result)
        }
    }

    // AI pattern removal (only patterns with defined replacement)
    // Удаляем/заменяем явные артефакты ИИ из итогового текста, но также отдаём превью "мягких правок" для оригинала.
    let softFixPreview: string | undefined
    if (options.aiPatterns) {
        const preview = removeAIPatterns(originalText, patterns)
        softFixPreview = preview.text

        const applied = removeAIPatterns(result, patterns)
        result = applied.text
        stats.aiPatternsRemoved = applied.count
    }

    // Humanizer (optional, use with caution)
    if (options.humanizer) {
        result = humanizeText(result, 0.005)
    }

    // ============================================
    // ADVANCED CLEANING (NEW)
    // ============================================

    // Yo letter normalization
    if (settings.yoLetter !== 'ignore') {
        const yo = normalizeYo(result, settings.yoLetter)
        result = yo.text
        stats.totalChanges += yo.count
    }

    // Hanging prepositions
    if (settings.hangingPrepositions) {
        const prep = fixHangingPrepositions(result)
        result = prep.text
        stats.totalChanges += prep.count
    }

    // Content removal
    if (settings.removeEmojis) {
        const emojis = removeEmojis(result)
        result = emojis.text
        stats.totalChanges += emojis.count
    }

    if (settings.removeLinks) {
        const links = removeLinks(result)
        result = links.text
        stats.totalChanges += links.count
    }

    if (settings.removeEmails) {
        const emails = removeEmails(result)
        result = emails.text
        stats.totalChanges += emails.count
    }

    // Lowercase after colon (mid-sentence)
    if (settings.lowercaseAfterColon) {
        const lowerAfterColon = fixCapitalAfterColon(result)
        result = lowerAfterColon.text
        stats.totalChanges += lowerAfterColon.count
    }

    stats.totalChanges +=
        stats.invisibleCharsRemoved +
        stats.quotesNormalized +
        stats.dashesNormalized +
        stats.emptyLinesRemoved +
        stats.aiPatternsRemoved

    // Detect AI patterns after всех преобразований, чтобы координаты совпадали с итоговым текстом
    let suspiciousRanges: SuspiciousRange[] = []
    suspiciousRanges = detectAIPatterns(result, detectionPatterns)
    stats.aiPatternsFound = suspiciousRanges.length
    const severityHistogram = buildSeverityHistogram(suspiciousRanges)
    const suspicionScore = computeSuspicionScore(suspiciousRanges, result.length)
    stats.aiSuspicionScore = suspicionScore
    stats.aiSeverity = severityHistogram

    return {
        cleanedText: result,
        originalText,
        stats,
        suspiciousRanges,
        suspicionScore,
        severityHistogram,
        softFixPreview,
    }
}

// ============================================
// NEW HEURISTICS
// ============================================

/**
 * Normalize letter Yo (Ё)
 */
export function normalizeYo(text: string, mode: 'restore' | 'replace' | 'ignore'): { text: string; count: number } {
    if (mode === 'ignore') return { text, count: 0 }

    let count = 0
    let result = text

    if (mode === 'replace') {
        // Ё -> Е
        result = result.replace(/[Ёё]/g, (match) => {
            count++
            return match === 'Ё' ? 'Е' : 'е'
        })
    } else if (mode === 'restore') {
        // Placeholder for restore logic
    }

    return { text: result, count }
}

/**
 * Fix hanging prepositions (add NBSP)
 * Adds non-breaking space after short prepositions (1-3 chars)
 */
export function fixHangingPrepositions(text: string): { text: string; count: number } {
    let count = 0
    // Prepositions: в, во, к, ко, с, со, о, об, обо, у, из, за, на, по, от, до, не, ни, и, а, но, да
    const regex = /(\s|^)(в|во|к|ко|с|со|о|об|обо|у|из|за|на|по|от|до|не|ни|и|а|но|да)\s+/gi

    const result = text.replace(regex, (_, prefix, prep) => {
        count++
        return `${prefix}${prep}\u00A0`
    })

    return { text: result, count }
}

/**
 * Remove Emojis
 */
export function removeEmojis(text: string): { text: string; count: number } {
    let count = 0
    // Regex for emojis
    const regex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu

    const result = text.replace(regex, () => {
        count++
        return ''
    })

    return { text: result, count }
}

/**
 * Remove Links
 */
export function removeLinks(text: string): { text: string; count: number } {
    let count = 0
    const regex = /(https?:\/\/[^\s]+)/g

    const result = text.replace(regex, () => {
        count++
        return '[ссылка удалена]'
    })

    return { text: result, count }
}

/**
 * Remove Emails
 */
export function removeEmails(text: string): { text: string; count: number } {
    let count = 0
    const regex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g

    const result = text.replace(regex, () => {
        count++
        return '[email удален]'
    })

    return { text: result, count }
}

/**
 * Lowercase the first letter after a colon in mid-sentence.
 * Applies only when the colon follows a lowercase/number and the word after has lowercase letters (to avoid acronyms).
 */
export function fixCapitalAfterColon(text: string): { text: string; count: number } {
    let count = 0
    const regex = /([а-яёa-z0-9])\s*:\s+([А-ЯЁ])([а-яё]+)/g

    const result = text.replace(regex, (_match, prefix: string, first: string, rest: string) => {
        count++
        return `${prefix}: ${first.toLowerCase()}${rest}`
    })

    return { text: result, count }
}

/**
 * Quick clean with default settings
 */
export function quickClean(text: string): string {
    const result = cleanText(text, {
        basic: true,
        structure: true,
        aiPatterns: false,
        humanizer: false,
    })
    return result.cleanedText
}

/**
 * Deep clean with all options enabled
 */
export function deepClean(text: string): CleaningResult {
    return cleanText(text, {
        basic: true,
        structure: true,
        aiPatterns: true,
        humanizer: false,
    })
}
