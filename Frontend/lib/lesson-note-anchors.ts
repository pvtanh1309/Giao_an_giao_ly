import type { JSONContent } from '@tiptap/react'

export type LessonNoteAnchor = { fieldId: string; start: number; end: number; exactQuote: string; prefix: string; suffix: string; sourceHash: string }
export function canonicalLessonFieldText(value: string | JSONContent): string {
    if (typeof value === 'string') return value.replace(/\r\n?/g, '\n')
    if (value.type === 'text') return canonicalLessonFieldText(value.text ?? '')
    if (value.type === 'hardBreak') return '\n'
    if (value.type === 'image') return '\ufffc'
    return (value.content ?? []).map(canonicalLessonFieldText).join(['paragraph', 'heading', 'codeBlock'].includes(value.type ?? '') ? '' : '\n')
}
const digest = async (text: string): Promise<string> => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (byte) => byte.toString(16).padStart(2, '0')).join('')
export async function createLessonNoteAnchor(fieldId: string, text: string, start: number, end: number): Promise<LessonNoteAnchor> {
    const points = Array.from(text)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > points.length || start >= end || end - start > 2000 || !points.slice(start, end).join('').trim()) throw new Error('Chọn một đoạn chữ trong cùng một mục, tối đa 2000 ký tự.')
    return { fieldId, start, end, exactQuote: points.slice(start, end).join(''), prefix: points.slice(Math.max(0, start - 120), start).join(''), suffix: points.slice(end, end + 120).join(''), sourceHash: await digest(text) }
}
export async function resolveLessonNoteAnchor(text: string, anchor: LessonNoteAnchor): Promise<{start: number; end: number} | null> {
    const points = Array.from(text)
    if (await digest(text) === anchor.sourceHash && points.slice(anchor.start, anchor.end).join('') === anchor.exactQuote) return { start: anchor.start, end: anchor.end }
    const matches: {start: number; end: number}[] = []
    let offset = 0
    while (offset <= text.length) {
        const position = text.indexOf(anchor.exactQuote, offset)
        if (position < 0) break
        const end = position + anchor.exactQuote.length
        if (text.slice(0, position).endsWith(anchor.prefix) && text.slice(end).startsWith(anchor.suffix)) matches.push({ start: Array.from(text.slice(0, position)).length, end: Array.from(text.slice(0, end)).length })
        if (matches.length > 1) return null
        offset = position + 1
    }
    return matches[0] ?? null
}
