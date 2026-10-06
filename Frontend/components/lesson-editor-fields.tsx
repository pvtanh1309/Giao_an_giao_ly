'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { LessonStructuredContent } from '../lib/lesson-content'
import { lessonSectionTitles } from '../lib/lesson-content'
import { LessonRichTextEditor } from './lesson-rich-text-editor'

type LessonEditorFieldsProps = {
    description: string
    tag: string
    time: string
    fields: LessonStructuredContent
    lessonId?: string
    getAccessToken?: () => Promise<string>
    onDescriptionChange: (value: string) => void
    onTagChange: (value: string) => void
    onTimeChange: (value: string) => void
    onFieldsChange: (fields: LessonStructuredContent) => void
}

export function LessonEditorFields({
    description,
    tag,
    time,
    fields,
    lessonId,
    getAccessToken,
    onDescriptionChange,
    onTagChange,
    onTimeChange,
    onFieldsChange,
}: LessonEditorFieldsProps) {
    const update = (changes: Partial<LessonStructuredContent>) => onFieldsChange({ ...fields, ...changes })
    const updateProgression = (index: number, key: 'teacherActivity' | 'learnerActivity', value: string) => {
        update({ progression: fields.progression.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) })
    }

    return (
        <div className="lesson-create-structure">
            <div className="lesson-create-meta">
                <label>Số bài<input value={tag} onChange={(event) => onTagChange(event.target.value)} placeholder="BÀI 01" /></label>
                <label>Thời lượng<input value={time} onChange={(event) => onTimeChange(event.target.value)} placeholder="45 phút" /></label>
            </div>
            <label>
                Mô tả ngắn
                <textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Mô tả ngắn cho giáo án" rows={3} />
            </label>
            <section className="lesson-create-scripture">
                <label>Lời Chúa<textarea value={fields.scripture ?? ''} onChange={(event) => update({ scripture: event.target.value })} rows={2} /></label>
                <label>Trích dẫn Lời Chúa<input value={fields.scriptureReference ?? ''} onChange={(event) => update({ scriptureReference: event.target.value })} placeholder="Ví dụ: Mt 19,14" /></label>
            </section>
            {([
                ['Ý chính', 'keyPoints'],
                ['Tâm tình', 'sentiment'],
                ['Chuẩn bị', 'preparation'],
            ] as const).map(([label, key]) => <section className="lesson-reading-field" key={key}>
                <h3>{label}</h3>
                <LessonRichTextEditor ariaLabel={label} content={fields[key]} lessonId={lessonId} getAccessToken={getAccessToken} onChange={(value) => update({ [key]: value })} />
            </section>)}
            <section className="lesson-progression">
                <h2>Gợi ý tiến trình lên lớp</h2>
                <button type="button" className="outline-button" onClick={() => update({ progression: [...fields.progression, { teacherActivity: '', learnerActivity: '' }] })}><Plus size={15} /> Thêm bước</button>
                {fields.progression.map((step, index) => <div className="lesson-progression-row" key={index}>
                    <div><h3>Hoạt động giáo lý viên</h3><LessonRichTextEditor ariaLabel={`Hoạt động giáo lý viên, bước ${index + 1}`} content={step.teacherActivity} lessonId={lessonId} getAccessToken={getAccessToken} onChange={(value) => updateProgression(index, 'teacherActivity', value)} /></div>
                    <div><h3>Hoạt động học viên</h3><LessonRichTextEditor ariaLabel={`Hoạt động học viên, bước ${index + 1}`} content={step.learnerActivity} lessonId={lessonId} getAccessToken={getAccessToken} onChange={(value) => updateProgression(index, 'learnerActivity', value)} /></div>
                    <button type="button" className="schedule-row-remove" aria-label={`Xóa bước ${index + 1}`} onClick={() => update({ progression: fields.progression.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15} /></button>
                </div>)}
            </section>
            <section className="lesson-reading-sections">
                {lessonSectionTitles.map(({ key, title }) => {
                    const section = fields.sections?.find((item) => item.key === key) ?? { key, title, contentHtml: '' }
                    return <section className="lesson-reading-section" key={key}>
                        <h2>{key}. {title}</h2>
                        <LessonRichTextEditor ariaLabel={`Mục ${key}. ${title}`} content={section.contentHtml} lessonId={lessonId} getAccessToken={getAccessToken} onChange={(contentHtml) => update({ sections: (fields.sections ?? []).some((item) => item.key === key)
                            ? (fields.sections ?? []).map((item) => item.key === key ? { ...item, contentHtml } : item)
                            : [...(fields.sections ?? []), { key, title, contentHtml }] })} />
                    </section>
                })}
            </section>
        </div>
    )
}
