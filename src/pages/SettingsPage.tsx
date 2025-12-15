import { useState } from 'react'
import {
    Settings,
    RotateCcw,
    Quote,
    Minus,
    Eye,
    Eraser,
    Bot,
    ChevronDown,
    ChevronUp,
    Sparkles,
    AlignLeft,
    Cpu,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Switch, Badge } from '@/components/ui'
import { useCleaningStore } from '@/store/useCleaningStore'
import { cn } from '@/lib/utils'
import { fetchLmStudioModels } from '@/lib/lmStudioClient'

export function SettingsPage() {
    const {
        options,
        setOptions,
        resetOptions,
        detailedSettings,
        setDetailedSettings,
        resetDetailedSettings,
        lmStudio,
        setLmStudio,
        lmStudioHistory,
        clearLmStudioHistory,
        patterns,
        togglePattern,
        resetPatterns,
        addCustomPattern,
        removePattern,
    } = useCleaningStore()

    const [showPatterns, setShowPatterns] = useState(false)
    const [newPattern, setNewPattern] = useState('')
    const [newPatternDesc, setNewPatternDesc] = useState('')
    const [lmModels, setLmModels] = useState<string[]>([])
    const [lmModelsLoading, setLmModelsLoading] = useState(false)
    const enabledPatternsCount = patterns.filter(p => p.enabled).length

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Settings className="h-6 w-6 text-primary" />
                        Настройки очистки
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Детальная настройка алгоритмов очистки текста
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        resetOptions()
                        resetDetailedSettings()
                        resetPatterns()
                    }}
                >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Сбросить всё
                </Button>
            </div>

            {/* Main Cleaning Levels */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Уровни очистки
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    {[
                        { id: 'basic' as const, label: 'Базовая', description: 'Невидимые символы, кавычки, тире, пробелы', color: 'text-blue-500' },
                        { id: 'structure' as const, label: 'Структура', description: 'Пустые строки, списки, отступы', color: 'text-green-500' },
                        { id: 'aiPatterns' as const, label: 'AI Паттерны', description: 'Поиск и удаление ИИ-клише', color: 'text-purple-500' },
                        { id: 'humanizer' as const, label: 'Humanizer', description: 'Микро-вариации (эксп.)', color: 'text-orange-500', warning: true },
                    ].map((level) => (
                        <label
                            key={level.id}
                            className={cn(
                                'flex items-center justify-between rounded-lg border p-4 transition-all duration-200 cursor-pointer',
                                options[level.id]
                                    ? 'border-primary/30 bg-primary/5'
                                    : 'border-border hover:border-muted-foreground/30'
                            )}
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={cn('font-medium', level.color)}>{level.label}</span>
                                    {level.warning && (
                                        <Badge variant="warning" className="text-[10px]">⚠️ Эксп.</Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {level.description}
                                </p>
                            </div>
                            <Switch
                                checked={options[level.id]}
                                onChange={(e) => setOptions({ [level.id]: e.target.checked })}
                            />
                        </label>
                    ))}
                </CardContent>
            </Card>

            {/* Quote Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Quote className="h-5 w-5 text-primary" />
                        Кавычки
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Нормализовать кавычки</p>
                            <p className="text-xs text-muted-foreground">Автоматически преобразовывать кавычки</p>
                        </div>
                        <Switch
                            id="normalize-quotes"
                            checked={detailedSettings.normalizeQuotes}
                            onChange={(e) => setDetailedSettings({ normalizeQuotes: e.target.checked })}
                        />
                    </label>

                    {detailedSettings.normalizeQuotes && (
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <p className="text-sm font-medium">Направление замены:</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <button
                                    onClick={() => setDetailedSettings({ quotesDirection: 'toTypographic' })}
                                    className={cn(
                                        'rounded-lg border p-3 text-left transition-all',
                                        detailedSettings.quotesDirection === 'toTypographic'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-muted-foreground/50'
                                    )}
                                >
                                    <p className="font-medium">" → «»</p>
                                    <p className="text-xs text-muted-foreground">
                                        Типографские (русский стиль)
                                    </p>
                                </button>
                                <button
                                    onClick={() => setDetailedSettings({ quotesDirection: 'toStraight' })}
                                    className={cn(
                                        'rounded-lg border p-3 text-left transition-all',
                                        detailedSettings.quotesDirection === 'toStraight'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-muted-foreground/50'
                                    )}
                                >
                                    <p className="font-medium">«» → "</p>
                                    <p className="text-xs text-muted-foreground">
                                        Обычные (программистский стиль)
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dash Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Minus className="h-5 w-5 text-primary" />
                        Тире
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Нормализовать тире</p>
                            <p className="text-xs text-muted-foreground">Преобразовывать разные типы тире</p>
                        </div>
                        <Switch
                            id="normalize-dashes"
                            checked={detailedSettings.normalizeDashes}
                            onChange={(e) => setDetailedSettings({ normalizeDashes: e.target.checked })}
                        />
                    </label>

                    {detailedSettings.normalizeDashes && (
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <p className="text-sm font-medium">Стиль тире:</p>
                            <div className="grid gap-2 sm:grid-cols-3">
                                <button
                                    onClick={() => setDetailedSettings({ dashStyle: 'emToEn' })}
                                    className={cn(
                                        'rounded-lg border p-3 text-left transition-all',
                                        detailedSettings.dashStyle === 'emToEn'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-muted-foreground/50'
                                    )}
                                >
                                    <p className="font-medium">— → –</p>
                                    <p className="text-xs text-muted-foreground">
                                        Длинное в среднее
                                    </p>
                                </button>
                                <button
                                    onClick={() => setDetailedSettings({ dashStyle: 'enToEm' })}
                                    className={cn(
                                        'rounded-lg border p-3 text-left transition-all',
                                        detailedSettings.dashStyle === 'enToEm'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-muted-foreground/50'
                                    )}
                                >
                                    <p className="font-medium">– → —</p>
                                    <p className="text-xs text-muted-foreground">
                                        Среднее в длинное
                                    </p>
                                </button>
                                <button
                                    onClick={() => setDetailedSettings({ dashStyle: 'toHyphen' })}
                                    className={cn(
                                        'rounded-lg border p-3 text-left transition-all',
                                        detailedSettings.dashStyle === 'toHyphen'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-muted-foreground/50'
                                    )}
                                >
                                    <p className="font-medium">Все → -</p>
                                    <p className="text-xs text-muted-foreground">
                                        В дефис (не рек.)
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Invisible Characters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Eye className="h-5 w-5 text-primary" />
                        Невидимые символы
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Удалять невидимые символы</p>
                            <p className="text-xs text-muted-foreground">Zero-width spaces, BOM и другие</p>
                        </div>
                        <Switch
                            id="remove-invisible-chars"
                            checked={detailedSettings.removeInvisibleChars}
                            onChange={(e) => setDetailedSettings({ removeInvisibleChars: e.target.checked })}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Конвертировать неразрывные пробелы</p>
                            <p className="text-xs text-muted-foreground">NBSP → обычный пробел</p>
                        </div>
                        <Switch
                            id="convert-nbsp"
                            checked={detailedSettings.convertNbsp}
                            onChange={(e) => setDetailedSettings({ convertNbsp: e.target.checked })}
                        />
                    </label>
                </CardContent>
            </Card>

            {/* Spacing & Structure */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <AlignLeft className="h-5 w-5 text-primary" />
                        Пробелы и структура
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Нормализовать пробелы</p>
                            <p className="text-xs text-muted-foreground">Множественные пробелы → один</p>
                        </div>
                        <Switch
                            id="normalize-spaces"
                            checked={detailedSettings.normalizeSpaces}
                            onChange={(e) => setDetailedSettings({ normalizeSpaces: e.target.checked })}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Удалять лишние пустые строки</p>
                            <p className="text-xs text-muted-foreground">Оставлять максимум 2 подряд</p>
                        </div>
                        <Switch
                            id="remove-extra-lines"
                            checked={detailedSettings.removeExtraLines}
                            onChange={(e) => setDetailedSettings({ removeExtraLines: e.target.checked })}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Обрезать пробелы в строках</p>
                            <p className="text-xs text-muted-foreground">Удалять начальные и конечные пробелы</p>
                        </div>
                        <Switch
                            id="trim-lines"
                            checked={detailedSettings.trimLines}
                            onChange={(e) => setDetailedSettings({ trimLines: e.target.checked })}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Нормализовать списки</p>
                            <p className="text-xs text-muted-foreground">Унифицировать маркеры списков</p>
                        </div>
                        <Switch
                            id="normalize-lists"
                            checked={detailedSettings.normalizeLists}
                            onChange={(e) => setDetailedSettings({ normalizeLists: e.target.checked })}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Строчная после двоеточия</p>
                            <p className="text-xs text-muted-foreground">В середине предложения: слово после «:» с маленькой буквы</p>
                        </div>
                        <Switch
                            id="lowercase-after-colon"
                            checked={detailedSettings.lowercaseAfterColon}
                            onChange={(e) => setDetailedSettings({ lowercaseAfterColon: e.target.checked })}
                        />
                    </label>
                </CardContent>
            </Card>

            {/* Typography Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <AlignLeft className="h-5 w-5 text-primary" />
                        Типографика
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Буква Ё</p>
                                <p className="text-xs text-muted-foreground">Обработка буквы Ё в тексте</p>
                            </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                            <button
                                onClick={() => setDetailedSettings({ yoLetter: 'restore' })}
                                className={cn(
                                    'rounded-lg border p-3 text-left transition-all',
                                    detailedSettings.yoLetter === 'restore'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-muted-foreground/50'
                                )}
                            >
                                <p className="font-medium">Восстановить</p>
                                <p className="text-xs text-muted-foreground">Е → Ё (где возможно)</p>
                            </button>
                            <button
                                onClick={() => setDetailedSettings({ yoLetter: 'replace' })}
                                className={cn(
                                    'rounded-lg border p-3 text-left transition-all',
                                    detailedSettings.yoLetter === 'replace'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-muted-foreground/50'
                                )}
                            >
                                <p className="font-medium">Заменить</p>
                                <p className="text-xs text-muted-foreground">Ё → Е</p>
                            </button>
                            <button
                                onClick={() => setDetailedSettings({ yoLetter: 'ignore' })}
                                className={cn(
                                    'rounded-lg border p-3 text-left transition-all',
                                    detailedSettings.yoLetter === 'ignore'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-muted-foreground/50'
                                )}
                            >
                                <p className="font-medium">Не трогать</p>
                                <p className="text-xs text-muted-foreground">Оставить как есть</p>
                            </button>
                        </div>
                    </div>

                    <label className="flex items-center justify-between pt-2 border-t border-border cursor-pointer">
                        <div>
                            <p className="font-medium">Висячие предлоги</p>
                            <p className="text-xs text-muted-foreground">Неразрывный пробел после коротких предлогов</p>
                        </div>
                        <Switch
                            id="hanging-prepositions"
                            checked={detailedSettings.hangingPrepositions}
                            onChange={(e) => setDetailedSettings({ hangingPrepositions: e.target.checked })}
                        />
                    </label>
                </CardContent>
            </Card>

            {/* Garbage / Decorative Cleanup */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Eraser className="h-5 w-5 text-primary" />
                        Мусор и рамки
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Умная очистка “декора”</p>
                            <p className="text-xs text-muted-foreground">
                                Убирает рамки/служебные строки и ближайшие дубли (консервативно).
                            </p>
                        </div>
                        <Switch
                            checked={Boolean(detailedSettings.smartGarbageCleanup)}
                            onChange={(e) => setDetailedSettings({ smartGarbageCleanup: e.target.checked })}
                        />
                    </label>
                    <p className="text-xs text-muted-foreground">
                        Работает только при включённом уровне «Структура».
                    </p>
                </CardContent>
            </Card>

            {/* Content Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Eye className="h-5 w-5 text-primary" />
                        Контент
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Удалять эмодзи</p>
                            <p className="text-xs text-muted-foreground">Удаляет все emoji символы</p>
                        </div>
                        <Switch
                            id="remove-emojis"
                            checked={detailedSettings.removeEmojis}
                            onChange={(e) => setDetailedSettings({ removeEmojis: e.target.checked })}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Удалять ссылки</p>
                            <p className="text-xs text-muted-foreground">Заменяет URL на [ссылка удалена]</p>
                        </div>
                        <Switch
                            id="remove-links"
                            checked={detailedSettings.removeLinks}
                            onChange={(e) => setDetailedSettings({ removeLinks: e.target.checked })}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Удалять Email адреса</p>
                            <p className="text-xs text-muted-foreground">Заменяет email на [email удален]</p>
                        </div>
                        <Switch
                            id="remove-emails"
                            checked={detailedSettings.removeEmails}
                            onChange={(e) => setDetailedSettings({ removeEmails: e.target.checked })}
                        />
                    </label>
                </CardContent>
            </Card>

            {/* AI Patterns */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bot className="h-5 w-5 text-primary" />
                        AI Паттерны
                        <Badge variant="secondary" className="ml-auto">
                            {enabledPatternsCount} / {patterns.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Паттерны используются для обнаружения и удаления типичных ИИ-клише из текста.
                        Включите уровень "AI Паттерны" для их автоматического удаления.
                    </p>

                    <button
                        onClick={() => setShowPatterns(!showPatterns)}
                        className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                    >
                        <div>
                            <span className="font-medium">Управление паттернами</span>
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
                        <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                            <div className="mb-3 space-y-2 rounded-md border border-dashed border-border p-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Свой паттерн (строка или простое regex-выражение)
                                </p>
                                <input
                                    type="text"
                                    value={newPattern}
                                    onChange={(e) => setNewPattern(e.target.value)}
                                    placeholder="например: является студентом"
                                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                                />
                                <input
                                    type="text"
                                    value={newPatternDesc}
                                    onChange={(e) => setNewPatternDesc(e.target.value)}
                                    placeholder="Описание (необязательно)"
                                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            const pattern = newPattern.trim()
                                            if (!pattern) return
                                            let patternValue: string | RegExp = pattern
                                            const regexMatch = pattern.match(/^\/(.+)\/([gimuys]*)$/)
                                            if (regexMatch) {
                                                try {
                                                    patternValue = new RegExp(regexMatch[1], regexMatch[2] || 'gi')
                                                } catch {
                                                    patternValue = regexMatch[1]
                                                }
                                            }
                                            addCustomPattern({
                                                pattern: patternValue,
                                                description: newPatternDesc.trim() || pattern,
                                                category: 'phrase',
                                                enabled: true,
                                            })
                                            setNewPattern('')
                                            setNewPatternDesc('')
                                        }}
                                    >
                                        Добавить паттерн
                                    </Button>
                                </div>
                            </div>
                            {/* Group by category */}
                            {['transition', 'filler', 'phrase', 'structure'].map(category => {
                                const categoryPatterns = patterns.filter(p => p.category === category)
                                if (categoryPatterns.length === 0) return null

                                const categoryLabels: Record<string, string> = {
                                    transition: '🔄 Переходные фразы',
                                    filler: '📝 Слова-заполнители',
                                    phrase: '💬 Типичные фразы',
                                    structure: '🏗 Структура/кальки',
                                }

                                return (
                                    <div key={category} className="mb-3">
                                        <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                            {categoryLabels[category] || category}
                                        </p>
                                        {categoryPatterns.map((pattern) => (
                                            <label
                                                key={pattern.id}
                                                className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                                            >
                                                <span className={cn(
                                                    'text-xs',
                                                    !pattern.enabled && 'text-muted-foreground line-through'
                                                )}>
                                                    {pattern.description}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={pattern.enabled}
                                                        onChange={() => togglePattern(pattern.id)}
                                                        className="h-4 w-4 rounded border-border accent-primary"
                                                    />
                                                    {pattern.id.startsWith('custom-') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePattern(pattern.id)}
                                                            className="text-xs text-destructive hover:underline"
                                                        >
                                                            Удалить
                                                        </button>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <Button variant="outline" size="sm" onClick={resetPatterns}>
                        <RotateCcw className="mr-2 h-3 w-3" />
                        Сбросить паттерны
                    </Button>
                </CardContent>
            </Card>

            {/* LM Studio */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Cpu className="h-5 w-5 text-primary" />
                        LM Studio
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <p className="font-medium">Включить LLM-очистку мусора</p>
                            <p className="text-xs text-muted-foreground">
                                Использует локальный сервер LM Studio (OpenAI-compatible API).
                            </p>
                        </div>
                        <Switch
                            checked={lmStudio.enabled}
                            onChange={(e) => setLmStudio({ enabled: e.target.checked })}
                        />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Base URL</div>
                            <input
                                value={lmStudio.baseUrl}
                                onChange={(e) => setLmStudio({ baseUrl: e.target.value })}
                                placeholder="http://localhost:1234"
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-medium text-muted-foreground">Model</div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        const baseUrl = lmStudio.baseUrl.trim()
                                        if (!baseUrl) return
                                        setLmModelsLoading(true)
                                        try {
                                            const models = await fetchLmStudioModels(baseUrl)
                                            setLmModels(models)
                                        } catch (e) {
                                            alert(e instanceof Error ? e.message : 'Не удалось загрузить модели')
                                        } finally {
                                            setLmModelsLoading(false)
                                        }
                                    }}
                                    className="h-7 px-2 text-[11px]"
                                >
                                    {lmModelsLoading ? '…' : 'Обновить'}
                                </Button>
                            </div>
                            <select
                                value={lmStudio.model || '__auto__'}
                                onChange={(e) => setLmStudio({ model: e.target.value === '__auto__' ? '' : e.target.value })}
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                            >
                                <option value="__auto__">Авто (первая из /v1/models)</option>
                                {lmModels.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-muted-foreground">
                                Если список пустой, нажмите «Обновить» (LM Studio должен быть запущен).
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Temperature</div>
                            <input
                                value={String(lmStudio.temperature)}
                                onChange={(e) => setLmStudio({ temperature: Number(e.target.value) || 0 })}
                                inputMode="decimal"
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Max tokens</div>
                            <input
                                value={String(lmStudio.maxTokens)}
                                onChange={(e) => setLmStudio({ maxTokens: Math.max(256, Number(e.target.value) || 4096) })}
                                inputMode="numeric"
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Parallelism</div>
                        <input
                            value={String(lmStudio.parallelism)}
                            onChange={(e) => setLmStudio({ parallelism: Math.max(1, Math.min(6, Number(e.target.value) || 2)) })}
                            inputMode="numeric"
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Кол-во параллельных запросов (1–6). Больше — быстрее, но может перегрузить модель.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Chunk size (chars)</div>
                        <input
                            value={String(lmStudio.chunkChars)}
                            onChange={(e) => setLmStudio({ chunkChars: Math.max(2000, Math.min(60000, Number(e.target.value) || 12000)) })}
                            inputMode="numeric"
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Для больших текстов запросы делятся на части; меньше — надёжнее, больше — быстрее.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">System prompt</div>
                        <textarea
                            value={lmStudio.systemPrompt}
                            onChange={(e) => setLmStudio({ systemPrompt: e.target.value })}
                            rows={8}
                            className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">История запусков</div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearLmStudioHistory}
                                disabled={!lmStudioHistory.length}
                            >
                                Очистить
                            </Button>
                        </div>
                        {lmStudioHistory.length ? (
                            <div className="mt-2 max-h-64 space-y-2 overflow-auto rounded-lg border border-border bg-background/50 p-2 text-xs">
                                {lmStudioHistory.map((r) => (
                                    <div key={r.id} className="rounded-md border border-border bg-card p-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-medium">
                                                {r.status === 'completed' ? 'Готово' : r.status === 'canceled' ? 'Отменено' : 'Ошибка'}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {new Date(r.startedAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-muted-foreground">
                                            {r.chunks} чанков · chunk {r.chunkChars} · паралл. {r.parallelism} · {r.inputChars} симв.
                                        </div>
                                        <div className="mt-1 text-muted-foreground">
                                            {r.model ? `model: ${r.model}` : 'model: auto'}
                                        </div>
                                        {r.error && (
                                            <div className="mt-1 text-destructive">
                                                {r.error}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-2 text-xs text-muted-foreground">
                                Пока пусто.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
