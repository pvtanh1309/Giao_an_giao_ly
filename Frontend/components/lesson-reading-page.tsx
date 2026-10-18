'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Save, Trash2, X } from 'lucide-react'
import type { Lesson, LessonSection } from '../lib/content-data'
import { lessonPlans } from '../lib/content-data'
import { getLessonSections } from '../lib/lesson-content'
import { LessonRichTextEditor } from './lesson-rich-text-editor'
import { LessonPreparationField } from './lesson-preparation-field'

export type LessonReadingPageProps = {
    lesson: Lesson
    canManage: boolean
    onSave: (lesson: Lesson) => Promise<boolean>
    onPublish: (lesson: Lesson) => Promise<boolean>
    onDelete: (lesson: Lesson) => Promise<boolean>
    busy?: boolean
    onBack: () => void
    getAccessToken?: () => Promise<string>
    onUploadStateChange?: (uploading: boolean) => void
    extraActions?: ReactNode
}

export function LessonReadingPage({ lesson, canManage, onSave, onPublish, onDelete, onBack, getAccessToken, onUploadStateChange, extraActions, busy = false }: LessonReadingPageProps) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(lesson)

    useEffect(() => {
        setDraft(lesson)
        setEditing(false)
    }, [lesson])

    const sections = getLessonSections(editing ? draft : lesson)
    const update = (changes: Partial<Lesson>) => setDraft((current) => ({ ...current, ...changes }))
    const updateSection = (section: LessonSection, contentHtml: string) => update({
        sections: sections.map((current) => current.key === section.key ? { ...current, contentHtml } : current),
    })

    const richField = (label: string, fieldId: string, value: string, onChange: (content: string) => void) => (
        <section className="lesson-reading-field">
            <h3>{label}</h3>
            <LessonRichTextEditor key={`${label}-${editing ? 'edit' : 'view'}`} noteFieldId={fieldId} ariaLabel={label} content={value} editable={editing} lessonId={lesson.id} getAccessToken={getAccessToken} onUploadStateChange={onUploadStateChange} onChange={onChange} />
        </section>
    )

    return (
        <section className="lesson-reading-page" aria-label="Chi tiết giáo án" inert={busy} aria-busy={busy}>
            <div className="reading-toolbar">
                <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> Danh sách giáo án</button>
                {extraActions}
                {canManage && !editing && <button className="outline-button" onClick={() => setEditing(true)}>Chỉnh sửa trực tiếp</button>}
                {canManage && editing && <div className="reading-actions">
                    <button className="secondary-button" onClick={() => { setDraft(lesson); setEditing(false) }}><X size={16} /> Hủy</button>
                    <button className="primary-button" onClick={async () => { if (await onSave({ ...draft, sections })) setEditing(false) }}><Save size={16} /> Lưu nháp</button>
                    <button className="admin-danger-button" onClick={() => onDelete(lesson)}><Trash2 size={16} /> Xóa bài</button>
                </div>}
            </div>

            {canManage && lesson.hasDraft && <aside className="lesson-draft-notice" aria-label="Trạng thái xuất bản">
                <p role="status">Bản nháp đã lưu. Xuất bản để tài khoản Reader đọc được.</p>
                {!editing && <button className="primary-button" onClick={() => onPublish(lesson)}>Xuất bản</button>}
            </aside>}

            <article className="lesson-reading-paper">
                <header className="lesson-reading-header">
                    <div className="lesson-reading-scripture">
                        {editing ? <>
                            <textarea aria-label="Lời Chúa" value={draft.scripture ?? ''} onChange={(event) => update({ scripture: event.target.value })} rows={2} />
                            <input aria-label="Trích dẫn Lời Chúa" value={draft.scriptureReference ?? ''} onChange={(event) => update({ scriptureReference: event.target.value })} placeholder="Trích dẫn" />
                        </> : <><blockquote>{lesson.scripture ? <LessonRichTextEditor content={lesson.scripture} editable={false} noteFieldId="scripture" ariaLabel="Lời Chúa" /> : 'Chưa có lời Chúa cho bài này.'}</blockquote>{lesson.scriptureReference && <cite>— {lesson.scriptureReference}</cite>}</>}
                    </div>
                    {editing ? <div className="lesson-reading-metadata">
                        <input aria-label="Số bài" value={draft.tag} onChange={(event) => update({ tag: event.target.value })} />
                        <input aria-label="Tiêu đề bài giáo án" value={draft.title} onChange={(event) => update({ title: event.target.value })} />
                        <input aria-label="Thời lượng" value={draft.time} onChange={(event) => update({ time: event.target.value })} />
                        <textarea aria-label="Mô tả ngắn" value={draft.excerpt} onChange={(event) => update({ excerpt: event.target.value })} rows={2} />
                    </div> : <><span className="lesson-reading-number">{lesson.tag} · {lesson.time}</span><h1>{lesson.title}</h1><p>{lesson.excerpt}</p></>}
                    <span className="lesson-reading-level">{editing ? <select aria-label="Ngành học" value={draft.level ?? lessonPlans[0].level} onChange={(event) => update({ level: event.target.value, sublevel: lessonPlans.find((plan) => plan.level === event.target.value)?.sublevels[0] })}>{lessonPlans.map((plan) => <option key={plan.level} value={plan.level}>{plan.level}</option>)}</select> : `Ngành ${lesson.level ?? 'chưa phân loại'}`}</span>
                    {editing && Boolean(lessonPlans.find((plan) => plan.level === draft.level)?.sublevels.length) && <select aria-label="Phân ngành" value={draft.sublevel ?? ''} onChange={(event) => update({ sublevel: event.target.value })}>
                        <option value="">Chọn phân ngành</option>
                        {lessonPlans.find((plan) => plan.level === draft.level)?.sublevels.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>}
                </header>

                <div className="lesson-reading-intro">
                    {richField('Ý chính', 'keyPoints', (editing ? draft : lesson).keyPoints, (value) => update({ keyPoints: value }))}
                    {richField('Tâm tình', 'sentiment', (editing ? draft : lesson).sentiment, (value) => update({ sentiment: value }))}
                    <LessonPreparationField key={`${lesson.id}-${editing ? 'edit' : 'view'}`} noteFieldId="preparation" content={(editing ? draft : lesson).preparation} editable={editing} lessonId={lesson.id} getAccessToken={getAccessToken} onUploadStateChange={onUploadStateChange} onChange={(preparation) => update({ preparation })} />
                </div>

                <section className="lesson-progression">
                    <h2>Gợi ý tiến trình lên lớp</h2>
                </section>

                <div className="lesson-reading-sections">
                    {sections.map((section) => <section className="lesson-reading-section" key={section.key}>
                        <h2>{section.key}. {section.title}</h2>
                        <LessonRichTextEditor
                            key={`${section.key}-${editing ? 'edit' : 'view'}`}
                            ariaLabel={`Mục ${section.key}. ${section.title}`}
                            content={section.contentHtml}
                            noteFieldId={`section:${section.key}`}
                            editable={editing}
                            lessonId={lesson.id}
                            getAccessToken={getAccessToken}
                            onUploadStateChange={onUploadStateChange}
                            onChange={(content) => updateSection(section, content)}
                        />
                    </section>)}
                </div>

            </article>
        </section>
    )
}
