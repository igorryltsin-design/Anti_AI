// State management for AI Text Purifier
// Управление состоянием приложения

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type AIPattern, defaultAIPatterns } from '@/lib/aiPatterns'
import { type CleaningOptions, type CleaningResult } from '@/lib/cleaningEngine'
import type { LmStudioChunkRunState, LmStudioSettings } from '@/lib/lmStudioClient'

type PersistedPattern = {
    id: string
    enabled: boolean
    pattern?: string
    description?: string
    category?: AIPattern['category']
}

function serializePattern(pattern: AIPattern): PersistedPattern {
    const patternString =
        pattern.pattern instanceof RegExp
            ? `/${pattern.pattern.source}/${pattern.pattern.flags}`
            : pattern.pattern

    return {
        id: pattern.id,
        enabled: pattern.enabled,
        pattern: patternString,
        description: pattern.description,
        category: pattern.category,
    }
}

function deserializePattern(pattern: PersistedPattern): AIPattern | null {
    if (!pattern.id?.startsWith('custom-')) return null
    const raw = pattern.pattern ?? ''
    if (!raw) return null

    let patternValue: string | RegExp = raw
    const regexMatch = raw.match(/^\/(.+)\/([gimuys]*)$/)
    if (regexMatch) {
        try {
            patternValue = new RegExp(regexMatch[1], regexMatch[2] || 'gi')
        } catch {
            patternValue = regexMatch[1]
        }
    }

    return {
        id: pattern.id,
        pattern: patternValue,
        description: pattern.description?.trim() || raw,
        category: pattern.category || 'phrase',
        enabled: pattern.enabled ?? true,
    }
}

function normalizePatternsFromPersisted(persistedPatterns: PersistedPattern[] | undefined): AIPattern[] {
    const enabledById = new Map<string, boolean>()
    const custom: AIPattern[] = []

    for (const p of persistedPatterns ?? []) {
        if (!p?.id) continue
        enabledById.set(p.id, Boolean(p.enabled))
        const customPattern = deserializePattern(p)
        if (customPattern) custom.push(customPattern)
    }

    const defaults = defaultAIPatterns.map(p => ({
        ...p,
        enabled: enabledById.has(p.id) ? (enabledById.get(p.id) as boolean) : p.enabled,
    }))

    const customById = new Map<string, AIPattern>()
    for (const p of custom) customById.set(p.id, p)

    return [...defaults, ...customById.values()]
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object'
}

const patternCategorySet = new Set<AIPattern['category']>(['phrase', 'structure', 'transition', 'filler'])
function isPatternCategory(value: unknown): value is AIPattern['category'] {
    return typeof value === 'string' && patternCategorySet.has(value as AIPattern['category'])
}

export interface FileItem {
    id: string
    file: File
    status: 'pending' | 'processing' | 'completed' | 'error'
    progress: number
    result?: CleaningResult
    cleanedHtml?: string
    llm?: {
        taskId: string
        startedAt: number
        resume: LmStudioChunkRunState
    }
    error?: string
}

// Расширенные настройки очистки
export interface DetailedCleaningSettings {
    // Невидимые символы
    removeInvisibleChars: boolean
    removeZeroWidth: boolean
    convertNbsp: boolean  // Неразрывные/узкие пробелы → обычный пробел

    // Кавычки
    normalizeQuotes: boolean
    quotesDirection: 'toTypographic' | 'toStraight'  // " → «» или «» → "

    // Тире
    normalizeDashes: boolean
    dashStyle: 'emToEn' | 'enToEm' | 'toHyphen'  // — → – или – → — или всё в -

    // Пробелы и строки
    normalizeSpaces: boolean        // Множественные пробелы → один
    removeExtraLines: boolean       // Удалять лишние пустые строки
    trimLines: boolean              // Обрезать пробелы в строках
    lowercaseAfterColon: boolean    // Делать строчную букву после двоеточия в середине предложения

    // Списки
    normalizeLists: boolean         // Нормализовать маркеры списков

    // Типографика
    yoLetter: 'restore' | 'replace' | 'ignore' // Ё: восстановить, заменить на Е, игнорировать
    hangingPrepositions: boolean    // Висячие предлоги (добавлять nbsp)

    // Контент
    removeEmojis: boolean           // Удалять эмодзи
    removeLinks: boolean            // Удалять ссылки
    removeEmails: boolean           // Удалять email адреса

