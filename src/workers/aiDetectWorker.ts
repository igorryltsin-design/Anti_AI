import { analyzeText, type CleaningOptions, type CleaningResult } from '@/lib/cleaningEngine'
import { defaultAIPatterns, type AIPattern } from '@/lib/aiPatterns'
import type { DetailedCleaningSettings } from '@/store/useCleaningStore'

type SerializablePattern =
    | { kind: 'string'; value: string }
    | { kind: 'regex'; source: string; flags: string }

type SerializableCustomPattern = {
    id: string
    enabled: boolean
    pattern: SerializablePattern
    description: string
    category: AIPattern['category']
    severity?: AIPattern['severity']
    weight?: AIPattern['weight']
}

type DetectRequest = {
    type: 'detect'
    requestId: number
    text: string
    options: CleaningOptions
    enabledById: Record<string, boolean>
    customPatterns: SerializableCustomPattern[]
    detailedSettings?: DetailedCleaningSettings
}

type DetectResponse =
    | { type: 'result'; requestId: number; result: CleaningResult }
    | { type: 'error'; requestId: number; error: string }

function toRegExp(pattern: SerializablePattern): string | RegExp {
    if (pattern.kind === 'string') return pattern.value
    return new RegExp(pattern.source, pattern.flags)
}

function buildPatterns(enabledById: Record<string, boolean>, customPatterns: SerializableCustomPattern[]): AIPattern[] {
    const base = defaultAIPatterns.map(p => ({
        ...p,
        enabled: Object.prototype.hasOwnProperty.call(enabledById, p.id) ? enabledById[p.id] : p.enabled,
    }))

    const custom = customPatterns.map((p) => ({
        id: p.id,
        enabled: p.enabled,
        pattern: toRegExp(p.pattern),
        description: p.description,
        category: p.category,
        severity: p.severity,
        weight: p.weight,
    }))

    return [...base, ...custom]
}

self.onmessage = (event: MessageEvent<DetectRequest>) => {
    const data = event.data
    if (!data || data.type !== 'detect') return

    try {
        const patterns = buildPatterns(data.enabledById, data.customPatterns)
        const result = analyzeText(data.text, patterns)
        const message: DetectResponse = { type: 'result', requestId: data.requestId, result }
        ;(self as unknown as Worker).postMessage(message)
    } catch (err) {
        const message: DetectResponse = {
            type: 'error',
            requestId: data.requestId,
            error: err instanceof Error ? err.message : String(err),
        }
        ;(self as unknown as Worker).postMessage(message)
    }
}
