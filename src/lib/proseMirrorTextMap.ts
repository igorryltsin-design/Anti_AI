import type { Node as ProseMirrorNode } from 'prosemirror-model'

export type TextMapSegment = {
    textFrom: number
    textTo: number
    pmFrom: number
    pmTo: number
}

type BuildState = {
    parts: string[]
    segments: TextMapSegment[]
    offset: number
}

function pushVirtual(state: BuildState, s: string) {
    if (!s) return
    state.parts.push(s)
    state.offset += s.length
}

function pushText(state: BuildState, text: string, pmFrom: number) {
    if (!text) return
    const textFrom = state.offset
    const textTo = textFrom + text.length
    state.parts.push(text)
    state.segments.push({
        textFrom,
        textTo,
        pmFrom,
        pmTo: pmFrom + text.length,
    })
    state.offset = textTo
}

function serializeInline(node: ProseMirrorNode, pos: number, state: BuildState) {
    if (node.isText) {
        pushText(state, node.text ?? '', pos)
        return
    }

    if (node.isLeaf) return

    node.forEach((child, offset) => {
        serializeInline(child, pos + offset + 1, state)
    })
}

function collectTextblocks(node: ProseMirrorNode, pos: number, out: Array<{ node: ProseMirrorNode; pos: number }>) {
    if (node.isTextblock) {
        out.push({ node, pos })
        return
    }

    if (!node.isBlock || node.isLeaf) return

    node.forEach((child, offset) => {
        collectTextblocks(child, pos + offset + 1, out)
    })
}

function serializeTableCell(cellNode: ProseMirrorNode, cellPos: number, state: BuildState) {
    const blocks: Array<{ node: ProseMirrorNode; pos: number }> = []
    collectTextblocks(cellNode, cellPos, blocks)

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        serializeInline(block.node, block.pos, state)
        if (i !== blocks.length - 1) pushVirtual(state, ' ')
    }
}

function serializeBlock(node: ProseMirrorNode, pos: number, state: BuildState) {
    const typeName = node.type.name

    if (typeName === 'table') {
        node.forEach((rowNode, rowOffset) => {
            if (rowNode.type.name !== 'tableRow') return
            const rowPos = pos + rowOffset + 1

            let firstCell = true
            rowNode.forEach((cellNode, cellOffset) => {
                const cellType = cellNode.type.name
                if (cellType !== 'tableCell' && cellType !== 'tableHeader') return

                if (!firstCell) pushVirtual(state, '\t')
                firstCell = false

                const cellPos = rowPos + cellOffset + 1
                serializeTableCell(cellNode, cellPos, state)
            })

            pushVirtual(state, '\n')
        })
        return
    }

    if (node.isTextblock) {
        serializeInline(node, pos, state)
        pushVirtual(state, '\n')
        return
    }

    if (node.isBlock) {
        node.forEach((child, offset) => {
            serializeBlock(child, pos + offset + 1, state)
        })
        return
    }
}

export function getProseMirrorTextAndMap(doc: ProseMirrorNode): { text: string; segments: TextMapSegment[] } {
    const state: BuildState = { parts: [], segments: [], offset: 0 }
    serializeBlock(doc, 0, state)
    return { text: state.parts.join(''), segments: state.segments }
}

export function offsetsToPmRanges(
    segments: TextMapSegment[],
    start: number,
    end: number
): Array<{ from: number; to: number }> {
    const ranges: Array<{ from: number; to: number }> = []
    if (end <= start) return ranges

    for (const seg of segments) {
        if (seg.textTo <= start) continue
        if (seg.textFrom >= end) break

        const overlapFrom = Math.max(start, seg.textFrom)
        const overlapTo = Math.min(end, seg.textTo)
        if (overlapTo <= overlapFrom) continue

        const from = seg.pmFrom + (overlapFrom - seg.textFrom)
        const to = seg.pmFrom + (overlapTo - seg.textFrom)
        if (to > from) ranges.push({ from, to })
    }

    return ranges
}