    // Мусор/декор
    smartGarbageCleanup: boolean    // Убирать рамки/декор/повторы (консервативно)
}

interface CleaningStore {
    // Theme
    theme: 'light' | 'dark'
    setTheme: (theme: 'light' | 'dark') => void
    toggleTheme: () => void

    // Cleaning options (основные переключатели)
    options: CleaningOptions
    setOptions: (options: Partial<CleaningOptions>) => void
    resetOptions: () => void

    // Детальные настройки
    detailedSettings: DetailedCleaningSettings
    setDetailedSettings: (settings: Partial<DetailedCleaningSettings>) => void
    resetDetailedSettings: () => void

    // AI Patterns
    patterns: AIPattern[]
    setPatterns: (patterns: AIPattern[]) => void
    togglePattern: (id: string) => void
    addCustomPattern: (pattern: Omit<AIPattern, 'id'>) => void
    removePattern: (id: string) => void
    resetPatterns: () => void

    // Current document
    originalContent: string
    originalHtml: string
    cleanedContent: string
    cleanedHtml: string
    setOriginalContent: (content: string) => void
    setOriginalHtml: (html: string) => void
    setCleanedContent: (content: string) => void
    setCleanedHtml: (html: string) => void
    cleanedStale: boolean
    setCleanedStale: (stale: boolean) => void

    // Results
    currentResult: CleaningResult | null
    setCurrentResult: (result: CleaningResult | null) => void

    // Batch mode
    batchFiles: FileItem[]
    addBatchFiles: (files: File[]) => void
    updateBatchFile: (id: string, updates: Partial<FileItem>) => void
    removeBatchFile: (id: string) => void
    clearBatchFiles: () => void

    // UI State
    viewMode: 'diff' | 'editor'
    setViewMode: (mode: 'diff' | 'editor') => void

    // Sidebar
    sidebarOpen: boolean
    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void

    // Navigation helpers
    prevSuspicious?: () => void
    nextSuspicious?: () => void
    setPrevSuspicious: (fn?: () => void) => void
    setNextSuspicious: (fn?: () => void) => void

    // Editor sidebar tools
    editorSeverityFilter: 'all' | 'low' | 'medium' | 'high'
    setEditorSeverityFilter: (filter: 'all' | 'low' | 'medium' | 'high') => void
    ignoredSuspiciousKeys: string[]
    ignoreSuspiciousKey: (key: string) => void
    clearIgnoredSuspiciousKeys: () => void
    ignoredSuspiciousPatterns: string[]
    toggleIgnoredSuspiciousPattern: (patternKey: string) => void
    clearIgnoredSuspiciousPatterns: () => void
    showSoftFixDiff: boolean
    setShowSoftFixDiff: (open: boolean) => void
    softFixUndo: string | null
    applySoftFixPreview: () => void
    undoSoftFixPreview: () => void
    editorResetToken: number

    // Jump requests (handled by EditorPage)
    jumpRequest?: { token: number; markIndex: number }
    requestJumpToMarkIndex: (markIndex: number) => void

    // LM Studio (LLM cleanup)
    lmStudio: LmStudioSettings
    setLmStudio: (settings: Partial<LmStudioSettings>) => void
    lmStudioHistory: LmStudioRunRecord[]
    addLmStudioHistory: (record: LmStudioRunRecord) => void
    clearLmStudioHistory: () => void
}

export type LmStudioRunRecord = {
    id: string
    startedAt: number
    finishedAt?: number
    status: 'completed' | 'canceled' | 'error'
    baseUrl: string
    model: string
    inputChars: number
    chunkChars: number
    chunks: number
    parallelism: number
    error?: string
}

const defaultOptions: CleaningOptions = {
    basic: true,
    structure: true,
    aiPatterns: true,
    humanizer: false,
}

const defaultDetailedSettings: DetailedCleaningSettings = {
    // Невидимые символы
    removeInvisibleChars: true,
    removeZeroWidth: true,
    convertNbsp: true,

    // Кавычки - по умолчанию в типографские (русский стиль)
    normalizeQuotes: true,
    quotesDirection: 'toTypographic',

    // Тире - длинное → обычное (среднее)
    normalizeDashes: true,
    dashStyle: 'emToEn',

    // Пробелы и строки
    normalizeSpaces: true,
    removeExtraLines: true,
    trimLines: true,
    lowercaseAfterColon: true,

    // Списки
    normalizeLists: true,

    // Типографика
    yoLetter: 'ignore',
    hangingPrepositions: false,

    // Контент
    removeEmojis: false,
    removeLinks: false,
    removeEmails: false,

    // Мусор/декор
    smartGarbageCleanup: false,
}

