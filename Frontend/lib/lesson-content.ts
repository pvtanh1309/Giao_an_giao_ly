import type { Lesson, LessonSection } from './content-data'

export const lessonSectionTitles = [
    { key: 'I', title: 'Ổn định' },
    { key: 'II', title: 'Em nghe Lời Chúa' },
    { key: 'III', title: 'Em nhớ Lời Chúa' },
    { key: 'IV', title: 'Em sống Lời Chúa' },
    { key: 'V', title: 'Kết thúc' },
] as const

export type NewLessonDraft = Pick<Lesson,
    'id' | 'title' | 'excerpt' | 'tag' | 'time' | 'level' | 'scripture' |
    'scriptureReference' | 'keyPoints' | 'sentiment' | 'preparation' | 'progression' | 'sections'
>

export type LessonStructuredContent = Pick<Lesson,
    'scripture' | 'scriptureReference' | 'keyPoints' | 'sentiment' | 'preparation' | 'progression' | 'sections'
>

export function createEmptyLessonSections(): LessonSection[] {
    return lessonSectionTitles.map(({ key, title }) => ({ key, title, contentHtml: '' }))
}

export function createEmptyLessonStructuredContent(scripture = '', scriptureReference = ''): LessonStructuredContent {
    return {
        scripture,
        scriptureReference,
        keyPoints: '',
        sentiment: '',
        preparation: '',
        progression: [],
        sections: createEmptyLessonSections(),
    }
}

export function createLessonFromDraft(draft: NewLessonDraft): Lesson {
    return { ...draft, content: '' }
}

/** Sort a copy so saving or publishing cannot change the displayed order. */
export function sortLessonsByNumber(lessons: readonly Lesson[]): Lesson[] {
    const number = (lesson: Lesson): number => {
        const value = Number(lesson.tag.match(/\d+/)?.[0])
        return Number.isSafeInteger(value) && value > 0 ? value : Number.POSITIVE_INFINITY
    }
    return [...lessons].sort((left, right) => {
        const leftNumber = number(left), rightNumber = number(right)
        if (leftNumber !== rightNumber) return leftNumber - rightNumber
        return left.title.localeCompare(right.title, 'vi', { numeric: true })
            || left.id.localeCompare(right.id)
    })
}

export function getLessonSections(lesson: Lesson): LessonSection[] {
    const existing = lesson.sections ?? []
    return [
        ...lessonSectionTitles.map(({ key, title }) => existing.find((section) => section.key === key)
            ?? { key, title, contentHtml: '' }),
        ...existing.filter((section) => !lessonSectionTitles.some(({ key }) => key === section.key)),
    ]
}

export function getLessonSearchText(lesson: Lesson): string {
    return [
        lesson.title,
        lesson.excerpt,
        lesson.content,
        lesson.level,
        lesson.keyPoints,
        lesson.sentiment,
        lesson.preparation,
        ...(lesson.progression ?? []).flatMap((step) => [step.teacherActivity, step.learnerActivity]),
        ...(lesson.sections ?? []).map((section) => section.contentHtml),
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi')
}
