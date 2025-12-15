import { Moon, Sun, Menu, Sparkles, Bot, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { useCleaningStore } from '@/store/useCleaningStore'
import type { CleaningResult } from '@/lib/cleaningEngine'

interface HeaderProps {
    stats?: CleaningResult['stats'] | null
    suspiciousCount?: number
}

export function Header({ stats, suspiciousCount = 0 }: HeaderProps) {
    const { theme, toggleTheme, toggleSidebar } = useCleaningStore()
    const prevSuspicious = useCleaningStore(state => state.prevSuspicious)
    const nextSuspicious = useCleaningStore(state => state.nextSuspicious)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const detailsRef = useRef<HTMLDivElement>(null)

    const aiScore = stats?.aiSuspicionScore ?? 0
    const severity = stats?.aiSeverity ?? { low: 0, medium: 0, high: 0 }
    const confidence =
        aiScore >= 0.7 ? 'Высокая'
            : aiScore >= 0.35 ? 'Средняя'
                : 'Низкая'

    useEffect(() => {
        if (!detailsOpen) return
        const onDown = (e: MouseEvent) => {
            const el = detailsRef.current
            if (!el) return
            if (e.target instanceof Node && el.contains(e.target)) return
            setDetailsOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [detailsOpen])

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        className="md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight">
                                AntiAi
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-end gap-4">
                    {stats && (
                        <div className="relative hidden lg:flex items-center gap-3 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm">
                            <span className="flex items-center gap-2 font-medium">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Анализ:
                            </span>
                            <span className="flex items-center gap-1">
                                <Bot className="h-3 w-3 text-primary" />
                                Индекс: {(aiScore * 100).toFixed(0)}%
                            </span>
                            <span className="flex items-center gap-1">
                                <Bot className="h-3 w-3 text-destructive" />
                                Подозрения: {suspiciousCount} ({confidence})
                            </span>
                            <span className="flex items-center gap-1">
                                Серьёзность: H:{severity.high} / M:{severity.medium} / L:{severity.low}
                            </span>
                            <span className="font-semibold text-primary">
                                Всего: {stats.totalChanges}
                            </span>

                            <div ref={detailsRef}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDetailsOpen(v => !v)}
                                    className="ml-1"
                                >
                                    {detailsOpen ? 'Скрыть' : 'Подробнее'}
                                </Button>

                                {detailsOpen && (
                                    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-background p-3 shadow-xl">
                                        <div className="text-xs font-semibold text-foreground">Подробная статистика</div>
                                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
                                            <div>Невидимые</div>
                                            <div className="text-right text-foreground">{stats.invisibleCharsRemoved}</div>
                                            <div>Кавычки</div>
                                            <div className="text-right text-foreground">{stats.quotesNormalized}</div>
                                            <div>Тире</div>
                                            <div className="text-right text-foreground">{stats.dashesNormalized}</div>
                                            <div>Пустые строки</div>
                                            <div className="text-right text-foreground">{stats.emptyLinesRemoved}</div>
                                            <div>AI-паттерны (найдено)</div>
                                            <div className="text-right text-foreground">{stats.aiPatternsFound}</div>
                                            <div>AI-паттерны (мягкие)</div>
                                            <div className="text-right text-foreground">{stats.aiPatternsRemoved}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {(prevSuspicious || nextSuspicious) && suspiciousCount > 0 && (
                        <div className="hidden sm:flex items-center rounded-xl border border-border bg-muted/40 p-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => prevSuspicious?.()}
                                disabled={!prevSuspicious}
                                title="Предыдущее подозрение (Shift+F3)"
                                className="h-9 w-9"
                            >
                                <SkipBack className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => nextSuspicious?.()}
                                disabled={!nextSuspicious}
                                title="Следующее подозрение (F3)"
                                className="h-9 w-9"
                            >
                                <SkipForward className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="relative overflow-hidden"
                    >
                        <Sun className={`h-5 w-5 transition-all duration-300 ${theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'}`} />
                        <Moon className={`absolute h-5 w-5 transition-all duration-300 ${theme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0'}`} />
                        <span className="sr-only">Переключить тему</span>
                    </Button>
                </div>
            </div>
        </header>
    )
}
