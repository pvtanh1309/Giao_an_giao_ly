import { lessonPlans, defaultProgramScheduleColumns } from '../content-data.ts'
import type { ContentState, Lesson, Program, LessonSection } from '../content-data'
import type { ReferenceDocument } from '../reference-content'
import { parseProgramScheduleCell } from '../program-schedule-content.ts'
import { stripRuntimeImageUrls } from '../lesson-media.ts'
import type { JSONContent } from '@tiptap/react'
import type { ApiClient } from './client'

type Kind = 'lessons' | 'programs' | 'references'
type Dto = ContentState & {
    lessonId?: string; programId?: string; referenceId?: string
    title: string; summary?: string; description?: string; level?: string; sublevel?: string
    lessonNumber?: number; durationMinutes?: number; scriptureText?: string; scriptureReference?: string
    keyPoints?: JSONContent; sentiment?: JSONContent; preparation?: JSONContent
    progression?: { teacherActivity: JSONContent; learnerActivity: JSONContent }[]
    sections?: { key: string; title: string; content: JSONContent }[]
    scheduleColumns?: Program['scheduleColumns']
    schedule?: { id: string; values: Record<string, JSONContent>; mergedCellGroups?: string[][] }[]
    category?: ReferenceDocument['category']; content?: JSONContent
}

const emptyDocument = (): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph' }] })
const document = (value = '') => stripRuntimeImageUrls(parseProgramScheduleCell(value))
const serialized = (value?: JSONContent) => JSON.stringify(value ?? emptyDocument())
const sublevel = (level: string, value?: string) => value || lessonPlans.find((item) => item.level === level)?.sublevels[0] || level

// Write responses contain durable media IDs; retain local preview URLs until the
// next GET hydrates them with signed S3 URLs. URLs never enter a write payload.
function withImagePreviews(dto: Dto, previous: unknown): Dto {
    const urls = new Map<string, string>()
    const visit = (value: unknown, callback: (image: Record<string, unknown>) => void) => {
        if (typeof value === 'string') {
            if (!value.startsWith('{')) return
            try { visit(JSON.parse(value), callback) } catch { /* Plain text is not a document. */ }
        } else if (Array.isArray(value)) value.forEach((child) => visit(child, callback))
        else if (value && typeof value === 'object') {
            const node = value as Record<string, unknown>
            if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') callback(node.attrs as Record<string, unknown>)
            Object.values(node).forEach((child) => visit(child, callback))
        }
    }
    visit(previous, (attrs) => {
        if (typeof attrs.mediaId === 'string' && typeof attrs.src === 'string') urls.set(attrs.mediaId, attrs.src)
    })
    const result = structuredClone(dto)
    visit(result, (attrs) => { if (typeof attrs.mediaId === 'string' && urls.has(attrs.mediaId)) attrs.src = urls.get(attrs.mediaId) })
    return result
}

function positiveNumber(value: string, field: string) {
    const match = value.match(/\d+/)
    const number = Number(match?.[0])
    if (!Number.isInteger(number) || number < 1 || number > 10000) throw new Error(`${field} phải từ 1 đến 10000.`)
    return number
}

function state(dto: Dto, kind: Kind) {
    const id = dto[kind === 'lessons' ? 'lessonId' : kind === 'programs' ? 'programId' : 'referenceId']
    if (!id || !Number.isInteger(dto.version) || Number(dto.version) < 1) throw new Error('Máy chủ trả về ID hoặc phiên bản nội dung không hợp lệ.')
    return { id, version: dto.version, status: dto.status ?? 'ACTIVE' as const,
        hasDraft: dto.hasDraft ?? false, hasPublished: dto.hasPublished ?? false }
}

function lessonView(dto: Dto): Lesson {
    return { ...state(dto, 'lessons'), title: dto.title, excerpt: dto.summary ?? '',
        tag: `BÀI ${String(dto.lessonNumber ?? 1).padStart(2, '0')}`, time: `${dto.durationMinutes ?? 45} phút`,
        level: dto.level, sublevel: dto.sublevel, scripture: dto.scriptureText, scriptureReference: dto.scriptureReference,
        keyPoints: serialized(dto.keyPoints), sentiment: serialized(dto.sentiment), preparation: serialized(dto.preparation),
        progression: (dto.progression ?? []).map((step) => ({ teacherActivity: serialized(step.teacherActivity), learnerActivity: serialized(step.learnerActivity) })),
        sections: (dto.sections ?? []).filter((section) => section.key !== '_legacy').map((section) => ({
            key: section.key as LessonSection['key'], title: section.title, contentHtml: serialized(section.content),
        })), content: dto.sections?.some((section) => section.key === '_legacy')
            ? serialized(dto.sections.find((section) => section.key === '_legacy')?.content) : '',
    }
}

function lessonPayload(item: Lesson) {
    const level = item.level || lessonPlans[0].level
    return { title: item.title.trim(), summary: item.excerpt ?? '', level, sublevel: sublevel(level, item.sublevel),
        lessonNumber: positiveNumber(item.tag, 'Số bài'), durationMinutes: positiveNumber(item.time, 'Thời lượng'),
        scriptureText: item.scripture ?? '', scriptureReference: item.scriptureReference ?? '',
        keyPoints: document(item.keyPoints), sentiment: document(item.sentiment), preparation: document(item.preparation),
        progression: (item.progression ?? []).map((step) => ({ teacherActivity: document(step.teacherActivity), learnerActivity: document(step.learnerActivity) })),
        sections: [...(item.sections ?? []).map((section) => ({ key: section.key, title: section.title, content: document(section.contentHtml) })),
            ...(item.content?.trim() ? [{ key: '_legacy', title: 'Nội dung hiện có', content: document(item.content) }] : [])],
    }
}

