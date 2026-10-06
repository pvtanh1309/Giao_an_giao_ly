'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react'
import type { Lesson, LessonProgressionStep, LessonSection } from '../lib/content-data'
import { lessonPlans } from '../lib/content-data'
import { getLessonSections } from '../lib/lesson-content'
import { LessonRichTextEditor } from './lesson-rich-text-editor'

export type LessonReadingPageProps = {
    lesson: Lesson
    canManage: boolean
    onSave: (lesson: Lesson) => void
    onDelete: (lesson: Lesson) => void
    onBack: () => void
    getAccessToken?: () => Promise<string>
}

export function LessonReadingPage({ lesson, canManage, onSave, onDelete, onBack, getAccessToken }: LessonReadingPageProps) {
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
    const updateProgression = (index: number, changes: Partial<LessonProgressionStep>) => update({
        progression: draft.progression.map((step, stepIndex) => stepIndex === index ? { ...step, ...changes } : step),
    })

    const richField = (label: string, value: string, onChange: (content: string) => void) => (
        <section className="lesson-reading-field">
            <h3>{label}</h3>
            <LessonRichTextEditor key={`${label}-${editing ? 'edit' : 'view'}`} ariaLabel={label} content={value} editable={editing} lessonId={lesson.id} getAccessToken={getAccessToken} onChange={onChange} />
        </section>
    )

    return (
        <section className="lesson-reading-page" aria-label="Chi tiết giáo án">
            <div className="reading-toolbar">
                <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> Danh sách giáo án</button>
                {canManage && !editing && <button className="outline-button" onClick={() => setEditing(true)}>Chỉnh sửa trực tiếp</button>}
                {canManage && editing && <div className="reading-actions">
                    <button className="secondary-button" onClick={() => { setDraft(lesson); setEditing(false) }}><X size={16} /> Hủy</button>
                    <button className="primary-button" onClick={() => { onSave({ ...draft, sections }); setEditing(false) }}><Save size={16} /> Lưu thay đổi</button>
                    <button className="admin-danger-button" onClick={() => onDelete(lesson)}><Trash2 size={16} /> Xóa bài</button>
                </div>}
            </div>

            <article className="lesson-reading-paper">
                <header className="lesson-reading-header">
                    <div className="lesson-reading-scripture">
                        {editing ? <>
                            <textarea aria-label="Lời Chúa" value={draft.scripture ?? ''} onChange={(event) => update({ scripture: event.target.value })} rows={2} />
                            <input aria-label="Trích dẫn Lời Chúa" value={draft.scriptureReference ?? ''} onChange={(event) => update({ scriptureReference: event.target.value })} placeholder="Trích dẫn" />
                        </> : <><blockquote>{lesson.scripture || 'Chưa có lời Chúa cho bài này.'}</blockquote>{lesson.scriptureReference && <cite>— {lesson.scriptureReference}</cite>}</>}
                    </div>
                    {editing ? <div className="lesson-reading-metadata">
                        <input aria-label="Số bài" value={draft.tag} onChange={(event) => update({ tag: event.target.value })} />
                        <input aria-label="Tiêu đề bài giáo án" value={draft.title} onChange={(event) => update({ title: event.target.value })} />
                        <input aria-label="Thời lượng" value={draft.time} onChange={(event) => update({ time: event.target.value })} />
                        <textarea aria-label="Mô tả ngắn" value={draft.excerpt} onChange={(event) => update({ excerpt: event.target.value })} rows={2} />
                    </div> : <><span className="lesson-reading-number">{lesson.tag} · {lesson.time}</span><h1>{lesson.title}</h1><p>{lesson.excerpt}</p></>}
                    <span className="lesson-reading-level">{editing ? <select aria-label="Ngành học" value={draft.level ?? lessonPlans[0].level} onChange={(event) => update({ level: event.target.value })}>{lessonPlans.map((plan) => <option key={plan.level} value={plan.level}>{plan.level}</option>)}</select> : `Ngành ${lesson.level ?? 'chưa phân loại'}`}</span>
                </header>

                <div className="lesson-reading-intro">
                    {richField('Ý chính', (editing ? draft : lesson).keyPoints, (value) => update({ keyPoints: value }))}
                    {richField('Tâm tình', (editing ? draft : lesson).sentiment, (value) => update({ sentiment: value }))}
                    {richField('Chuẩn bị', (editing ? draft : lesson).preparation, (value) => update({ preparation: value }))}
                </div>

                <section className="lesson-progression">
                    <h2>Gợi ý tiến trình lên lớp</h2>
                    {editing && <button className="outline-button" onClick={() => update({ progression: [...draft.progression, { teacherActivity: '', learnerActivity: '' }] })}><Plus size={15} /> Thêm bước</button>}
                    {((editing ? draft : lesson).progression ?? []).map((step, index) => <div className="lesson-progression-row" key={index}>
                        <div><h3>Hoạt động giáo lý viên</h3><LessonRichTextEditor ariaLabel={`Hoạt động giáo lý viên, bước ${index + 1}`} content={step.teacherActivity} editable={editing} lessonId={lesson.id} getAccessToken={getAccessToken} onChange={(content) => updateProgression(index, { teacherActivity: content })} /></div>
                        <div><h3>Hoạt động học viên</h3><LessonRichTextEditor ariaLabel={`Hoạt động học viên, bước ${index + 1}`} content={step.learnerActivity} editable={editing} lessonId={lesson.id} getAccessToken={getAccessToken} onChange={(content) => updateProgression(index, { learnerActivity: content })} /></div>
                        {editing && <button className="schedule-row-remove" aria-label={`Xóa bước ${index + 1}`} onClick={() => update({ progression: draft.progression.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15} /></button>}
                    </div>)}
                    {!lesson.progression?.length && !editing && <p className="reading-empty">Chưa có gợi ý tiến trình.</p>}
                </section>

                <div className="lesson-reading-sections">
                    {sections.map((section) => <section className="lesson-reading-section" key={section.key}>
                        <h2>{section.key}. {section.title}</h2>
                        <LessonRichTextEditor
                            key={`${section.key}-${editing ? 'edit' : 'view'}`}
                            ariaLabel={`Mục ${section.key}. ${section.title}`}
                            content={section.contentHtml}
                            editable={editing}
                            lessonId={lesson.id}
                            getAccessToken={getAccessToken}
                            onChange={(content) => updateSection(section, content)}
                        />
                    </section>)}
                </div>

                {(editing || lesson.content?.trim()) && <section className="lesson-legacy-content">
                    <h2>Nội dung hiện có</h2>
                    <LessonRichTextEditor
                        key={`legacy-${editing ? 'edit' : 'view'}`}
                        ariaLabel="Nội dung hiện có"
                        content={editing ? draft.content : lesson.content}
                        editable={editing}
                        lessonId={lesson.id}
                        getAccessToken={getAccessToken}
                        onChange={(content) => update({ content })}
                    />
                </section>}
            </article>
        </section>
    )
}
