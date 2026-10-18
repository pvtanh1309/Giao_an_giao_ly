import type { Node } from '@tiptap/pm/model'
export function selectionIsWithinField(root: Pick<HTMLElement, 'contains'>, selection: Pick<Selection, 'anchorNode' | 'focusNode'> | null): boolean {
    return !!selection && !!selection.anchorNode && !!selection.focusNode && root.contains(selection.anchorNode) && root.contains(selection.focusNode)
}
export type LessonTextMap = { text: string; units: { from: number; to: number }[] }
export function lessonTextMap(doc: Node): LessonTextMap {
    const result: LessonTextMap = { text: '', units: [] }
    const append = (text: string, from: number, to: number) => { result.text += text; result.units.push({ from, to }) }
    function visit(node: Node, pos: number, root = false) {
        if (node.isText) {
            let offset = pos
            for (const point of (node.text ?? '').match(/\r\n|[\s\S]/gu) ?? []) {
                append(point.replace(/\r\n?/g, '\n'), offset, offset + point.length); offset += point.length
            }
        } else if (node.type.name === 'hardBreak') append('\n', pos, pos + 1)
        else if (node.type.name === 'image') append('\ufffc', pos, pos + node.nodeSize)
        else {
            const inline = ['paragraph', 'heading', 'codeBlock'].includes(node.type.name)
            node.forEach((child, offset, index) => {
                const start = pos + offset + (root ? 0 : 1)
                if (index && !inline) append('\n', start - 1, start)
                visit(child, start)
            })
        }
    }
    visit(doc, 0, true)
    return result
}
export function selectedNoteRange(map: LessonTextMap, from: number, to: number) {
    const start = map.units.findIndex((unit) => unit.from >= from && unit.to <= to)
    if (start < 0 || from === to) return null
    let end = start
    while (end < map.units.length && map.units[end].to <= to) end++
    return { start, end }
}
