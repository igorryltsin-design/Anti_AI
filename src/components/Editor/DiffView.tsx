import { useMemo } from 'react'
import * as Diff from 'diff'
import { cn } from '@/lib/utils'

interface DiffViewProps {
    original: string
    modified: string
    className?: string
}

export function DiffView({ original, modified, className }: DiffViewProps) {
    const differences = useMemo(() => {
        return Diff.diffWords(original, modified)
    }, [original, modified])

    const stats = useMemo(() => {
        let added = 0
        let removed = 0

        differences.forEach(part => {
            if (part.added) {
                added += part.value.length
            } else if (part.removed) {
                removed += part.value.length
            }
        })

        return { added, removed }
    }, [differences])

    return (
        <div className={cn('rounded-lg border border-border bg-card', className)}>
            {/* Stats Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
                <span className="min-w-0 text-sm font-medium">Сравнение изменений</span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        +{stats.added} символов
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        -{stats.removed} символов
                    </span>
                </div>
            </div>

            {/* Diff Content */}
            <div className="max-h-[500px] overflow-auto p-4">
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {differences.map((part, index) => (
                        <span
                            key={index}
                            className={cn(
                                part.added && 'bg-success/20 text-success',
                                part.removed && 'bg-destructive/20 text-destructive line-through'
                            )}
                        >
                            {part.value}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

interface SplitDiffViewProps {
    original: string
    modified: string
    className?: string
}

export function SplitDiffView({ original, modified, className }: SplitDiffViewProps) {
    return (
        <div className={cn('grid grid-cols-2 gap-4', className)}>
            {/* Original */}
            <div className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                    <span className="text-sm font-medium">Оригинал</span>
                    <span className="text-xs text-muted-foreground">
                        {original.length} символов
                    </span>
                </div>
                <div className="max-h-[500px] overflow-auto p-4">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {original}
                    </div>
                </div>
            </div>

            {/* Modified */}
            <div className="rounded-lg border border-primary/30 bg-card">
                <div className="flex items-center justify-between border-b border-primary/30 bg-primary/5 px-4 py-2">
                    <span className="text-sm font-medium">Очищенный</span>
                    <span className="text-xs text-muted-foreground">
                        {modified.length} символов
                    </span>
                </div>
                <div className="max-h-[500px] overflow-auto p-4">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {modified}
                    </div>
                </div>
            </div>
        </div>
    )
}
