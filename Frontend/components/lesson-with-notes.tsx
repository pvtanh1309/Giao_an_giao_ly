'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LessonReadingPage, type LessonReadingPageProps } from './lesson-reading-page'
import { useAuth, useUnauthorizedHandler } from './auth-provider'
import { createContentApi } from '../lib/api/content'
import { createContentManagement } from '../lib/api/content-management'
import { createLessonNotesApi, type LessonNote } from '../lib/api/lesson-notes'
import { getPublicConfig } from '../lib/config'
import { createLessonNoteAnchor, type LessonNoteAnchor } from '../lib/lesson-note-anchors'
import type { Lesson } from '../lib/content-data'
import { beforeAppNavigation, canLeaveCurrentPage } from '../lib/unsaved-work'
import { LessonNotesContext } from './lesson-notes-context'
import { useDialogFocus } from './use-dialog-focus'
import { LoadingIndicator } from './loading-indicator'
import { MessageSquarePlus, NotebookPen } from 'lucide-react'

function selectedTextPosition() {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null
    const rect = Array.from(selection.getRangeAt(0).getClientRects()).find((r) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight)
    if (!rect) return null
    const headerBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0
    const minTop = Math.max(8, headerBottom + 8)
    const above = !window.matchMedia('(pointer: coarse)').matches && rect.top - 48 >= minTop
    return { left: Math.max(8, Math.min(window.innerWidth - 168, rect.left + rect.width / 2 - 76)), top: Math.max(minTop, Math.min(window.innerHeight - 52, above ? rect.top - 48 : rect.bottom + 8)) }
}

export function LessonWithNotes(props: LessonReadingPageProps) {
    const { user } = useAuth()
    const [published, setPublished] = useState(false)
    return <div key={`${user?.sub}:${props.lesson.id}`}>
        {props.canManage && <div className="personal-notes-mode"><button className="secondary-button" disabled={!props.lesson.hasPublished} onClick={() => { if (canLeaveCurrentPage()) setPublished(!published) }}>{published ? 'Quay lại quản lý giáo án' : 'Xem bản đã xuất bản và ghi chú riêng'}</button></div>}
        {(!props.canManage || published) ? <PersonalLessonSession key={`${user?.sub}:${props.lesson.id}`} {...props} /> : <LessonReadingPage {...props} />}
    </div>
}

