import { useState, useCallback, useRef, useEffect } from 'react'
import {
    Upload,
    Download,
    Wand2,
    Copy,
    Check,
    FileText,
    AlertTriangle,
    Eye,
    Cpu,
    X,
} from 'lucide-react'
import { Button, Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Progress } from '@/components/ui'
import { RichTextEditor } from '@/components/Editor/RichTextEditor'
import { RichDocumentEditor } from '@/components/Editor/RichDocumentEditor'
import { DiffView } from '@/components/Editor/DiffView'
import { useCleaningStore } from '@/store/useCleaningStore'
import { cleanText, smartGarbageCleanup, type CleaningResult, type SuspiciousRange } from '@/lib/cleaningEngine'
import { importDocx, exportAndDownload } from '@/lib/docxProcessor'
import { cleanHtmlPreservingTags, extractPlainTextFromHtml, textToHtmlParagraphs } from '@/lib/htmlCleaner'
import { countLmStudioChunks, runLmStudioChunks, splitLmStudioChunks, type LmStudioChunkRunState, type LmStudioProgress } from '@/lib/lmStudioClient'
import type { Editor } from '@tiptap/react'
import { TextSelection } from 'prosemirror-state'

type AIDetectWorkerMessage =
    | { type: 'result'; requestId: number; result: CleaningResult }
    | { type: 'error'; requestId: number; error: string }

