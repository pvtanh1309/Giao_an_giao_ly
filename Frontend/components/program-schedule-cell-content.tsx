import type { CSSProperties, ReactNode } from 'react'
import type { JSONContent } from '@tiptap/react'
import { parseProgramScheduleCell } from '../lib/program-schedule-content'

type ProgramScheduleCellContentProps = {
    value: string
}

type ScheduleTextStyle = CSSProperties & {
    color?: string
    fontSize?: string
    fontFamily?: string
}

const allowedAlignments = new Set(['left', 'center', 'right', 'justify'])

function renderInline(node: JSONContent, key: string): ReactNode {
    if (node.type === 'hardBreak') return <br key={key} />
    if (!node.text) return null

    let content: ReactNode = node.text
    for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') content = <strong key={`${key}-bold`}>{content}</strong>
        if (mark.type === 'italic') content = <em key={`${key}-italic`}>{content}</em>
        if (mark.type === 'underline') content = <u key={`${key}-underline`}>{content}</u>
        if (mark.type === 'textStyle') {
            const attrs = mark.attrs ?? {}
            const style: ScheduleTextStyle = {}
            if (typeof attrs.color === 'string' && /^#[\da-f]{3,8}$/i.test(attrs.color)) style.color = attrs.color
            if (typeof attrs.fontSize === 'string' && /^\d{1,2}(px|pt|em|rem|%)$/.test(attrs.fontSize)) style.fontSize = attrs.fontSize
            if (typeof attrs.fontFamily === 'string' && /^[\w\s,'"-]+$/.test(attrs.fontFamily)) style.fontFamily = attrs.fontFamily
            if (Object.keys(style).length) content = <span key={`${key}-style`} style={style}>{content}</span>
        }
    }
    return <span key={key}>{content}</span>
}

function renderBlock(node: JSONContent, key: string): ReactNode {
    if (node.type !== 'paragraph' && node.type !== 'heading') {
        return node.content?.map((child, index) => renderBlock(child, `${key}-${index}`)) ?? null
    }

    const alignment = typeof node.attrs?.textAlign === 'string' && allowedAlignments.has(node.attrs.textAlign)
        ? node.attrs.textAlign as CSSProperties['textAlign']
        : undefined
    const style: CSSProperties | undefined = alignment ? { textAlign: alignment } : undefined
    const children = node.content?.map((child, index) => renderInline(child, `${key}-${index}`))

    if (node.type === 'heading') {
        const level = Number(node.attrs?.level)
        if (level === 1) return <h1 key={key} style={style}>{children}</h1>
        if (level === 2) return <h2 key={key} style={style}>{children}</h2>
        return <h3 key={key} style={style}>{children}</h3>
    }
    return <p key={key} style={style}>{children}</p>
}

export function ProgramScheduleCellContent({ value }: ProgramScheduleCellContentProps) {
    const document = parseProgramScheduleCell(value)
    return <div className="program-schedule-cell-content">
        {document.content?.map((node, index) => renderBlock(node, `block-${index}`))}
    </div>
}
