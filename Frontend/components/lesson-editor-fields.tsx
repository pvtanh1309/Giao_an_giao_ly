'use client'

import type { LessonStructuredContent } from '../lib/lesson-content'
import { lessonSectionTitles } from '../lib/lesson-content'
import { LessonRichTextEditor } from './lesson-rich-text-editor'
import { LessonPreparationField } from './lesson-preparation-field'

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
            ] as const).map(([label, key]) => <section className="lesson-reading-field" key={key}>
                <h3>{label}</h3>
                <LessonRichTextEditor ariaLabel={label} content={fields[key]} lessonId={lessonId} getAccessToken={getAccessToken} onChange={(value) => update({ [key]: value })} />
            </section>)}
            <LessonPreparationField content={fields.preparation} lessonId={lessonId} getAccessToken={getAccessToken} onChange={(preparation) => update({ preparation })} />
            <section className="lesson-progression">
                <h2>Gợi ý tiến trình lên lớp</h2>
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
