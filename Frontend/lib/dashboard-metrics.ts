import type { Lesson } from './content-data'

export function getDashboardMetrics(lessons: Pick<Lesson, 'level'>[]) {
    const savedIndustries = new Set(
        lessons
            .map((lesson) => lesson.level?.trim().toLocaleLowerCase('vi'))
            .filter((level): level is string => Boolean(level)),
    )

    return {
        lessonCount: lessons.length,
        industryCount: savedIndustries.size,
    }
}
