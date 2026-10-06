import type { JSONContent } from '@tiptap/react'

export function parseProgramScheduleCell(value: string): JSONContent {
    try {
        const parsed = JSON.parse(value) as JSONContent
        if (parsed.type === 'doc' && Array.isArray(parsed.content)) return parsed
    } catch {
        // Existing schedules contain plain text; preserve their line breaks.
    }

    return {
        type: 'doc',
        content: value.split(/\r?\n/).map((line) => line
            ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
            : { type: 'paragraph' }),
    }
}

export function getProgramScheduleCellText(value: string): string {
    return parseProgramScheduleCell(value).content?.map((block) => {
        const collectText = (node: JSONContent): string => node.text ?? (node.content?.map(collectText).join('') ?? '')
        return collectText(block)
    }).join('\n') ?? ''
}
