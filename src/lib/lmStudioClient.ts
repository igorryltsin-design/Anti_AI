export type LmStudioSettings = {
    enabled: boolean
    baseUrl: string
    model: string
    temperature: number
    maxTokens: number
    chunkChars: number
    parallelism: number
    systemPrompt: string
}

type LmStudioModelListResponse = {
    data?: Array<{ id: string }>
}

type ChatCompletionResponse = {
    choices?: Array<{
        message?: { content?: string }
    }>
    error?: { message?: string }
}

export type LmStudioProgress = {
    completed: number
    total: number
    phase: 'splitting' | 'running'
    elapsedMs?: number
    lastChunkMs?: number
    avgChunkMs?: number
    etaMs?: number
}

function normalizeBaseUrl(baseUrl: string): string {
    return (baseUrl || '').trim().replace(/\/+$/g, '')
}

export async function fetchLmStudioModels(baseUrl: string, signal?: AbortSignal): Promise<string[]> {
    const url = `${normalizeBaseUrl(baseUrl)}/v1/models`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`LM Studio: ${res.status} ${res.statusText}`)
    const json = (await res.json()) as LmStudioModelListResponse
    const ids = (json.data ?? []).map(m => m.id).filter(Boolean)
    return Array.from(new Set(ids))
}

async function resolveModel(baseUrl: string, preferred: string, signal?: AbortSignal): Promise<string> {
    const model = preferred.trim()
    if (model) return model

    const models = await fetchLmStudioModels(baseUrl, signal)
    const first = models[0]
    if (!first) throw new Error('LM Studio: не найдено ни одной модели (v1/models)')
    return first
}

async function chatCompletion(
    baseUrl: string,
    model: string,
    settings: Pick<LmStudioSettings, 'temperature' | 'maxTokens' | 'systemPrompt'>,
    userText: string,
    signal?: AbortSignal
): Promise<string> {
    const url = `${normalizeBaseUrl(baseUrl)}/v1/chat/completions`

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            model,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
            stream: false,
            messages: [
                { role: 'system', content: settings.systemPrompt },
                { role: 'user', content: userText },
            ],
        }),
        signal,
    })

    const json = (await res.json().catch(() => ({}))) as ChatCompletionResponse
    if (!res.ok) {
        const msg = json.error?.message || `LM Studio: ${res.status} ${res.statusText}`
        throw new Error(msg)
    }

    const content = json.choices?.[0]?.message?.content ?? ''
    return String(content).trim()
}

function splitIntoChunks(inputText: string, maxChars: number): string[] {
    const text = (inputText ?? '').replace(/\r\n?/g, '\n')
    const limit = Math.max(2000, Math.min(60000, Math.floor(maxChars || 12000)))

    const blocks = text.split(/\n{2,}/g)
    const chunks: string[] = []
    let current = ''

    const push = (s: string) => {
        const next = s.trim()
        if (!next) return
        chunks.push(next)
    }

    const flush = () => {
        if (!current.trim()) return
        push(current)
        current = ''
    }

    for (const block of blocks) {
        const b = block.trim()
        if (!b) continue

        if (b.length > limit) {
            flush()
            const lines = b.split('\n')
            let buf = ''
            for (const line of lines) {
                const candidate = buf ? `${buf}\n${line}` : line
                if (candidate.length <= limit) {
                    buf = candidate
                    continue
                }
                if (buf.trim()) push(buf)
                buf = line
                if (buf.length > limit) {
                    // hard split
                    for (let i = 0; i < buf.length; i += limit) {
                        push(buf.slice(i, i + limit))
                    }
                    buf = ''
                }
            }
            if (buf.trim()) push(buf)
            continue
        }

        const candidate = current ? `${current}\n\n${b}` : b
        if (candidate.length <= limit) {
            current = candidate
        } else {
            flush()
            current = b
        }
    }

    flush()
    return chunks.length ? chunks : ['']
}

export function countLmStudioChunks(inputText: string, chunkChars: number): number {
    const text = inputText ?? ''
    if (!text.trim()) return 0
    return splitIntoChunks(text, chunkChars).length
}

export function splitLmStudioChunks(inputText: string, chunkChars: number): string[] {
    return splitIntoChunks(inputText, chunkChars)
}

export async function cleanTextWithLmStudio(
    inputText: string,
    settings: Pick<LmStudioSettings, 'baseUrl' | 'model' | 'temperature' | 'maxTokens' | 'systemPrompt'>,
    opts?: { signal?: AbortSignal }
): Promise<string> {
    const baseUrl = normalizeBaseUrl(settings.baseUrl)
    if (!baseUrl) throw new Error('LM Studio: не задан baseUrl')

    const text = inputText ?? ''
    if (!text.trim()) return ''

    const model = await resolveModel(baseUrl, settings.model, opts?.signal)
    return chatCompletion(baseUrl, model, settings, text, opts?.signal)
}

