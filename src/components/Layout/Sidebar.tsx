import {
    FileEdit,
    Files,
    Settings,
    X,
    SlidersHorizontal,
    Minus,
    Quote,
    AlertTriangle,
    Filter,
    Search,
    EyeOff,
    Ban,
    ChevronRight,
    Trash2,
    Wand2,
    Eye,
    RotateCcw,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { useCleaningStore } from '@/store/useCleaningStore'
import { DiffView } from '@/components/Editor/DiffView'

interface SidebarProps {
    activeTab: 'editor' | 'batch' | 'settings'
    onTabChange: (tab: 'editor' | 'batch' | 'settings') => void
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
    const {
        sidebarOpen,
        setSidebarOpen,
        originalContent,
        cleanedContent,
        cleanedStale,
        currentResult,
        jumpRequest,
        editorSeverityFilter,
        setEditorSeverityFilter,
        ignoredSuspiciousKeys,
        ignoreSuspiciousKey,
        clearIgnoredSuspiciousKeys,
        ignoredSuspiciousPatterns,
        toggleIgnoredSuspiciousPattern,
        clearIgnoredSuspiciousPatterns,
        showSoftFixDiff,
        setShowSoftFixDiff,
        softFixUndo,
        applySoftFixPreview,
        undoSoftFixPreview,
        requestJumpToMarkIndex,
        setViewMode,
    } = useCleaningStore()
    const detailedSettings = useCleaningStore(state => state.detailedSettings)
    const [suspicionsOpen, setSuspicionsOpen] = useState(true)
    const [softFixesOpen, setSoftFixesOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [suspicionQuery, setSuspicionQuery] = useState('')

    const categoryLabel = useCallback((cat: string) => {
        switch (cat) {
            case 'structure': return 'Структура/кальки'
            case 'phrase': return 'Фразы'
            case 'transition': return 'Переходы'
            case 'filler': return 'Вода'
            default: return cat
        }
    }, [])

    const navItems = [
        { id: 'editor' as const, label: 'Редактор', icon: FileEdit },
        { id: 'batch' as const, label: 'Пакетная обработка', icon: Files },
        { id: 'settings' as const, label: 'Настройки', icon: Settings },
    ]

    const useCleanedAsActive = Boolean(cleanedContent && !cleanedStale)
    const activeText = useMemo(
        () => (useCleanedAsActive ? cleanedContent : originalContent),
        [cleanedContent, originalContent, useCleanedAsActive]
    )
    const ranges = useMemo(
        () => currentResult?.suspiciousRanges ?? [],
        [currentResult?.suspiciousRanges]
    )

    const filteredRanges = useMemo(() => {
        const bySeverity = editorSeverityFilter === 'all'
            ? ranges
            : ranges.filter(r => r.severity === editorSeverityFilter)
        const byCategory = categoryFilter === 'all'
            ? bySeverity
            : bySeverity.filter(r => r.category === categoryFilter)
        const q = suspicionQuery.trim().toLowerCase()
        if (!q) return byCategory

        return byCategory.filter((r) => {
            const pattern = (r.pattern || '').toLowerCase()
            if (pattern.includes(q)) return true
            const cat = categoryLabel(r.category || '').toLowerCase()
            if (cat.includes(q)) return true
            const left = Math.max(0, r.start - 40)
            const right = Math.min(activeText.length, r.end + 40)
            const excerpt = activeText.slice(left, right).replace(/\s+/g, ' ').toLowerCase()
            return excerpt.includes(q)
        })
    }, [activeText, categoryFilter, categoryLabel, editorSeverityFilter, ranges, suspicionQuery])

    const availableCategories = useMemo(() => {
        const set = new Set<string>()
        for (const r of ranges) {
            if (r.category) set.add(r.category)
        }
        return Array.from(set).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)))
    }, [categoryLabel, ranges])

    const makeSuspiciousKey = useCallback((patternId: string | undefined, pattern: string, start: number, end: number) => {
        const pid = patternId || pattern
        return `${pid}:${start}:${end}`
    }, [])

    const makePatternKey = useCallback((patternId: string | undefined, pattern: string) => {
        return patternId ? `id:${patternId}` : `p:${pattern}`
    }, [])

    const mergedSegments = useMemo(() => {
        const normalized = ranges
            .map(r => ({
                start: Math.max(0, Math.min(activeText.length, r.start)),
                end: Math.max(0, Math.min(activeText.length, r.end)),
            }))
            .filter(r => r.end > r.start && (r.end - r.start) >= 3)
            .sort((a, b) => a.start - b.start)

        const merged: { start: number; end: number }[] = []
        for (const range of normalized) {
            const last = merged[merged.length - 1]
            if (last && range.start <= last.end) {
                last.end = Math.max(last.end, range.end)
            } else {
                merged.push({ ...range })
            }
        }
        return merged
    }, [activeText.length, ranges])

    const findSegmentIndex = useCallback((start: number, end: number) => {
        for (let i = 0; i < mergedSegments.length; i++) {
            const seg = mergedSegments[i]
            if (start >= seg.start && end <= seg.end) return i
        }
        return 0
    }, [mergedSegments])

    const handleJump = useCallback((start: number, end: number) => {
        setViewMode('editor')
        const segmentIndex = findSegmentIndex(start, end)
        requestJumpToMarkIndex(segmentIndex)
        setSidebarOpen(false)
    }, [findSegmentIndex, requestJumpToMarkIndex, setSidebarOpen, setViewMode])

    const groupedRanges = useMemo(() => {
        const groups: Record<'high' | 'medium' | 'low', typeof filteredRanges> = {
            high: [],
            medium: [],
            low: [],
        }
        for (const r of filteredRanges) groups[r.severity].push(r)
        return groups
    }, [filteredRanges])

    const renderContext = useCallback((start: number, end: number) => {
        const text = activeText
        const pad = 34
        const left = Math.max(0, start - pad)
        const right = Math.min(text.length, end + pad)
        const excerpt = text.slice(left, right).replace(/\s+/g, ' ')

        const hs = Math.max(0, start - left)
        const he = Math.max(hs, end - left)
        const prefix = excerpt.slice(0, hs)
        const hit = excerpt.slice(hs, he)
        const suffix = excerpt.slice(he)

        return (
            <span className="break-words">
                {left > 0 ? '…' : ''}
                {prefix}
                <span className="rounded-sm bg-warning/30 px-0.5">
                    {hit || ' '}
                </span>
                {suffix}
                {right < text.length ? '…' : ''}
            </span>
        )
    }, [activeText])

    const softFixPreview = currentResult?.softFixPreview
    const canApplySoftFix = Boolean(softFixPreview && softFixPreview !== originalContent)

    return (
        <>
            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-border bg-background transition-transform duration-300 md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0 md:overflow-y-auto',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex h-full flex-col">
                    {/* Mobile close button */}
                    <div className="flex items-center justify-between border-b border-border p-4 md:hidden">
                        <span className="font-semibold">Меню</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-1 p-4">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Навигация
                        </p>
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onTabChange(item.id)
                                    setSidebarOpen(false)
                                }}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                    activeTab === item.id
                                        ? 'bg-primary text-primary-foreground shadow-md'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </button>
                        ))}

                        <div className="mt-6 rounded-lg border border-border bg-muted/40">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 px-3 py-2"
                                onClick={() => setSettingsOpen(v => !v)}
                            >
                                <div className="flex items-center gap-2 text-foreground">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Текущие настройки</span>
                                </div>
                                <ChevronRight className={cn('h-4 w-4 transition-transform', settingsOpen && 'rotate-90')} />
                            </button>
                            {settingsOpen && (
                                <div className="px-3 pb-3 text-xs text-muted-foreground">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Quote className="h-4 w-4 text-muted-foreground" />
                                            <span>Кавычки: {detailedSettings.quotesDirection === 'toTypographic' ? '" → «»' : '«» → "'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Minus className="h-4 w-4 text-muted-foreground" />
                                            <span>Тире: {detailedSettings.dashStyle === 'emToEn' ? '— → –' : detailedSettings.dashStyle === 'enToEm' ? '– → —' : 'Все в дефис'}</span>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-[10px]">Настройте в разделе «Настройки»</p>
                                </div>
                            )}
                        </div>

                        {activeTab === 'editor' && (
                            <>
                                <div className="mt-6 rounded-lg border border-border bg-muted/30">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-2 px-3 py-2"
                                        onClick={() => setSuspicionsOpen(v => !v)}
                                    >
                                        <div className="flex items-center gap-2 text-foreground">
                                            <AlertTriangle className="h-4 w-4 text-warning" />
                                            <span className="font-semibold text-sm">Подозрения</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {filteredRanges.length}
                                            </span>
                                            <ChevronRight className={cn('h-4 w-4 transition-transform', suspicionsOpen && 'rotate-90')} />
                                        </div>
                                    </button>

                                    {suspicionsOpen && (
                                        <div className="px-3 pb-3">
                                            <div className="flex items-center gap-2">
                                                <Filter className="h-4 w-4 text-muted-foreground" />
                                                <select
                                                    value={editorSeverityFilter}
                                                    onChange={(e) => setEditorSeverityFilter(e.target.value as typeof editorSeverityFilter)}
                                                    className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs"
                                                >
                                                    <option value="all">Все</option>
                                                    <option value="high">Высокая</option>
                                                    <option value="medium">Средняя</option>
                                                    <option value="low">Низкая</option>
                                                </select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        clearIgnoredSuspiciousKeys()
                                                        clearIgnoredSuspiciousPatterns()
                                                        setCategoryFilter('all')
                                                        setEditorSeverityFilter('all')
                                                        setSuspicionQuery('')
                                                    }}
                                                    title="Сбросить фильтры и игнор"
                                                    disabled={!ignoredSuspiciousKeys.length && !ignoredSuspiciousPatterns.length && editorSeverityFilter === 'all' && categoryFilter === 'all' && !suspicionQuery.trim()}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="mt-2 flex items-center gap-2">
                                                <Search className="h-4 w-4 text-muted-foreground" />
                                                <input
                                                    value={suspicionQuery}
                                                    onChange={(e) => setSuspicionQuery(e.target.value)}
                                                    placeholder="Поиск…"
                                                    className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs"
                                                />
                                            </div>

                                            {availableCategories.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCategoryFilter('all')}
                                                        className={cn(
                                                            'rounded-full border px-2 py-1 text-[10px] transition-colors',
                                                            categoryFilter === 'all'
                                                                ? 'border-primary bg-primary text-primary-foreground'
                                                                : 'border-border bg-card text-muted-foreground hover:text-foreground'
                                                        )}
                                                    >
                                                        Все типы
                                                    </button>
                                                    {availableCategories.map((cat) => (
                                                        <button
                                                            key={cat}
                                                            type="button"
                                                            onClick={() => setCategoryFilter(cat)}
                                                            className={cn(
                                                                'rounded-full border px-2 py-1 text-[10px] transition-colors',
                                                                categoryFilter === cat
                                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                                                            )}
                                                        >
                                                            {categoryLabel(cat)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-background/50">
                                                {ranges.length === 0 ? (
                                                    <div className="p-3 text-xs text-muted-foreground">
                                                        Подозрительные места появятся здесь после анализа текста.
                                                    </div>
                                                ) : filteredRanges.length === 0 ? (
                                                    <div className="p-3 text-xs text-muted-foreground">
                                                        Нет совпадений по выбранным фильтрам.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 p-2">
                                                        {(editorSeverityFilter === 'all'
                                                            ? (['high', 'medium', 'low'] as const).flatMap((sev) => {
                                                                const items = groupedRanges[sev]
                                                                if (!items.length) return []
                                                                return [{ __kind: 'header' as const, severity: sev }, ...items.map(r => ({ __kind: 'item' as const, range: r }))]
                                                            })
                                                            : filteredRanges.map(r => ({ __kind: 'item' as const, range: r }))
                                                        ).slice(0, 240).map((entry, idx) => {
                                                            if (entry.__kind === 'header') {
                                                                const label = entry.severity === 'high' ? 'Высокая' : entry.severity === 'medium' ? 'Средняя' : 'Низкая'
                                                                const count = groupedRanges[entry.severity].length
                                                                return (
                                                                    <div key={`h:${entry.severity}:${idx}`} className="px-1 pt-1 text-[10px] font-semibold text-muted-foreground">
                                                                        {label} · {count}
                                                                    </div>
                                                                )
                                                            }

                                                            const range = entry.range
                                                            const key = makeSuspiciousKey(range.patternId, range.pattern, range.start, range.end)
                                                            const patternKey = makePatternKey(range.patternId, range.pattern)
                                                            const severityDot =
                                                                range.severity === 'high' ? 'bg-destructive'
                                                                    : range.severity === 'medium' ? 'bg-warning'
                                                                        : 'bg-muted-foreground'
                                                            const isIgnored = ignoredSuspiciousKeys.includes(key)
                                                            const isPatternIgnored = ignoredSuspiciousPatterns.includes(patternKey)
                                                            const isActive = (jumpRequest?.markIndex ?? 0) === findSegmentIndex(range.start, range.end)

                                                            const onActivate = () => handleJump(range.start, range.end)

                                                            return (
                                                                <div
                                                                    key={key}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onClick={onActivate}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                                            e.preventDefault()
                                                                            onActivate()
                                                                        }
                                                                    }}
                                                                    className={cn(
                                                                        'w-full cursor-pointer rounded-md border border-border bg-card px-2 py-2 text-left transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary',
                                                                        isActive && 'ring-1 ring-primary',
                                                                        isIgnored && 'opacity-60'
                                                                    )}
                                                                >
                                                                    <div className="flex items-start gap-2">
                                                                        <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', severityDot)} />
                                                                        <div className="min-w-0 flex-1 space-y-1">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                                                                                    {categoryLabel(range.category)} · {range.pattern}
                                                                                </span>
                                                                                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                                            </div>
                                                                            <div className="text-xs">
                                                                                {renderContext(range.start, range.end)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-2 flex justify-end gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                toggleIgnoredSuspiciousPattern(patternKey)
                                                                            }}
                                                                            className="h-7 px-2 text-[10px]"
                                                                            title={isPatternIgnored ? 'Вернуть все совпадения паттерна' : 'Игнорировать все совпадения паттерна'}
                                                                        >
                                                                            {isPatternIgnored ? (
                                                                                <>
                                                                                    <Eye className="mr-1 h-3 w-3" />
                                                                                    Паттерн
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Ban className="mr-1 h-3 w-3" />
                                                                                    Паттерн
                                                                                </>
                                                                            )}
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                ignoreSuspiciousKey(key)
                                                                            }}
                                                                            className="h-7 px-2 text-[10px]"
                                                                        >
                                                                            <EyeOff className="mr-1 h-3 w-3" />
                                                                            Игнор
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            {filteredRanges.length > 240 && (
                                                <p className="mt-2 text-[10px] text-muted-foreground">
                                                    Показаны первые 240.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 rounded-lg border border-border bg-muted/30">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-2 px-3 py-2"
                                        onClick={() => setSoftFixesOpen(v => !v)}
                                    >
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Wand2 className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-sm">Мягкие правки</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {currentResult?.stats.aiPatternsRemoved ?? 0}
                                            </span>
                                            <ChevronRight className={cn('h-4 w-4 transition-transform', softFixesOpen && 'rotate-90')} />
                                        </div>
                                    </button>

                                    {softFixesOpen && (
                                        <div className="px-3 pb-3">
                                            <p className="text-xs text-muted-foreground">
                                                Безопасные замены по паттернам (без другой очистки).
                                            </p>

                                            <div className="mt-2 grid grid-cols-[1fr,auto] items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        applySoftFixPreview()
                                                        setSidebarOpen(false)
                                                    }}
                                                    disabled={!canApplySoftFix}
                                                    className="h-8 min-w-0 px-2 text-xs"
                                                >
                                                    Применить безопасные ({currentResult?.stats.aiPatternsRemoved ?? 0})
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        undoSoftFixPreview()
                                                        setSidebarOpen(false)
                                                    }}
                                                    disabled={!softFixUndo}
                                                    className="h-8 px-2"
                                                    title="Отменить мягкие правки"
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                    <span className="sr-only">Undo</span>
                                                </Button>
                                            </div>

                                            <div className="mt-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setShowSoftFixDiff(!showSoftFixDiff)}
                                                    disabled={!softFixPreview || softFixPreview === originalContent}
                                                    className="h-8 w-full justify-center px-2 text-xs"
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    {showSoftFixDiff ? 'Скрыть сравнение' : 'Показать сравнение'}
                                                </Button>
                                            </div>

                                            {showSoftFixDiff && softFixPreview && softFixPreview !== originalContent && (
                                                <div className="mt-2">
                                                    <DiffView original={originalContent} modified={softFixPreview} className="max-h-[260px]" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </nav>

                    {/* Footer removed */}
                </div>
            </aside>
        </>
    )
}