function PersonalLessonSession(props: LessonReadingPageProps) {
    const { user, getAccessToken } = useAuth()
    const unauthorized = useUnauthorizedHandler()
    const api = useMemo(() => createContentApi({config: getPublicConfig(), getAccessToken, onUnauthorized: unauthorized}), [getAccessToken, unauthorized])
    const service = useMemo(() => createLessonNotesApi(api), [api])
    const [lesson, setLesson] = useState<Lesson | null>(props.canManage ? null : props.lesson)
    const [notes, setNotes] = useState<LessonNote[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [anchor, setAnchor] = useState<LessonNoteAnchor | null>(null)
    const [selectionError, setSelectionError] = useState('')
    const [selectionPosition, setSelectionPosition] = useState<{ left: number; top: number } | null>(null)
    const [listOpen, setListOpen] = useState(false)
    const [draft, setDraft] = useState<{ noteId: string; anchor: LessonNoteAnchor; body: string; version?: number } | null>(null)
    const [resolved, setResolved] = useState<Record<string, string[]>>({})
    const [reloadId, setReloadId] = useState(0)
    const sequence = useRef(0)
    const alive = useRef(true)
    useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current++ } }, [])
    useEffect(() => {
        let current = true
        setLoading(true); setError('')
        Promise.all([service.list(props.lesson.id), props.canManage ? createContentManagement(api, false).lessons.get(props.lesson.id) : Promise.resolve(props.lesson)])
            .then(([rows, published]) => { if (current) { setNotes(rows); setLesson(published); setResolved({}) } })
            .catch((error) => { if (current) setError(error instanceof Error ? error.message : 'Không tải được ghi chú.') })
            .finally(() => { if (current) setLoading(false) })
        return () => { current = false }
    }, [api, service, props.lesson, props.canManage, reloadId])
    const report = useCallback((fieldId: string, ids: string[]) => setResolved((old) => JSON.stringify(old[fieldId]) === JSON.stringify(ids) ? old : {...old, [fieldId]: ids}), [])
    const select = useCallback((fieldId: string, text: string, start: number, end: number) => {
        const id = ++sequence.current
        setAnchor(null); setSelectionError('')
        setSelectionPosition(selectedTextPosition())
        void createLessonNoteAnchor(fieldId, text, start, end).then((next) => { if (alive.current && sequence.current === id) setAnchor(next) }).catch((error) => { if (alive.current && sequence.current === id) setSelectionError(error.message) })
    }, [])
    const rejectSelection = useCallback(() => {
        sequence.current++; setAnchor(null); setSelectionPosition(null); setSelectionError('Chỉ chọn chữ trong cùng một mục để thêm ghi chú.')
    }, [])
    useEffect(() => {
        const validate = () => {
            const selected = window.getSelection()
            if (!selected || selected.isCollapsed) {
                if (!document.activeElement?.closest('[data-note-selection-menu]')) { sequence.current++; setAnchor(null); setSelectionPosition(null) }
                return
            }
            const field = (node: Node | null) => (node instanceof Element ? node : node?.parentElement)?.closest('[data-note-field]')
            const first = field(selected.anchorNode), last = field(selected.focusNode)
            if ((first || last) && first !== last) rejectSelection()
            else if (first && last) setSelectionPosition(selectedTextPosition())
            else { sequence.current++; setAnchor(null); setSelectionPosition(null) }
        }
        const dismiss = (event: PointerEvent) => {
            if (!(event.target instanceof Element) || !event.target.closest('[data-note-field], [data-note-selection-menu]')) { sequence.current++; setAnchor(null); setSelectionPosition(null) }
        }
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { sequence.current++; setAnchor(null); setSelectionPosition(null) } }
        document.addEventListener('selectionchange', validate)
        document.addEventListener('pointerdown', dismiss)
        document.addEventListener('keydown', escape)
        window.addEventListener('scroll', validate, true)
        window.addEventListener('resize', validate)
        return () => { document.removeEventListener('selectionchange', validate); document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); window.removeEventListener('scroll', validate, true); window.removeEventListener('resize', validate) }
    }, [rejectSelection])
    const open = useCallback((id: string) => {
        const note = notes.find((n) => n.noteId === id)
        if (note) { setListOpen(false); setDraft({ noteId: note.noteId, anchor: note.anchor, body: note.body, version: note.version }) }
    }, [notes])
    if (!user) return null
    return <LessonNotesContext.Provider value={{ notes, anchor, select, rejectSelection, open, report }}>
        {selectionError && <span className="note-selection-feedback" role="status">{selectionError}</span>}
        {selectionPosition && anchor && !draft && !listOpen && createPortal(<div className="personal-note-selection-menu" data-note-selection-menu role="toolbar" aria-label="Ghi chú đoạn được chọn" style={selectionPosition}>
            <button type="button" disabled={loading || !!error} onPointerDown={(event) => event.preventDefault()} onClick={() => { setDraft({ noteId: crypto.randomUUID(), anchor, body: '' }); setSelectionPosition(null) }}><MessageSquarePlus size={16} /> Viết ghi chú</button>
            {error && <p role="alert">{error}</p>}
        </div>, document.body)}
        {lesson && <LessonReadingPage {...props} lesson={lesson} canManage={false} extraActions={(notes.length > 0 || !!error) && <button type="button" className="secondary-button personal-notes-list-trigger" onClick={() => setListOpen(true)}><NotebookPen size={16} /> Ghi chú của tôi{notes.length > 0 ? ` (${notes.length})` : ''}</button>} onBack={() => { if (canLeaveCurrentPage()) props.onBack() }} />}
        {listOpen && createPortal(<NotesListDialog notes={notes} resolvedIds={Object.values(resolved).flat()} error={error} loading={loading} onOpen={open} onClose={() => setListOpen(false)} onReload={() => { setAnchor(null); setSelectionPosition(null); setReloadId((n) => n + 1) }} />, document.body)}
        {draft && createPortal(<NoteDialog key={draft.noteId} draft={draft} onClose={() => setDraft(null)} onSave={async (body) => {
            const saved = draft.version ? await service.update(props.lesson.id, draft.noteId, body, draft.version) : await service.create(props.lesson.id, { noteId: draft.noteId, anchor: draft.anchor, body })
            if (!alive.current) return
            setNotes((rows) => [...rows.filter((n) => n.noteId !== saved.noteId), saved]); setDraft(null)
        }} onDelete={draft.version ? async () => {
            await service.remove(props.lesson.id, draft.noteId, draft.version!)
            if (alive.current) { setNotes((rows) => rows.filter((n) => n.noteId !== draft.noteId)); setDraft(null) }
        } : undefined} />, document.body)}
    </LessonNotesContext.Provider>
}