const defaultLmStudio: LmStudioSettings = {
    enabled: false,
    baseUrl: 'http://localhost:1234',
    model: '',
    temperature: 0,
    maxTokens: 4096,
    chunkChars: 12000,
    parallelism: 2,
    systemPrompt:
        'Ты — инструмент очистки текста от визуального и символьного мусора.\n' +
        'Получаешь текст, перегруженный служебными символами, рамками, повторами, техническими вставками и лишними знаками.\n\n' +
        'Твоя задача:\n' +
        '- Удалить все лишние символы (например: ░, ═, │, ■, >>>, ### и подобные);\n' +
        '- Убрать рамки, декоративные блоки, пустые строки, маркеры;\n' +
        '- Исключить повторы строк, слов, заголовков или дублирующихся блоков;\n' +
        '- Удалить токены и вставки, не несущие смысловой нагрузки (например: "---", "### start ###", "{...}", "null" и т.д.);\n' +
        '- Сохранить только полезный смысловой текст;\n' +
        '- Оставить абзацы и списки, если они выражают логическую структуру текста;\n' +
        '- Не сокращай текст и не искажай его смысл;\n' +
        '- Не добавляй пояснений или комментариев;\n' +
        '- Не пиши, что ты что-то очистил — просто выведи результат.\n\n' +
        'Итог: возвращай только очищенный, структурированный, читаемый текст.\n',
}