function programView(dto: Dto): Program {
    const rows = dto.schedule ?? []
    return { ...state(dto, 'programs'), title: dto.title, desc: dto.description ?? '', level: dto.level ?? '',
        sublevel: dto.sublevel === dto.level ? undefined : dto.sublevel, progress: 0,
        lessons: dto.schedule ? `${rows.length} buổi học` : 'Xem lịch học',
        color: lessonPlans.find((plan) => plan.level === dto.level)?.color ?? lessonPlans[0].color,
        scheduleColumns: dto.scheduleColumns, schedule: rows.map((row) => ({ ...row,
            values: Object.fromEntries(Object.entries(row.values).map(([id, content]) => [id, serialized(content)])),
        })),
    }
}

function programPayload(item: Program) {
    const columns = item.scheduleColumns ?? defaultProgramScheduleColumns
    return { title: item.title.trim(), description: item.desc ?? '', level: item.level, sublevel: sublevel(item.level, item.sublevel),
        scheduleColumns: columns,
        schedule: (item.schedule ?? []).map((row) => ({ id: row.id, mergedCellGroups: row.mergedCellGroups ?? [],
            values: Object.fromEntries(columns.map(({ id }) => [id, document(row.values[id] ?? '')])),
        })),
    }
}

function referenceView(dto: Dto): ReferenceDocument {
    const meta = state(dto, 'references')
    const revision = { content: serialized(dto.content), version: meta.version! }
    return { ...meta, title: dto.title, category: dto.category!,
        ...(dto.hasDraft ? { draft: revision } : {}), ...(dto.hasPublished ? { published: revision } : {}),
    }
}

export function createContentManagement(api: ApiClient, canManage: boolean) {
    function resource<T extends ContentState & { id: string; title: string }>(
        kind: Kind, view: (dto: Dto) => T, payload: (item: T) => object,
    ) {
        const base = `${canManage ? '/manage' : ''}/${kind}`
        const requireSaved = (item: T) => {
            if (!item.version) throw new Error('Hãy lưu bản nháp trên máy chủ trước khi thực hiện thao tác này.')
        }
        const requireManager = () => {
            if (!canManage) throw new Error('Bạn không có quyền quản lý nội dung.')
        }
        return {
            async list(): Promise<T[]> {
                const items: T[] = [], seen = new Set<string>()
                let cursor: string | undefined
                do {
                    const query = new URLSearchParams({ limit: '50' })
                    if (canManage && kind === 'references') query.set('includeDeleted', 'true')
                    if (cursor) query.set('cursor', cursor)
                    const page = await api.requestPage<Dto>(`${base}?${query}`)
                    items.push(...page.items.map((dto) => view(canManage ? dto : { ...dto, hasPublished: true })))
                    cursor = page.nextCursor
                    if (cursor && seen.has(cursor)) throw new Error('Máy chủ trả về phân trang không hợp lệ.')
                    if (cursor) seen.add(cursor)
                } while (cursor)
                return items
            },
            async get(id: string): Promise<T> {
                const dto = await api.request<Dto>(`${base}/${encodeURIComponent(id)}`)
                return view(canManage ? dto : { ...dto, hasPublished: true })
            },
            async save(item: T): Promise<T> {
                requireManager()
                if (!item.title.trim()) throw new Error('Vui lòng nhập tiêu đề trước khi lưu.')
                const dto = await api.request<Dto>(`${base}${item.version ? `/${encodeURIComponent(item.id)}/draft` : ''}`, {
                    method: item.version ? 'PUT' : 'POST', body: { ...payload(item), ...(item.version ? { version: item.version } : {}) },
                })
                return view({ ...(kind === 'lessons' ? withImagePreviews(dto, item) : dto), hasDraft: true,
                    hasPublished: item.hasPublished ?? (kind === 'references' && Boolean((item as unknown as ReferenceDocument).published)) })
            },
            async publish(item: T): Promise<T> {
                requireManager(); requireSaved(item)
                const dto = await api.request<Dto>(`${base}/${encodeURIComponent(item.id)}/publish`, { method: 'POST', body: { version: item.version } })
                return view({ ...(kind === 'lessons' ? withImagePreviews(dto, item) : dto), hasDraft: false, hasPublished: true })
            },
            async archive(item: T): Promise<T> {
                requireManager(); requireSaved(item)
                const dto = await api.request<Dto>(`${base}/${encodeURIComponent(item.id)}`, { method: 'DELETE', body: {} })
                return { ...item, version: dto.version, status: dto.status }
            },
            async restore(item: T): Promise<T> {
                requireManager(); requireSaved(item)
                const dto = await api.request<Dto>(`${base}/${encodeURIComponent(item.id)}/restore`, { method: 'POST', body: {} })
                return { ...item, version: dto.version, status: dto.status }
            },
        }
    }
    return { lessons: resource('lessons', lessonView, lessonPayload), programs: resource('programs', programView, programPayload),
        references: resource('references', referenceView, (item) => ({ title: item.title.trim(), category: item.category,
            content: document(item.draft?.content ?? item.published?.content) })),
    }
}