export function EditorPage() {
    const {
        originalContent,
        originalHtml,
        cleanedContent,
        cleanedHtml,
        setOriginalContent,
        setOriginalHtml,
        setCleanedContent,
        setCleanedHtml,
        cleanedStale,
        setCleanedStale,
        setCurrentResult,
        options,
        detailedSettings,
        lmStudio,
        addLmStudioHistory,
        patterns,
        viewMode,
        setViewMode,
        setPrevSuspicious,
        setNextSuspicious,
        ignoredSuspiciousKeys,
        ignoredSuspiciousPatterns,
        editorResetToken,
        jumpRequest,
    } = useCleaningStore()

    const [isLoading, setIsLoading] = useState(false)
    const [isLlmLoading, setIsLlmLoading] = useState(false)
    const [llmProgress, setLlmProgress] = useState<LmStudioProgress | null>(null)
    const [llmError, setLlmError] = useState<string | null>(null)
    const [llmQueue, setLlmQueue] = useState<Array<{ id: string; createdAt: number; text: string }>>([])
    const [copied, setCopied] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)
    const [editorFormat, setEditorFormat] = useState<'text' | 'doc'>('text')
    const [activePane, setActivePane] = useState<'original' | 'cleaned'>('original')
    const [suspiciousIndex, setSuspiciousIndex] = useState(0)
    const [originalHighlights, setOriginalHighlights] = useState<SuspiciousRange[]>([])
    const [cleanedHighlights, setCleanedHighlights] = useState<SuspiciousRange[]>([])
    const originalContainerRef = useRef<HTMLDivElement>(null)
    const cleanedContainerRef = useRef<HTMLDivElement>(null)
    const originalEditorRef = useRef<Editor | null>(null)
    const cleanedEditorRef = useRef<Editor | null>(null)
    const rawResultRef = useRef<CleaningResult | null>(null)
    const lastCleanResultRef = useRef<CleaningResult | null>(null)
    const workerRef = useRef<Worker | null>(null)
    const requestIdRef = useRef(0)
    const latestRequestRef = useRef(0)
    const ignoredKeysRef = useRef<string[]>([])
    const ignoredPatternsRef = useRef<string[]>([])
    const llmAbortRef = useRef<AbortController | null>(null)
    const llmResumeRef = useRef<{ taskId: string; state: LmStudioChunkRunState; startedAt: number; model?: string } | null>(null)

    useEffect(() => {
        ignoredKeysRef.current = ignoredSuspiciousKeys
    }, [ignoredSuspiciousKeys])

    useEffect(() => {
        ignoredPatternsRef.current = ignoredSuspiciousPatterns
    }, [ignoredSuspiciousPatterns])

    useEffect(() => {
        if (!originalHtml) return
        if (originalHtml.includes('<table')) {
            setEditorFormat('doc')
        }
    }, [originalHtml])

    const makeSuspiciousKey = useCallback((range: Pick<SuspiciousRange, 'patternId' | 'pattern' | 'start' | 'end'>) => {
        const pid = range.patternId || range.pattern
        return `${pid}:${range.start}:${range.end}`
    }, [])

    const applyIgnoreToResult = useCallback((result: CleaningResult, ignoredKeys: string[], ignoredPatterns: string[]) => {
        const ignoredSet = new Set(ignoredKeys)
        const ignoredPatternSet = new Set(ignoredPatterns)
        const toPatternKey = (r: Pick<SuspiciousRange, 'patternId' | 'pattern'>) =>
            r.patternId ? `id:${r.patternId}` : `p:${r.pattern}`

        const filtered = result.suspiciousRanges.filter(r => {
            if (ignoredSet.has(makeSuspiciousKey(r))) return false
            if (ignoredPatternSet.has(toPatternKey(r))) return false
            return true
        })
        const histogram = filtered.reduce((acc, r) => {
            acc[r.severity] += 1
            return acc
        }, { low: 0, medium: 0, high: 0 } as CleaningResult['severityHistogram'])

        const weighted = filtered.reduce((acc, r) => acc + (r.score ?? 0), 0)
        const normalizedLength = Math.max(1, result.cleanedText.length / 1200)
        const density = weighted / normalizedLength
        const suspicionScore = Math.min(1, density / 5)

        return {
            ...result,
            suspiciousRanges: filtered,
            severityHistogram: histogram,
            suspicionScore,
            stats: {
                ...result.stats,
                aiPatternsFound: filtered.length,
                aiSeverity: histogram,
                aiSuspicionScore: suspicionScore,
            }
        }
    }, [makeSuspiciousKey])

    useEffect(() => {
        const worker = new Worker(new URL('../workers/aiDetectWorker.ts', import.meta.url), { type: 'module' })
        workerRef.current = worker

        worker.onmessage = (event: MessageEvent<AIDetectWorkerMessage>) => {
            const msg = event.data
            if (!msg) return
            if (msg.requestId !== latestRequestRef.current) return
            if (msg.type !== 'result') return

            const result = msg.result
            rawResultRef.current = result
            const filtered = applyIgnoreToResult(result, ignoredKeysRef.current, ignoredPatternsRef.current)
            setOriginalHighlights(filtered.suspiciousRanges)
            setCurrentResult({ ...filtered, originalText: result.originalText })
        }

        return () => {
            worker.terminate()
            workerRef.current = null
        }
    }, [applyIgnoreToResult, setCurrentResult])

    // Real-time pattern detection with debounce (via Web Worker)
    useEffect(() => {
        if (!originalContent.trim() || !options.aiPatterns) {
            setOriginalHighlights([])
            setCurrentResult(null)
            rawResultRef.current = null
            return
        }

        const worker = workerRef.current
        if (!worker) return

        const timeoutId = setTimeout(() => {
            const requestId = ++requestIdRef.current
            latestRequestRef.current = requestId

            const enabledById = Object.fromEntries(patterns.map(p => [p.id, p.enabled]))
            const customPatterns = patterns
                .filter(p => p.id.startsWith('custom-'))
                .map(p => ({
                    id: p.id,
                    enabled: p.enabled,
                    pattern: p.pattern instanceof RegExp
                        ? { kind: 'regex' as const, source: p.pattern.source, flags: p.pattern.flags }
                        : { kind: 'string' as const, value: p.pattern },
                    description: p.description,
                    category: p.category,
                    severity: p.severity,
                    weight: p.weight,
                }))

            worker.postMessage({
                type: 'detect',
                requestId,
                text: originalContent,
                options: { basic: false, structure: false, aiPatterns: true, humanizer: false },
                enabledById,
                customPatterns,
                detailedSettings,
            })
        }, 400)

        return () => clearTimeout(timeoutId)
    }, [originalContent, options.aiPatterns, patterns, detailedSettings, setCurrentResult, applyIgnoreToResult])

    const handleClean = useCallback(() => {
        if (!originalContent.trim()) return

        // Invalidate any in-flight worker results so they don't overwrite a manual clean.
        latestRequestRef.current = ++requestIdRef.current

        const result = cleanText(originalContent, options, patterns, detailedSettings)
        setCleanedContent(result.cleanedText)
        if (editorFormat === 'doc') {
            const base = originalHtml || textToHtmlParagraphs(originalContent)
            setCleanedHtml(cleanHtmlPreservingTags(base, options, patterns, detailedSettings))
        } else {
            setCleanedHtml('')
        }
        setCleanedStale(false)
        rawResultRef.current = result
        lastCleanResultRef.current = result
        const filtered = applyIgnoreToResult(result, ignoredSuspiciousKeys, ignoredSuspiciousPatterns)
        setCleanedHighlights(filtered.suspiciousRanges)
        setCurrentResult({ ...filtered, originalText: originalContent })
        setActivePane('cleaned')
    }, [applyIgnoreToResult, detailedSettings, editorFormat, ignoredSuspiciousKeys, ignoredSuspiciousPatterns, options, originalContent, originalHtml, patterns, setActivePane, setCleanedContent, setCleanedHtml, setCleanedStale, setCurrentResult])

    const runLlmCleanup = useCallback(async (inputText: string) => {
        if (!lmStudio.enabled) return
        if (!inputText.trim()) return
        if (isLlmLoading) return

        const chunks = countLmStudioChunks(inputText, lmStudio.chunkChars)
        const WARN_CHUNKS = 10
        const HARD_WARN_CHUNKS = 25
        if (chunks > WARN_CHUNKS) {
            const ok = window.confirm(
                `Текст будет обработан в ${chunks} частей (чанков). Это может занять время.\n\nПродолжить?`
            )
            if (!ok) return
        }
        if (chunks > HARD_WARN_CHUNKS) {
            const ok = window.confirm(
                `Очень большой текст: ${chunks} чанков.\n\nРекомендуется уменьшить Chunk size или обработать документ частями. Продолжить всё равно?`
            )
            if (!ok) return
        }

        setLlmError(null)
        setIsLlmLoading(true)
        setLlmProgress({ completed: 0, total: 0, phase: 'splitting' })
        const controller = new AbortController()
        llmAbortRef.current = controller
        const startedAt = Date.now()
        try {
            const taskId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
            const chunkList = splitLmStudioChunks(inputText, lmStudio.chunkChars)
            const state: LmStudioChunkRunState = { chunks: chunkList, outputs: Array(chunkList.length).fill(null) }
            llmResumeRef.current = { taskId, state, startedAt }

            const { outputs, model } = await runLmStudioChunks(state, lmStudio, {
                signal: controller.signal,
                onProgress: (p) => setLlmProgress(p),
            })
            llmResumeRef.current = null

            const joined = outputs.join('\n\n').trim()
            const normalized = detailedSettings.smartGarbageCleanup ? smartGarbageCleanup(joined).text : joined

            setCleanedContent(normalized)
            setCleanedHtml(textToHtmlParagraphs(normalized))
            setCleanedStale(false)
            setCleanedHighlights([])
            setCurrentResult(null)
            lastCleanResultRef.current = null
            setActivePane('cleaned')

            addLmStudioHistory({
                id: taskId,
                startedAt,
                finishedAt: Date.now(),
                status: 'completed',
                baseUrl: lmStudio.baseUrl,
                model: model || lmStudio.model,
                inputChars: inputText.length,
                chunkChars: lmStudio.chunkChars,
                chunks: chunkList.length,
                parallelism: lmStudio.parallelism,
            })
        } catch (e) {
            const err = e as { name?: string; message?: string }
            if (err?.name === 'AbortError') {
                setLlmError('Отменено. Можно продолжить с места остановки.')
                const resume = llmResumeRef.current
                if (resume) {
                    addLmStudioHistory({
                        id: resume.taskId,
                        startedAt: resume.startedAt,
                        finishedAt: Date.now(),
                        status: 'canceled',
                        baseUrl: lmStudio.baseUrl,
                        model: lmStudio.model,
                        inputChars: inputText.length,
                        chunkChars: lmStudio.chunkChars,
                        chunks: resume.state.chunks.length,
                        parallelism: lmStudio.parallelism,
                    })
                }
                return
            }
            const msg = e instanceof Error ? e.message : 'Ошибка LM Studio'
            setLlmError(msg)
            const resume = llmResumeRef.current
            if (resume) {
                addLmStudioHistory({
                    id: resume.taskId,
                    startedAt: resume.startedAt,
                    finishedAt: Date.now(),
                    status: 'error',
                    baseUrl: lmStudio.baseUrl,
                    model: lmStudio.model,
                    inputChars: inputText.length,
                    chunkChars: lmStudio.chunkChars,
                    chunks: resume.state.chunks.length,
                    parallelism: lmStudio.parallelism,
                    error: msg,
                })
            }
        } finally {
            setIsLlmLoading(false)
            setLlmProgress(null)
            llmAbortRef.current = null
        }
    }, [addLmStudioHistory, detailedSettings.smartGarbageCleanup, isLlmLoading, lmStudio, setActivePane, setCleanedContent, setCleanedHtml, setCleanedStale, setCurrentResult])

    const handleLlmCleanup = useCallback(async () => {
        if (!lmStudio.enabled) return
        if (!originalContent.trim()) return
        if (isLlmLoading) {
            setLlmQueue((q) => [...q, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: Date.now(), text: originalContent }])
            return
        }
        await runLlmCleanup(originalContent)
    }, [isLlmLoading, lmStudio.enabled, originalContent, runLlmCleanup])

    const handleLlmResume = useCallback(async () => {
        const resume = llmResumeRef.current
        if (!resume) return
        if (isLlmLoading) return
        if (!lmStudio.enabled) return

        setLlmError(null)
        setIsLlmLoading(true)
        const controller = new AbortController()
        llmAbortRef.current = controller
        try {
            const { outputs, model } = await runLmStudioChunks(resume.state, lmStudio, {
                signal: controller.signal,
                onProgress: (p) => setLlmProgress(p),
            })
            llmResumeRef.current = null

            const joined = outputs.join('\n\n').trim()
            const normalized = detailedSettings.smartGarbageCleanup ? smartGarbageCleanup(joined).text : joined

            setCleanedContent(normalized)
            setCleanedHtml(textToHtmlParagraphs(normalized))
            setCleanedStale(false)
            setCleanedHighlights([])
            setCurrentResult(null)
            lastCleanResultRef.current = null
            setActivePane('cleaned')

            addLmStudioHistory({
                id: resume.taskId,
                startedAt: resume.startedAt,
                finishedAt: Date.now(),
                status: 'completed',
                baseUrl: lmStudio.baseUrl,
                model: model || lmStudio.model,
                inputChars: originalContent.length,
                chunkChars: lmStudio.chunkChars,
                chunks: resume.state.chunks.length,
                parallelism: lmStudio.parallelism,
            })
        } catch (e) {
            const err = e as { name?: string; message?: string }
            if (err?.name === 'AbortError') {
                setLlmError('Отменено. Можно продолжить с места остановки.')
                return
            }
            const msg = e instanceof Error ? e.message : 'Ошибка LM Studio'
            setLlmError(msg)
        } finally {
            setIsLlmLoading(false)
            setLlmProgress(null)
            llmAbortRef.current = null
        }
    }, [addLmStudioHistory, detailedSettings.smartGarbageCleanup, isLlmLoading, lmStudio, originalContent, setActivePane, setCleanedContent, setCleanedHtml, setCleanedStale, setCurrentResult])

    useEffect(() => {
        if (isLlmLoading) return
        if (!llmQueue.length) return
        const next = llmQueue[0]
        setLlmQueue((q) => q.slice(1))
        if (!next.text.trim()) return
        setOriginalContent(next.text)
        setOriginalHtml(textToHtmlParagraphs(next.text))
        void runLlmCleanup(next.text)
    }, [isLlmLoading, llmQueue, runLlmCleanup, setOriginalContent, setOriginalHtml])

    const handleOriginalChange = useCallback((next: string) => {
        // Если пользователь меняет оригинал после очистки — очищенный результат устаревает.
        if (cleanedContent && !cleanedStale) {
            setCleanedStale(true)
            setCurrentResult(null)
        }
        setOriginalContent(next)
    }, [cleanedContent, cleanedStale, setCleanedStale, setCurrentResult, setOriginalContent])

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsLoading(true)

        try {
            const result = await importDocx(file)

            if (result.success) {
                setOriginalContent(extractPlainTextFromHtml(result.html) || result.text)
                setOriginalHtml(result.html)
                setEditorFormat('doc')
                setActivePane('original')
                setFileName(file.name)
                setCleanedContent('')
                setCleanedHtml('')
                setCleanedStale(false)
                setCurrentResult(null)
                setCleanedHighlights([])
                lastCleanResultRef.current = null
            } else {
                alert(`Ошибка импорта: ${result.error}`)
            }
        } catch {
            alert('Ошибка при чтении файла')
        } finally {
            setIsLoading(false)
            e.target.value = ''
        }
    }

    const jumpToSuspicious = useCallback((delta: number) => {
        const shouldUseCleaned = activePane === 'cleaned' && Boolean(cleanedContent && !cleanedStale)
        const editor = shouldUseCleaned ? cleanedEditorRef.current : originalEditorRef.current
        const root = (editor?.view.dom as HTMLElement | undefined)
            ?? (shouldUseCleaned ? cleanedContainerRef.current : originalContainerRef.current)
            ?? (shouldUseCleaned ? originalContainerRef.current : cleanedContainerRef.current)
        if (!root) return

        const highlightEls = Array.from(root.querySelectorAll('mark,[data-color],.ai-suspicious-range')) as HTMLElement[]
        const elements = highlightEls
        if (elements.length === 0) return

        const next = (suspiciousIndex + delta + elements.length) % elements.length
        setSuspiciousIndex(next)
        const target = elements[next] as HTMLElement

        if (editor) {
            try {
                const from = editor.view.posAtDOM(target, 0)
                const to = editor.view.posAtDOM(target, target.childNodes.length)
                editor.view.dispatch(
                    editor.state.tr
                        .setSelection(TextSelection.create(editor.state.doc, from, to))
                        .scrollIntoView()
                )
                editor.view.focus()
            } catch {
                // Fallback to DOM scrolling below
            }
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        target.style.transition = 'all 0.3s ease'
        target.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'scale-105')
        setTimeout(() => {
            target.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'scale-105')
        }, 1500)
    }, [activePane, suspiciousIndex, cleanedContent, cleanedStale])

    const jumpToNextSuspicious = useCallback(() => jumpToSuspicious(1), [jumpToSuspicious])
    const jumpToPrevSuspicious = useCallback(() => jumpToSuspicious(-1), [jumpToSuspicious])

    useEffect(() => {
        setSuspiciousIndex(0)
    }, [originalHighlights])

    useEffect(() => {
        setPrevSuspicious(() => jumpToPrevSuspicious)
        setNextSuspicious(() => jumpToNextSuspicious)
        return () => {
            setPrevSuspicious(undefined)
            setNextSuspicious(undefined)
        }
    }, [jumpToNextSuspicious, jumpToPrevSuspicious, setNextSuspicious, setPrevSuspicious])

    useEffect(() => {
        if (!jumpRequest) return

        if (viewMode !== 'editor') {
            setViewMode('editor')
            return
        }

        const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
        const preferCleaned = Boolean(cleanedContent && !cleanedStale)
        setActivePane(preferCleaned ? 'cleaned' : 'original')

        const attempt = (remaining: number) => {
            const candidates: { editor: Editor | null; root: HTMLElement | null }[] = preferCleaned
                ? [
                    {
                        editor: cleanedEditorRef.current,
                        root: (cleanedEditorRef.current?.view.dom as HTMLElement | undefined) ?? cleanedContainerRef.current,
                    },
                    {
                        editor: originalEditorRef.current,
                        root: (originalEditorRef.current?.view.dom as HTMLElement | undefined) ?? originalContainerRef.current,
                    },
                ]
                : [
                {
                    editor: originalEditorRef.current,
                    root: (originalEditorRef.current?.view.dom as HTMLElement | undefined) ?? originalContainerRef.current,
                },
                {
                    editor: cleanedEditorRef.current,
                    root: (cleanedEditorRef.current?.view.dom as HTMLElement | undefined) ?? cleanedContainerRef.current,
                },
                ]

            for (const candidate of candidates) {
                if (!candidate.root) continue
                const markElements = Array.from(candidate.root.querySelectorAll('mark,[data-color],.ai-suspicious-range')) as HTMLElement[]
                if (!markElements.length) continue

                const idx = clamp(jumpRequest.markIndex, 0, markElements.length - 1)
                const el = markElements[idx]
                setSuspiciousIndex(idx)

                try {
                    candidate.editor?.commands.focus()
                } catch {
                    // ignore
                }

                try {
                    const view = candidate.editor?.view
                    if (view) {
                        const from = view.posAtDOM(el, 0)
                        const to = view.posAtDOM(el, el.childNodes.length)
                        view.dispatch(
                            view.state.tr
                                .setSelection(TextSelection.create(view.state.doc, from, to))
                                .scrollIntoView()
                        )
                        view.focus()
                    }
                } catch {
                    // ignore
                }

                try {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
                } catch {
                    // ignore
                }

                el.style.transition = 'all 0.3s ease'
                el.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'scale-105')
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'scale-105')
                }, 1500)
                return
            }

            if (remaining > 0) {
                requestAnimationFrame(() => attempt(remaining - 1))
            }
        }

        attempt(90)
    }, [cleanedContent, cleanedStale, jumpRequest, setActivePane, setViewMode, viewMode])

    useEffect(() => {
        rawResultRef.current = null
        setOriginalHighlights([])
    }, [editorResetToken])

    useEffect(() => {
        const raw = rawResultRef.current
        if (!raw) return
        const filtered = applyIgnoreToResult(raw, ignoredSuspiciousKeys, ignoredSuspiciousPatterns)
        setCurrentResult({ ...filtered, originalText: raw.originalText })
        if (!cleanedContent) {
            setOriginalHighlights(filtered.suspiciousRanges)
        }
        const lastClean = lastCleanResultRef.current
        if (lastClean) {
            const filteredClean = applyIgnoreToResult(lastClean, ignoredSuspiciousKeys, ignoredSuspiciousPatterns)
            setCleanedHighlights(filteredClean.suspiciousRanges)
        }
    }, [applyIgnoreToResult, cleanedContent, ignoredSuspiciousKeys, ignoredSuspiciousPatterns, setCurrentResult])

    useEffect(() => {
        if (cleanedContent) return
        if (activePane === 'cleaned') setActivePane('original')
        setCleanedHighlights([])
        lastCleanResultRef.current = null
        setCleanedStale(false)
        setCleanedHtml('')
    }, [activePane, cleanedContent, setActivePane, setCleanedHtml, setCleanedStale])

    const handleExport = useCallback(async () => {
        if (!cleanedContent || cleanedStale) return

        const exportFileName = fileName || 'document.docx'
        const content = editorFormat === 'doc' ? (cleanedHtml || cleanedContent) : cleanedContent
        await exportAndDownload(content, exportFileName)
    }, [cleanedContent, cleanedHtml, cleanedStale, editorFormat, fileName])

    const handleCopy = useCallback(async () => {
        if (!cleanedContent || cleanedStale) return

        await navigator.clipboard.writeText(cleanedContent)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [cleanedContent, cleanedStale])

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText()
            setOriginalContent(text)
            setOriginalHtml(textToHtmlParagraphs(text))
            setActivePane('original')
            setCleanedContent('')
            setCleanedHtml('')
            setCleanedStale(false)
            setCurrentResult(null)
            setFileName(null)
            setCleanedHighlights([])
            lastCleanResultRef.current = null
        } catch {
            // Clipboard access denied
        }
    }, [setActivePane, setCleanedContent, setCleanedHtml, setCleanedStale, setCurrentResult, setOriginalContent, setOriginalHtml])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return

            const key = e.key
            const isMod = e.metaKey || e.ctrlKey

            if (key === 'F3') {
                e.preventDefault()
                if (e.shiftKey) jumpToPrevSuspicious()
                else jumpToNextSuspicious()
                return
            }

            if (!isMod) return

            if (key === 'Enter') {
                e.preventDefault()
                handleClean()
                return
            }

            const lower = key.toLowerCase()
            if (!e.shiftKey && lower === 's') {
                if (!cleanedContent || cleanedStale) return
                e.preventDefault()
                void handleExport()
                return
            }

            if (e.shiftKey && lower === 'l') {
                if (!cleanedContent || cleanedStale) return
                e.preventDefault()
                void handleCopy()
                return
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [cleanedContent, cleanedStale, handleClean, handleCopy, handleExport, jumpToNextSuspicious, jumpToPrevSuspicious])

    const handleCleanedChange = useCallback((next: string) => {
        setCleanedContent(next)
        setCleanedHighlights([])
        lastCleanResultRef.current = null
    }, [setCleanedContent])

    const handleOriginalHtmlChange = useCallback((nextHtml: string) => {
        setOriginalHtml(nextHtml)
    }, [setOriginalHtml])

    const handleCleanedHtmlChange = useCallback((nextHtml: string) => {
        setCleanedHtml(nextHtml)
        setCleanedHighlights([])
        lastCleanResultRef.current = null
    }, [setCleanedHtml])

    const handleOriginalDocTextChange = useCallback((next: string) => {
        if (cleanedContent && !cleanedStale) {
            setCleanedStale(true)
            setCurrentResult(null)
        }
        setOriginalContent(next)
    }, [cleanedContent, cleanedStale, setCleanedStale, setCurrentResult, setOriginalContent])

    const handleCleanedDocTextChange = useCallback((next: string) => {
        setCleanedContent(next)
        setCleanedHighlights([])
        lastCleanResultRef.current = null
    }, [setCleanedContent])

    return (
        <div className="space-y-4">
                {/* Toolbar */}
                <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 border border-border bg-transparent hover:bg-muted h-8 px-3 text-xs cursor-pointer">
                                <Upload className="h-4 w-4" />
                                Импорт .docx
                                <input
                                    type="file"
                                    accept=".docx"
                                    onChange={handleFileImport}
                                    className="sr-only"
                                    disabled={isLoading}
                                />
                            </label>

                            <Button variant="outline" size="sm" onClick={handlePaste}>
                                <FileText className="mr-2 h-4 w-4" />
                                Вставить из буфера
                            </Button>

                            {fileName && (
                                <Badge variant="secondary" className="gap-1">
                                    <FileText className="h-3 w-3" />
                                    {fileName}
                                </Badge>
                            )}

                            <div className="ml-1 flex items-center rounded-lg border border-border bg-card p-1">
                                <button
                                    type="button"
                                    onClick={() => setEditorFormat('text')}
                                    className={`rounded-md px-2 py-1 text-xs ${editorFormat === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Режим текста (без таблиц)"
                                >
                                    Текст
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!originalHtml) setOriginalHtml(textToHtmlParagraphs(originalContent))
                                        if (cleanedContent && !cleanedHtml) setCleanedHtml(textToHtmlParagraphs(cleanedContent))
                                        setEditorFormat('doc')
                                    }}
                                    className={`rounded-md px-2 py-1 text-xs ${editorFormat === 'doc' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="Документ (таблицы сохраняются)"
                                >
                                    Документ
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleClean}
                                disabled={!originalContent.trim() || isLoading}
                                className="min-w-[140px]"
                                title="⌘/Ctrl+Enter"
                            >
                                <Wand2 className="mr-2 h-4 w-4" />
                                Очистить
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleLlmCleanup()}
                                disabled={!lmStudio.enabled || !originalContent.trim() || isLlmLoading}
                                title={lmStudio.enabled ? 'Очистить мусор через LM Studio' : 'Включите LM Studio в настройках'}
                            >
                                <Cpu className="mr-2 h-4 w-4" />
                                {isLlmLoading ? 'LLM…' : 'LLM очистка'}
                            </Button>
                            {isLlmLoading && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => llmAbortRef.current?.abort()}
                                    title="Отменить LLM"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                            {!isLlmLoading && llmResumeRef.current && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleLlmResume()}
                                    title="Продолжить LLM с места остановки"
                                >
                                    Продолжить
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {(llmError || llmQueue.length > 0) && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                                {llmError && (
                                    <div className="text-destructive">
                                        {llmError}
                                    </div>
                                )}
                                {llmQueue.length > 0 && (
                                    <div className="text-muted-foreground">
                                        Очередь LLM: {llmQueue.length}
                                    </div>
                                )}
                            </div>
                            {llmQueue.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setLlmQueue([])}
                                >
                                    Очистить очередь
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {isLlmLoading && llmProgress && llmProgress.phase === 'running' && llmProgress.total > 0 && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                        {(() => {
                            const fmt = (ms?: number) => {
                                if (!ms || ms < 0) return '—'
                                return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`
                            }
                            const fmtEta = (ms?: number) => {
                                if (ms === undefined || ms === null) return '—'
                                const totalSec = Math.max(0, Math.round(ms / 1000))
                                const m = Math.floor(totalSec / 60)
                                const s = totalSec % 60
                                return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
                            }
                            const pct =
                                llmProgress.total > 0
                                    ? Math.round((llmProgress.completed / llmProgress.total) * 100)
                                    : 0
                            return (
                                <>
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                        <span>LM Studio: {llmProgress.completed}/{llmProgress.total} ({pct}%)</span>
                                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                                            <span>посл.: {fmt(llmProgress.lastChunkMs)}/чанк</span>
                                            <span>ср.: {fmt(llmProgress.avgChunkMs)}/чанк</span>
                                            <span>ETA: {fmtEta(llmProgress.etaMs)}</span>
                                        </span>
                                    </div>
                                    <Progress value={llmProgress.completed} max={llmProgress.total} />
                                </>
                            )
                        })()}
                    </div>
                )}

                {/* Editor / Diff View */}
                <Tabs defaultValue="editor" value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                    <div className="flex items-center justify-between">
                        <TabsList>
                            <TabsTrigger value="editor">
                                <FileText className="mr-2 h-4 w-4" />
                                Редактор
                            </TabsTrigger>
                            <TabsTrigger value="diff" disabled={!cleanedContent}>
                                <Eye className="mr-2 h-4 w-4" />
                                Сравнение
                            </TabsTrigger>
                        </TabsList>

                        {cleanedContent && (
                            <div className="flex items-center gap-2">
                                {cleanedStale && (
                                    <Badge variant="warning">
                                        Устарело
                                    </Badge>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopy}
                                    disabled={cleanedStale}
                                    title="⌘/Ctrl+Shift+L"
                                >
                                    {copied ? (
                                        <Check className="mr-2 h-4 w-4 text-success" />
                                    ) : (
                                        <Copy className="mr-2 h-4 w-4" />
                                    )}
                                    {copied ? 'Скопировано!' : 'Копировать'}
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExport}
                                    disabled={cleanedStale}
                                    title="⌘/Ctrl+S"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Экспорт .docx
                                </Button>
                            </div>
                        )}
                    </div>

                    <TabsContent value="editor">
                        <div>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center rounded-lg border border-border bg-card p-1">
                                    <button
                                        type="button"
                                        onClick={() => setActivePane('original')}
                                        className={`rounded-md px-2 py-1 text-xs ${activePane === 'original' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Оригинал
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActivePane('cleaned')}
                                        disabled={!cleanedContent}
                                        className={`rounded-md px-2 py-1 text-xs ${activePane === 'cleaned' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'} ${!cleanedContent ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        Очищенный
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {activePane === 'cleaned' && cleanedContent && cleanedHighlights.length > 0 && (
                                        <Badge variant="warning">
                                            <AlertTriangle className="mr-1 h-3 w-3" />
                                            {cleanedHighlights.length} подозрительных мест
                                        </Badge>
                                    )}
                                    {activePane === 'cleaned' && cleanedContent && cleanedStale && (
                                        <Badge variant="warning">Устарело</Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                        {activePane === 'cleaned' ? cleanedContent.length : originalContent.length} симв.
                                    </span>
                                </div>
                            </div>

                            {activePane === 'cleaned' ? (
                                cleanedContent ? (
                                    <div className="space-y-2">
                                        {cleanedStale && (
                                            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                                                <div className="font-medium">Очищенный текст устарел</div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    Вы изменили оригинал после очистки. Нажмите «Очистить», чтобы пересобрать очищенную версию.
                                                </div>
                                                <div className="mt-2">
                                                    <Button size="sm" onClick={handleClean}>
                                                        <Wand2 className="mr-2 h-4 w-4" />
                                                        Очистить заново
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {editorFormat === 'doc' ? (
                                            <RichDocumentEditor
                                                html={cleanedHtml || textToHtmlParagraphs(cleanedContent)}
                                                onHtmlChange={handleCleanedHtmlChange}
                                                onTextChange={handleCleanedDocTextChange}
                                                highlightRanges={cleanedHighlights}
                                                contentRef={cleanedContainerRef}
                                                onEditorReady={(ed) => { cleanedEditorRef.current = ed }}
                                            />
                                        ) : (
                                            <RichTextEditor
                                                content={cleanedContent}
                                                onChange={handleCleanedChange}
                                                highlightRanges={cleanedHighlights}
                                                contentRef={cleanedContainerRef}
                                                onEditorReady={(ed) => { cleanedEditorRef.current = ed }}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground min-h-[400px] flex items-center justify-center text-center">
                                        Нажмите «Очистить», чтобы получить очищенный текст.
                                    </div>
                                )
                            ) : (
                                editorFormat === 'doc' ? (
                                    <RichDocumentEditor
                                        html={originalHtml || textToHtmlParagraphs(originalContent)}
                                        onHtmlChange={handleOriginalHtmlChange}
                                        onTextChange={handleOriginalDocTextChange}
                                        highlightRanges={originalHighlights}
                                        contentRef={originalContainerRef}
                                        onEditorReady={(ed) => { originalEditorRef.current = ed }}
                                    />
                                ) : (
                                    <RichTextEditor
                                        content={originalContent}
                                        onChange={handleOriginalChange}
                                        highlightRanges={originalHighlights}
                                        contentRef={originalContainerRef}
                                        onEditorReady={(ed) => { originalEditorRef.current = ed }}
                                    />
                                )
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="diff">
                        {editorFormat === 'doc' ? (
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-lg border border-border bg-card">
                                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                                        <span className="text-sm font-medium">Оригинал (документ)</span>
                                        <span className="text-xs text-muted-foreground">
                                            {originalContent.length} симв.
                                        </span>
                                    </div>
                                    <div className="max-h-[600px] overflow-auto">
                                        <div
                                            className="tiptap doc-html-preview"
                                            dangerouslySetInnerHTML={{ __html: originalHtml || textToHtmlParagraphs(originalContent) }}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-lg border border-primary/30 bg-card">
                                    <div className="flex items-center justify-between border-b border-primary/30 bg-primary/5 px-4 py-2">
                                        <span className="text-sm font-medium">Очищенный (документ)</span>
                                        <span className="text-xs text-muted-foreground">
                                            {cleanedContent.length} симв.
                                        </span>
                                    </div>
                                    <div className="max-h-[600px] overflow-auto">
                                        <div
                                            className="tiptap doc-html-preview"
                                            dangerouslySetInnerHTML={{ __html: cleanedHtml || textToHtmlParagraphs(cleanedContent) }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <DiffView original={originalContent} modified={cleanedContent} />
                        )}
                    </TabsContent>
                </Tabs>
        </div>
    )
}