export const useCleaningStore = create<CleaningStore>()(
    persist(
        (set, get) => ({
            // Theme
            theme: 'dark',
            setTheme: (theme) => {
                set({ theme })
                document.documentElement.classList.toggle('dark', theme === 'dark')
            },
            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark'
                get().setTheme(newTheme)
            },

            // Cleaning options
            options: defaultOptions,
            setOptions: (options) => set((state) => ({
                options: { ...state.options, ...options }
            })),
            resetOptions: () => set({ options: defaultOptions }),

            // Детальные настройки
            detailedSettings: defaultDetailedSettings,
            setDetailedSettings: (settings) => set((state) => ({
                detailedSettings: { ...state.detailedSettings, ...settings }
            })),
            resetDetailedSettings: () => set({ detailedSettings: defaultDetailedSettings }),

            // AI Patterns
            patterns: defaultAIPatterns,
            setPatterns: (patterns) => set({ patterns }),
            togglePattern: (id) => set((state) => ({
                patterns: state.patterns.map(p =>
                    p.id === id ? { ...p, enabled: !p.enabled } : p
                )
            })),
            addCustomPattern: (pattern) => set((state) => ({
                patterns: [
                    ...state.patterns,
                    { ...pattern, id: `custom-${Date.now()}` }
                ]
            })),
            removePattern: (id) => set((state) => ({
                patterns: state.patterns.filter(p => p.id !== id)
            })),
            resetPatterns: () => set({ patterns: defaultAIPatterns }),

            // Current document
            originalContent: '',
            originalHtml: '',
            cleanedContent: '',
            cleanedHtml: '',
            cleanedStale: false,
            currentResult: null,
            setOriginalContent: (content) => set({ originalContent: content }),
            setOriginalHtml: (html) => set({ originalHtml: html }),
            setCleanedContent: (content) => set({ cleanedContent: content }),
            setCleanedHtml: (html) => set({ cleanedHtml: html }),
            setCleanedStale: (stale) => set({ cleanedStale: stale }),
            setCurrentResult: (result) => set({ currentResult: result }),

            // Batch processing
            batchFiles: [],
            addBatchFiles: (files) => set((state) => ({
                batchFiles: [
                    ...state.batchFiles,
                    ...files.map((file) => ({
                        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        file,
                        status: 'pending' as const,
                        progress: 0,
                    }))
                ]
            })),
            updateBatchFile: (id, updates) => set((state) => ({
                batchFiles: state.batchFiles.map(f =>
                    f.id === id ? { ...f, ...updates } : f
                )
            })),
            removeBatchFile: (id) => set((state) => ({
                batchFiles: state.batchFiles.filter(f => f.id !== id)
            })),
            clearBatchFiles: () => set({ batchFiles: [] }),

            // View mode
            viewMode: 'editor',
            setViewMode: (mode) => set({ viewMode: mode }),

            // Sidebar
            sidebarOpen: true,
            setSidebarOpen: (open) => set({ sidebarOpen: open }),
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

            prevSuspicious: undefined,
            nextSuspicious: undefined,
            setPrevSuspicious: (fn) => set({ prevSuspicious: fn }),
            setNextSuspicious: (fn) => set({ nextSuspicious: fn }),

            editorSeverityFilter: 'all',
            setEditorSeverityFilter: (filter) => set({ editorSeverityFilter: filter }),
            ignoredSuspiciousKeys: [],
            ignoreSuspiciousKey: (key) => set((state) => (
                state.ignoredSuspiciousKeys.includes(key)
                    ? state
                    : { ignoredSuspiciousKeys: [...state.ignoredSuspiciousKeys, key] }
            )),
            clearIgnoredSuspiciousKeys: () => set({ ignoredSuspiciousKeys: [] }),
            ignoredSuspiciousPatterns: [],
            toggleIgnoredSuspiciousPattern: (patternKey) => set((state) => (
                state.ignoredSuspiciousPatterns.includes(patternKey)
                    ? { ignoredSuspiciousPatterns: state.ignoredSuspiciousPatterns.filter(p => p !== patternKey) }
                    : { ignoredSuspiciousPatterns: [...state.ignoredSuspiciousPatterns, patternKey] }
            )),
            clearIgnoredSuspiciousPatterns: () => set({ ignoredSuspiciousPatterns: [] }),
            showSoftFixDiff: false,
            setShowSoftFixDiff: (open) => set({ showSoftFixDiff: open }),
            softFixUndo: null,
            applySoftFixPreview: () => {
                const state = get()
                const preview = state.currentResult?.softFixPreview
                if (!preview || preview === state.originalContent) return
                set({
                    softFixUndo: state.originalContent,
                    originalContent: preview,
                    originalHtml: '',
                    cleanedContent: '',
                    cleanedHtml: '',
                    currentResult: null,
                    ignoredSuspiciousKeys: [],
                    ignoredSuspiciousPatterns: [],
                    showSoftFixDiff: false,
                    editorResetToken: get().editorResetToken + 1,
                })
            },
            undoSoftFixPreview: () => {
                const state = get()
                if (!state.softFixUndo) return
                set({
                    originalContent: state.softFixUndo,
                    originalHtml: '',
                    cleanedContent: '',
                    cleanedHtml: '',
                    currentResult: null,
                    softFixUndo: null,
                    ignoredSuspiciousKeys: [],
                    ignoredSuspiciousPatterns: [],
                    showSoftFixDiff: false,
                    editorResetToken: get().editorResetToken + 1,
                })
            },
            editorResetToken: 0,

            jumpRequest: undefined,
            requestJumpToMarkIndex: (markIndex) => set((state) => ({
                jumpRequest: { token: (state.jumpRequest?.token ?? 0) + 1, markIndex },
            })),

            lmStudio: defaultLmStudio,
            setLmStudio: (settings) => set((state) => ({ lmStudio: { ...state.lmStudio, ...settings } })),
            lmStudioHistory: [],
            addLmStudioHistory: (record) => set((state) => {
                const prev = state.lmStudioHistory ?? []
                const next = [record, ...prev.filter(r => r.id !== record.id)]
                return { lmStudioHistory: next.slice(0, 20) }
            }),
            clearLmStudioHistory: () => set({ lmStudioHistory: [] }),
        }),
        {
            name: 'ai-text-purifier-storage',
            version: 4,
            partialize: (state) => ({
                theme: state.theme,
                options: state.options,
                detailedSettings: state.detailedSettings,
                patterns: state.patterns.map(serializePattern) as unknown as AIPattern[],
                sidebarOpen: state.sidebarOpen,
                lmStudio: state.lmStudio,
                lmStudioHistory: state.lmStudioHistory,
            }),
            migrate: (persistedState: unknown, version: number) => {
                if (!persistedState || typeof persistedState !== 'object') return persistedState as never

                const state = persistedState as { patterns?: unknown; detailedSettings?: unknown; lmStudio?: unknown; lmStudioHistory?: unknown }
                const rawPatterns = Array.isArray(state.patterns) ? state.patterns : []

                const normalized: PersistedPattern[] = []
                for (const value of rawPatterns) {
                    if (!isRecord(value)) continue
                    const id = typeof value.id === 'string' ? value.id : ''
                    if (!id) continue

                    const enabled = Boolean(value.enabled)

                    let pattern: string | undefined
                    if (typeof value.pattern === 'string') {
                        pattern = value.pattern
                    } else if (value.pattern instanceof RegExp) {
                        pattern = `/${value.pattern.source}/${value.pattern.flags}`
                    }

                    const description = typeof value.description === 'string' ? value.description : undefined
                    const category = isPatternCategory(value.category) ? value.category : undefined

                    normalized.push({ id, enabled, pattern, description, category })
                }

                const patterns = normalizePatternsFromPersisted(normalized)

                const detailedSettings = isRecord(state.detailedSettings) ? state.detailedSettings : {}
                if (typeof detailedSettings.smartGarbageCleanup !== 'boolean') {
                    detailedSettings.smartGarbageCleanup = false
                }

                const lmStudio = isRecord(state.lmStudio) ? state.lmStudio : {}
                if (typeof lmStudio.enabled !== 'boolean') lmStudio.enabled = defaultLmStudio.enabled
                if (typeof lmStudio.baseUrl !== 'string') lmStudio.baseUrl = defaultLmStudio.baseUrl
                if (typeof lmStudio.model !== 'string') lmStudio.model = defaultLmStudio.model
                if (typeof lmStudio.temperature !== 'number') lmStudio.temperature = defaultLmStudio.temperature
                if (typeof lmStudio.maxTokens !== 'number') lmStudio.maxTokens = defaultLmStudio.maxTokens
                if (typeof lmStudio.chunkChars !== 'number') lmStudio.chunkChars = defaultLmStudio.chunkChars
                if (typeof lmStudio.parallelism !== 'number') lmStudio.parallelism = defaultLmStudio.parallelism
                if (typeof lmStudio.systemPrompt !== 'string') lmStudio.systemPrompt = defaultLmStudio.systemPrompt

                const historyRaw = Array.isArray(state.lmStudioHistory) ? state.lmStudioHistory : []
                const lmStudioHistory: LmStudioRunRecord[] = []
                for (const item of historyRaw) {
                    if (!isRecord(item)) continue
                    const id = typeof item.id === 'string' ? item.id : ''
                    if (!id) continue
                    const status = item.status === 'completed' || item.status === 'canceled' || item.status === 'error'
                        ? (item.status as LmStudioRunRecord['status'])
                        : 'completed'
                    lmStudioHistory.push({
                        id,
                        startedAt: typeof item.startedAt === 'number' ? item.startedAt : Date.now(),
                        finishedAt: typeof item.finishedAt === 'number' ? item.finishedAt : undefined,
                        status,
                        baseUrl: typeof item.baseUrl === 'string' ? item.baseUrl : String(lmStudio.baseUrl || ''),
                        model: typeof item.model === 'string' ? item.model : String(lmStudio.model || ''),
                        inputChars: typeof item.inputChars === 'number' ? item.inputChars : 0,
                        chunkChars: typeof item.chunkChars === 'number' ? item.chunkChars : defaultLmStudio.chunkChars,
                        chunks: typeof item.chunks === 'number' ? item.chunks : 0,
                        parallelism: typeof item.parallelism === 'number' ? item.parallelism : defaultLmStudio.parallelism,
                        error: typeof item.error === 'string' ? item.error : undefined,
                    })
                }
                lmStudioHistory.sort((a, b) => b.startedAt - a.startedAt)

                // v0/v1 stored patterns "as-is" and lost RegExp/replacement functions in JSON; v2 uses serialized patterns.
                if (version < 2) {
                    return { ...(persistedState as object), patterns, detailedSettings, lmStudio, lmStudioHistory } as never
                }

                if (version < 3) {
                    return { ...(persistedState as object), patterns, detailedSettings, lmStudio, lmStudioHistory } as never
                }

                if (version < 4) {
                    return { ...(persistedState as object), patterns, detailedSettings, lmStudio, lmStudioHistory } as never
                }

                return { ...(persistedState as object), patterns, detailedSettings, lmStudio, lmStudioHistory } as never
            },
        }
    )
)

// Initialize theme on load
if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('ai-text-purifier-storage')
    if (stored) {
        try {
            const { state } = JSON.parse(stored)
            if (state?.theme === 'dark') {
                document.documentElement.classList.add('dark')
            }
        } catch {
            // Ignore parse errors
        }
    } else {
        // Default to dark theme
        document.documentElement.classList.add('dark')
    }
}