function NotesListDialog({ notes, resolvedIds, error, loading, onOpen, onClose, onReload }: { notes: LessonNote[]; resolvedIds: string[]; error: string; loading: boolean; onOpen: (id: string) => void; onClose: () => void; onReload: () => void }) {
    const root = useRef<HTMLElement>(null)
    useDialogFocus(root)
    return <div className="personal-profile-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}><section ref={root} className="personal-profile-dialog personal-notes-list" role="dialog" aria-modal="true" aria-labelledby="notes-list-title">
        <h2 id="notes-list-title">Ghi chú của tôi ({notes.length})</h2>
        {loading && <LoadingIndicator compact message="Đang tải ghi chú…" />}{error && <p role="alert">{error}</p>}
        <ul>{notes.map((note) => <li key={note.noteId}><button type="button" onClick={() => onOpen(note.noteId)}><q>{note.anchor.exactQuote}</q><span>{note.body}</span>{!resolvedIds.includes(note.noteId) && <small>Đoạn gốc đã thay đổi hoặc chưa xác định được vị trí.</small>}</button></li>)}</ul>
        <div className="personal-profile-actions"><button type="button" className="secondary-button" disabled={loading} onClick={onReload}>Tải lại</button><button type="button" className="primary-button" onClick={onClose}>Đóng</button></div>
    </section></div>
}

function NoteDialog({ draft, onClose, onSave, onDelete }: { draft: { body: string; anchor: LessonNoteAnchor; version?: number }; onClose: () => void; onSave: (body: string) => Promise<void>; onDelete?: () => Promise<void> }) {
    const [body, setBody] = useState(draft.body)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const pending = useRef(false)
    const root = useRef<HTMLElement>(null)
    useDialogFocus(root)
    const dirty = body !== draft.body
    const close = () => { if (!pending.current && (!dirty || window.confirm('Bỏ ghi chú chưa lưu?'))) onClose() }
    useEffect(() => {
        const guard = (event: Event) => { if (pending.current || (dirty && !window.confirm('Bỏ ghi chú chưa lưu?'))) event.preventDefault() }
        const unload = (event: BeforeUnloadEvent) => { if (dirty || pending.current) { event.preventDefault(); event.returnValue = '' } }
        window.addEventListener(beforeAppNavigation, guard); window.addEventListener('beforeunload', unload)
        return () => { window.removeEventListener(beforeAppNavigation, guard); window.removeEventListener('beforeunload', unload) }
    }, [dirty])
    const perform = async (action: () => Promise<void>) => {
        if (pending.current) return
        pending.current = true; setBusy(true); setError('')
        try { await action() } catch (error) { setError(error instanceof Error ? error.message : 'Không lưu được ghi chú. Hãy thử lại.') }
        finally { pending.current = false; setBusy(false) }
    }
    return <div className="personal-profile-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close() }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}><section ref={root} className="personal-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="note-dialog-title"><h2 id="note-dialog-title">Ghi chú riêng</h2><blockquote>{draft.anchor.exactQuote}</blockquote><form onSubmit={(e) => { e.preventDefault(); void perform(() => onSave(body)) }}><label>Nội dung ghi chú<textarea required maxLength={8000} rows={8} value={body} disabled={busy} onChange={(e) => setBody(e.target.value)} /></label>{error && <p role="alert">{error} Nội dung đang nhập vẫn được giữ. Nếu xung đột, hãy sao chép nội dung rồi đóng và tải lại.</p>}<div className="personal-profile-actions"><button type="button" disabled={busy} onClick={close}>Đóng</button>{onDelete && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Xóa ghi chú riêng này?')) void perform(onDelete) }}>Xóa</button>}<button className="primary-button" disabled={busy || !body.trim()}>{busy ? 'Đang lưu…' : 'Lưu ghi chú'}</button></div></form></section></div>
}
