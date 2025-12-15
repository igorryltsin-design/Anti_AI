import { Extension, type CommandProps } from '@tiptap/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { getProseMirrorTextAndMap, offsetsToPmRanges } from '@/lib/proseMirrorTextMap'

export type SuspiciousHighlightRange = {
    start: number
    end: number
    severity?: 'low' | 'medium' | 'high'
}

type PluginState = {
    ranges: SuspiciousHighlightRange[]
    decorations: DecorationSet
}

export const suspiciousDecorationsKey = new PluginKey<PluginState>('suspiciousDecorations')

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        suspiciousDecorations: {
            setSuspiciousRanges: (ranges: SuspiciousHighlightRange[]) => ReturnType
        }
    }
}

function buildDecorations(doc: ProseMirrorNode, ranges: SuspiciousHighlightRange[]): DecorationSet {
    if (!ranges.length) return DecorationSet.empty

    const { segments } = getProseMirrorTextAndMap(doc)
    const decorations: Decoration[] = []

    for (const r of ranges) {
        const start = Math.max(0, r.start)
        const end = Math.max(start, r.end)
        if (end <= start) continue

        const severity = r.severity ?? 'medium'
        const pmRanges = offsetsToPmRanges(segments, start, end)
        for (const pr of pmRanges) {
            decorations.push(
                Decoration.inline(pr.from, pr.to, {
                    class: 'ai-suspicious-range',
                    'data-severity': severity,
                })
            )
        }
    }

    return DecorationSet.create(doc, decorations)
}

export const SuspiciousDecorations = Extension.create({
    name: 'suspiciousDecorations',

    addCommands() {
        return {
            setSuspiciousRanges:
                (ranges: SuspiciousHighlightRange[]) =>
                    ({ tr, dispatch }: CommandProps) => {
                        if (dispatch) {
                            dispatch(tr.setMeta(suspiciousDecorationsKey, { ranges }))
                        }
                        return true
                    },
        }
    },

    addProseMirrorPlugins() {
        return [
            new Plugin<PluginState>({
                key: suspiciousDecorationsKey,
                state: {
                    init: () => ({
                        ranges: [],
                        decorations: DecorationSet.empty,
                    }),
                    apply: (tr, pluginState, _oldState, newState) => {
                        const meta = tr.getMeta(suspiciousDecorationsKey) as { ranges?: SuspiciousHighlightRange[] } | undefined
                        const nextRanges = meta?.ranges ?? pluginState.ranges

                        let decorations = pluginState.decorations
                        if (tr.docChanged) {
                            decorations = decorations.map(tr.mapping, tr.doc)
                        }

                        if (meta?.ranges || tr.docChanged) {
                            decorations = buildDecorations(newState.doc, nextRanges)
                        }

                        return { ranges: nextRanges, decorations }
                    },
                },
                props: {
                    decorations: (state) => suspiciousDecorationsKey.getState(state)?.decorations ?? null,
                },
            }),
        ]
    },
})
