import { useState, useCallback, useMemo } from 'react'
import {
    Upload,
    FileText,
    Trash2,
    CheckCircle2,
    XCircle,
    Loader2,
    FolderArchive,
    Play,
    Cpu,
    RotateCcw,
    X,
} from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Button, Badge, Progress, Card, CardHeader, CardTitle, CardContent, Switch } from '@/components/ui'
import { cn, formatFileSize } from '@/lib/utils'
import { useCleaningStore, type FileItem } from '@/store/useCleaningStore'
import { exportDocx, importDocx } from '@/lib/docxProcessor'
import { cleanText, smartGarbageCleanup } from '@/lib/cleaningEngine'
import { cleanHtmlPreservingTags, extractPlainTextFromHtml, textToHtmlParagraphs } from '@/lib/htmlCleaner'
import { runLmStudioChunks, splitLmStudioChunks, type LmStudioChunkRunState } from '@/lib/lmStudioClient'

export function BatchProcessor() {
    const {
        batchFiles,
        addBatchFiles,
        updateBatchFile,
        removeBatchFile,
        clearBatchFiles,
        options,
        detailedSettings,
        lmStudio,
        addLmStudioHistory,
        patterns,
    } = useCleaningStore()

    const [isDragging, setIsDragging] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [useLlmForBatch, setUseLlmForBatch] = useState(false)
    const [currentAbort, setCurrentAbort] = useState<{ fileId: string; controller: AbortController } | null>(null)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files).filter(
            file => file.name.endsWith('.docx')
        )

        if (files.length > 0) {
            addBatchFiles(files)
        }
    }, [addBatchFiles])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(
            file => file.name.endsWith('.docx')
        )

        if (files.length > 0) {
            addBatchFiles(files)
        }

        // Reset input
        e.target.value = ''
    }, [addBatchFiles])

    const canUseLlm = lmStudio.enabled

    const processOneFile = useCallback(async (fileItem: FileItem, mode: 'auto' | 'llm' | 'standard' = 'auto') => {
        const shouldUseLlm = (mode === 'llm') || (mode === 'auto' && useLlmForBatch)

        updateBatchFile(fileItem.id, { status: 'processing', progress: 0, error: undefined })

        if (shouldUseLlm && canUseLlm) {
            const startedAt = Date.now()
            const taskId = `${startedAt}-${Math.random().toString(36).slice(2)}`
            const controller = new AbortController()
            setCurrentAbort({ fileId: fileItem.id, controller })

            let resume: LmStudioChunkRunState | null = null
            let inputChars = 0
            try {
                const imported = await importDocx(fileItem.file)
                if (!imported.success) throw new Error(imported.error || 'Ошибка импорта')

                const originalText = extractPlainTextFromHtml(imported.html) || imported.text
                inputChars = originalText.length

                const chunks = splitLmStudioChunks(originalText, lmStudio.chunkChars)
                resume =
                    fileItem.llm?.resume?.chunks?.length
                        ? fileItem.llm.resume
                        : { chunks, outputs: Array(chunks.length).fill(null) }

                const { outputs, model } = await runLmStudioChunks(resume, lmStudio, {
                    signal: controller.signal,
                    onProgress: (p) => {
                        const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
                        updateBatchFile(fileItem.id, { progress: pct })
                    },
                })

                const llmText = outputs.join('\n\n').trim()
                const withGarbage = detailedSettings.smartGarbageCleanup ? smartGarbageCleanup(llmText).text : llmText
                const cleaned = cleanText(withGarbage, options, patterns, detailedSettings)
                const cleanedHtml = textToHtmlParagraphs(cleaned.cleanedText)

                updateBatchFile(fileItem.id, {
                    status: 'completed',
                    progress: 100,
                    result: cleaned,
                    cleanedHtml,
                    llm: undefined,
                })

                addLmStudioHistory({
                    id: taskId,
                    startedAt,
                    finishedAt: Date.now(),
                    status: 'completed',
                    baseUrl: lmStudio.baseUrl,
                    model: model || lmStudio.model,
                    inputChars,
                    chunkChars: lmStudio.chunkChars,
                    chunks: resume.chunks.length,
                    parallelism: lmStudio.parallelism,
                })
            } catch (error) {
                const err = error as { name?: string; message?: string }
                const isAbort = err?.name === 'AbortError'
                const message = error instanceof Error ? error.message : 'Ошибка обработки'

                const completed = resume ? resume.outputs.filter(v => v !== null && v !== undefined).length : 0
                const total = resume?.outputs.length ?? 0
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0

                updateBatchFile(fileItem.id, {
                    status: 'error',
                    progress,
                    error: isAbort ? 'Отменено. Можно продолжить.' : message,
                    llm: resume
                        ? { taskId, startedAt, resume }
                        : undefined,
                })

                addLmStudioHistory({
                    id: taskId,
                    startedAt,
                    finishedAt: Date.now(),
                    status: isAbort ? 'canceled' : 'error',
                    baseUrl: lmStudio.baseUrl,
                    model: lmStudio.model,
                    inputChars,
                    chunkChars: lmStudio.chunkChars,
                    chunks: resume?.chunks.length ?? 0,
                    parallelism: lmStudio.parallelism,
                    error: isAbort ? undefined : message,
                })
            } finally {
                setCurrentAbort((cur) => (cur?.fileId === fileItem.id ? null : cur))
            }

            return
        }

        // Standard mode (preserves DOCX structure better)
        try {
            updateBatchFile(fileItem.id, { progress: 25 })
            const imported = await importDocx(fileItem.file)
            if (!imported.success) throw new Error(imported.error || 'Ошибка импорта')

            const originalText = extractPlainTextFromHtml(imported.html) || imported.text
            const cleaned = cleanText(originalText, options, patterns, detailedSettings)
            const cleanedHtml = imported.html
                ? cleanHtmlPreservingTags(imported.html, options, patterns, detailedSettings)
                : textToHtmlParagraphs(cleaned.cleanedText)

            updateBatchFile(fileItem.id, { progress: 75 })
            updateBatchFile(fileItem.id, {
                status: 'completed',
                progress: 100,
                result: cleaned,
                cleanedHtml,
            })
        } catch (error) {
            updateBatchFile(fileItem.id, {
                status: 'error',
                progress: 0,
                error: error instanceof Error ? error.message : 'Ошибка обработки',
            })
        }
    }, [addLmStudioHistory, canUseLlm, detailedSettings, lmStudio, options, patterns, updateBatchFile, useLlmForBatch])

    const processAllFiles = async () => {
        setIsProcessing(true)

        for (const fileItem of batchFiles) {
            if (fileItem.status !== 'pending') continue

            await processOneFile(fileItem, 'auto')
        }

        setIsProcessing(false)
    }

    const resumeAll = async () => {
        setIsProcessing(true)
        for (const fileItem of batchFiles) {
            if (fileItem.status !== 'error' || !fileItem.llm?.resume) continue
            await processOneFile(fileItem, 'llm')
        }
        setIsProcessing(false)
    }

    const downloadAll = async () => {
        const completedFiles = batchFiles.filter(f => f.status === 'completed' && f.result)

        if (completedFiles.length === 0) return

        const zip = new JSZip()

        for (const fileItem of completedFiles) {
            if (!fileItem.result) continue

            const cleanFileName = fileItem.file.name.replace(/\.docx$/i, '_cleaned.docx')
            const blob = await exportDocx(fileItem.cleanedHtml || fileItem.result.cleanedText, cleanFileName)
            zip.file(cleanFileName, blob)
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        saveAs(zipBlob, `cleaned_documents_${Date.now()}.zip`)
    }

    const pendingCount = batchFiles.filter(f => f.status === 'pending').length
    const completedCount = batchFiles.filter(f => f.status === 'completed').length
    const resumableCount = useMemo(
        () => batchFiles.filter(f => f.status === 'error' && Boolean(f.llm?.resume)).length,
        [batchFiles]
    )

    const getStatusBadge = (status: FileItem['status']) => {
        const variants: Record<FileItem['status'], { variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive', text: string }> = {
            pending: { variant: 'secondary', text: 'Ожидание' },
            processing: { variant: 'warning', text: 'Обработка...' },
            completed: { variant: 'success', text: 'Готово' },
            error: { variant: 'destructive', text: 'Ошибка' },
        }

        return variants[status]
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Drop Zone */}
            <Card>
                <CardContent className="p-0">
                    <label
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            'drop-zone flex flex-col items-center justify-center gap-4 rounded-lg p-12 cursor-pointer transition-all',
                            isDragging && 'active'
                        )}
                    >
                        <div className={cn(
                            'rounded-full bg-muted p-4 transition-transform',
                            isDragging && 'scale-110'
                        )}>
                            <Upload className={cn(
                                'h-8 w-8 text-muted-foreground transition-colors',
                                isDragging && 'text-primary'
                            )} />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium">
                                Перетащите файлы .docx сюда
                            </p>
                            <p className="text-sm text-muted-foreground">
                                или нажмите для выбора файлов
                            </p>
                        </div>
                        <input
                            type="file"
                            accept=".docx"
                            multiple
                            onChange={handleFileSelect}
                            className="sr-only"
                        />
                    </label>
                </CardContent>
            </Card>

            {/* File List */}
            {batchFiles.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                                Файлы ({batchFiles.length})
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                {completedCount > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadAll}
                                    >
                                        <FolderArchive className="mr-2 h-4 w-4" />
                                        Скачать все ({completedCount})
                                    </Button>
                                )}
                                {pendingCount > 0 && (
                                    <Button
                                        size="sm"
                                        onClick={processAllFiles}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Play className="mr-2 h-4 w-4" />
                                        )}
                                        Обработать ({pendingCount})
                                    </Button>
                                )}
                                {resumableCount > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={resumeAll}
                                        disabled={isProcessing || !canUseLlm}
                                        title="Продолжить все отменённые/ошибочные LLM-задачи"
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Продолжить ({resumableCount})
                                    </Button>
                                )}
                                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                                    <Cpu className={cn('h-4 w-4', useLlmForBatch && canUseLlm ? 'text-primary' : 'text-muted-foreground')} />
                                    <span className="text-xs font-medium">LM Studio</span>
                                    <Switch
                                        checked={useLlmForBatch}
                                        onChange={(e) => setUseLlmForBatch(e.target.checked)}
                                        disabled={!canUseLlm || isProcessing}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearBatchFiles}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y divide-border rounded-lg border border-border">
                            {batchFiles.map((fileItem) => {
                                const statusInfo = getStatusBadge(fileItem.status)

                                return (
                                    <div
                                        key={fileItem.id}
                                        className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30"
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-medium">
                                                {fileItem.file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatFileSize(fileItem.file.size)}
                                                {fileItem.result && (
                                                    <span className="ml-2">
                                                        • {fileItem.result.stats.totalChanges} изменений
                                                    </span>
                                                )}
                                                {fileItem.error && (
                                                    <span className="ml-2 text-destructive">
                                                        • {fileItem.error}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        {fileItem.status === 'processing' && (
                                            <div className="w-24">
                                                <Progress value={fileItem.progress} showLabel />
                                            </div>
                                        )}

                                        {fileItem.status === 'processing' && currentAbort?.fileId === fileItem.id && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => currentAbort.controller.abort()}
                                                className="h-8"
                                            >
                                                <X className="mr-2 h-4 w-4" />
                                                Отменить
                                            </Button>
                                        )}

                                        {fileItem.status === 'error' && fileItem.llm?.resume && canUseLlm && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => void processOneFile(fileItem, 'llm')}
                                                className="h-8"
                                                title="Продолжить LM Studio с места остановки"
                                            >
                                                <RotateCcw className="mr-2 h-4 w-4" />
                                                Продолжить
                                            </Button>
                                        )}

                                        <Badge variant={statusInfo.variant}>
                                            {fileItem.status === 'completed' && (
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                            )}
                                            {fileItem.status === 'error' && (
                                                <XCircle className="mr-1 h-3 w-3" />
                                            )}
                                            {fileItem.status === 'processing' && (
                                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                            )}
                                            {statusInfo.text}
                                        </Badge>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeBatchFile(fileItem.id)}
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {batchFiles.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Загрузите файлы .docx для пакетной обработки</p>
                </div>
            )}
        </div>
    )
}
