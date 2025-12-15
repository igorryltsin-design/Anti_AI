import {
    Eraser,
    Sparkles,
    Layout,
    Bot,
    Shuffle,
    RotateCcw,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Switch } from '@/components/ui'
import { useCleaningStore } from '@/store/useCleaningStore'
import { cn } from '@/lib/utils'

export function CleaningSettings() {
    const { options, setOptions, resetOptions, patterns, togglePattern } = useCleaningStore()
    const [showPatterns, setShowPatterns] = useState(false)

    const cleaningLevels = [
        {
            id: 'basic' as const,
            label: 'Basic',
            description: 'Zero-width spaces, кавычки, пробелы',
            icon: Eraser,
            color: 'text-blue-500',
        },
        {
            id: 'structure' as const,
            label: 'Structure',
            description: 'Пустые строки, нормализация списков',
            icon: Layout,
            color: 'text-green-500',
        },
        {
            id: 'aiPatterns' as const,
            label: 'AI Patterns',
            description: 'Поиск и удаление ИИ-клише',
            icon: Bot,
            color: 'text-purple-500',
        },
        {
            id: 'humanizer' as const,
            label: 'Humanizer',
            description: 'Микро-вариации (осторожно!)',
            icon: Shuffle,
            color: 'text-orange-500',
            warning: true,
        },
    ]

    const enabledPatternsCount = patterns.filter(p => p.enabled).length

    return (
        <Card className="animate-fade-in">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Глубина очистки
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetOptions}
                        className="h-8 text-xs"
                    >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Сбросить
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {cleaningLevels.map((level) => (
                    <div
                        key={level.id}
                        className={cn(
                            'flex items-center justify-between rounded-lg border p-3 transition-all duration-200',
                            options[level.id]
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-border hover:border-muted-foreground/30'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <level.icon className={cn('h-5 w-5', level.color)} />
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{level.label}</span>
                                    {level.warning && (
                                        <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                            ⚠️ Эксп.
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {level.description}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={options[level.id]}
                            onChange={(e) => setOptions({ [level.id]: e.target.checked })}
                        />
                    </div>
                ))}

                {/* AI Patterns Section */}
                {options.aiPatterns && (
                    <div className="pt-2">
                        <button
                            onClick={() => setShowPatterns(!showPatterns)}
                            className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                        >
                            <div>
                                <span className="text-sm font-medium">Настроить паттерны</span>
                                <p className="text-xs text-muted-foreground">
                                    {enabledPatternsCount} из {patterns.length} активно
                                </p>
                            </div>
                            {showPatterns ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>

                        {showPatterns && (
                            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                                {patterns.map((pattern) => (
                                    <label
                                        key={pattern.id}
                                        className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
                                    >
                                        <span className={cn(
                                            'text-xs',
                                            !pattern.enabled && 'text-muted-foreground line-through'
                                        )}>
                                            {pattern.description}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={pattern.enabled}
                                            onChange={() => togglePattern(pattern.id)}
                                            className="h-4 w-4 rounded border-border"
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