export type LmStudioChunkRunState = {
    chunks: string[]
    outputs: Array<string | null>
}

export type LmStudioChunkRunResult = {
    outputs: string[]
    model: string
}

export async function cleanTextWithLmStudioChunked(
    inputText: string,
    settings: Pick<LmStudioSettings, 'baseUrl' | 'model' | 'temperature' | 'maxTokens' | 'chunkChars' | 'systemPrompt'>,
    opts?: { signal?: AbortSignal; onProgress?: (progress: LmStudioProgress) => void }
): Promise<string> {
    const baseUrl = normalizeBaseUrl(settings.baseUrl)
    if (!baseUrl) throw new Error('LM Studio: не задан baseUrl')

    const text = inputText ?? ''
    if (!text.trim()) return ''

    opts?.onProgress?.({ completed: 0, total: 0, phase: 'splitting' })
    const chunks = splitIntoChunks(text, settings.chunkChars)
    const total = chunks.length
    const model = await resolveModel(baseUrl, settings.model, opts?.signal)

    const outputs: string[] = []
    const startedAt = Date.now()
    for (let i = 0; i < chunks.length; i++) {
        opts?.onProgress?.({ completed: i, total, phase: 'running', elapsedMs: Date.now() - startedAt })
        const chunk = chunks[i]
        const chunkStartedAt = Date.now()
        const out = await chatCompletion(baseUrl, model, settings, chunk, opts?.signal)
        const lastChunkMs = Date.now() - chunkStartedAt
        outputs.push(out)

        const completed = i + 1
        const elapsedMs = Date.now() - startedAt
        const avgChunkMs = Math.max(1, Math.round(elapsedMs / Math.max(1, completed)))
        const etaMs = Math.max(0, avgChunkMs * Math.max(0, total - completed))
        opts?.onProgress?.({ completed, total, phase: 'running', elapsedMs, lastChunkMs, avgChunkMs, etaMs })
    }
    opts?.onProgress?.({ completed: total, total, phase: 'running', elapsedMs: Date.now() - startedAt, avgChunkMs: 0, etaMs: 0 })

    return outputs
        .map(s => s.trim())
        .filter(Boolean)
        .join('\n\n')
}

export async function runLmStudioChunks(
    state: LmStudioChunkRunState,
    settings: Pick<LmStudioSettings, 'baseUrl' | 'model' | 'temperature' | 'maxTokens' | 'systemPrompt' | 'parallelism'>,
    opts?: { signal?: AbortSignal; onProgress?: (progress: LmStudioProgress) => void }
): Promise<LmStudioChunkRunResult> {
    const baseUrl = normalizeBaseUrl(settings.baseUrl)
    if (!baseUrl) throw new Error('LM Studio: не задан baseUrl')

    const total = state.chunks.length
    if (total === 0) return { outputs: [], model: await resolveModel(baseUrl, settings.model, opts?.signal) }

    const model = await resolveModel(baseUrl, settings.model, opts?.signal)

    const startedAt = Date.now()
    const durations: number[] = []

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
    const concurrency = clamp(Math.floor(settings.parallelism || 1), 1, 6)

    const isDone = (i: number) => state.outputs[i] !== null && state.outputs[i] !== undefined

    const pendingIndices: number[] = []
    for (let i = 0; i < total; i++) {
        if (!isDone(i)) pendingIndices.push(i)
    }

    const completedCount = () => state.outputs.filter(v => v !== null && v !== undefined).length

    const onProgress = (lastChunkMs?: number) => {
        const completed = completedCount()
        const elapsedMs = Date.now() - startedAt
        const avgChunkMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : undefined
        const etaMs =
            avgChunkMs !== undefined
                ? Math.max(0, avgChunkMs * Math.max(0, total - completed))
                : undefined
        opts?.onProgress?.({
            completed,
            total,
            phase: 'running',
            elapsedMs,
            lastChunkMs,
            avgChunkMs,
            etaMs,
        })
    }

    onProgress(undefined)

    let cursor = 0
    const workers: Array<Promise<void>> = []

    const runNext = async (): Promise<void> => {
        while (true) {
            if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
            const idx = pendingIndices[cursor++]
            if (idx === undefined) return
            const chunk = state.chunks[idx] ?? ''
            const chunkStartedAt = Date.now()
            const out = await chatCompletion(baseUrl, model, settings, chunk, opts?.signal)
            const lastChunkMs = Date.now() - chunkStartedAt
            durations.push(lastChunkMs)
            state.outputs[idx] = out
            onProgress(lastChunkMs)
        }
    }

    for (let i = 0; i < Math.min(concurrency, pendingIndices.length); i++) {
        workers.push(runNext())
    }

    await Promise.all(workers)

    const outputs = state.outputs.map(v => String(v ?? '').trim())
    return { outputs, model }
}
