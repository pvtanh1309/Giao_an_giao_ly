import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyLessonSections, createLessonFromDraft } from '../lib/lesson-content.ts'
import { getDashboardMetrics } from '../lib/dashboard-metrics.ts'
import { createEmptyProgramScheduleRow, industryColorHex, lessonPlans, programs } from '../lib/content-data.ts'
import { lessonEditorExtensions } from '../components/rich-text-extensions.ts'
import { getProgramsForDirectIndustry, getProgramsForIndustry, getProgramsForSublevel } from '../lib/program-navigation.ts'

test('new lesson keeps the same structured fields used by the reading page', () => {
    const progression = [{ teacherActivity: 'Dẫn nhập', learnerActivity: 'Lắng nghe' }]
    const sections = createEmptyLessonSections()
    sections[0].contentHtml = 'Ổn định lớp'

    const lesson = createLessonFromDraft({
        id: 'lesson-new',
        title: 'Lời Chúa',
        excerpt: 'Mô tả',
        tag: 'BÀI 05',
        time: '45 phút',
        level: 'Ấu nhi',
        scripture: 'Hãy để trẻ em đến với Thầy.',
        scriptureReference: 'Mt 19,14',
        keyPoints: 'Ý chính',
        sentiment: 'Tâm tình',
        preparation: 'Thánh Kinh',
        progression,
        sections,
    })

    assert.equal(lesson.keyPoints, 'Ý chính')
    assert.equal(lesson.sentiment, 'Tâm tình')
    assert.deepEqual(lesson.progression, progression)
    assert.deepEqual(lesson.sections, sections)
    assert.equal(lesson.content, '')
})

test('new lessons start with all five standard lesson sections', () => {
    assert.deepEqual(createEmptyLessonSections().map(({ key }) => key), ['I', 'II', 'III', 'IV', 'V'])
})

test('dashboard metrics count saved lessons and distinct non-empty industries', () => {
    assert.deepEqual(getDashboardMetrics([
        { level: 'Ấu nhi' },
        { level: 'Ấu nhi' },
        { level: 'Nghĩa sĩ' },
        { level: undefined },
        { level: '   ' },
    ]), { lessonCount: 5, industryCount: 2 })
})

test('new program schedule rows use only that program’s configured columns', () => {
    const row = createEmptyProgramScheduleRow([
        { id: 'meeting-date', label: 'Ngày sinh hoạt' },
        { id: 'leader-note', label: 'Ghi chú trưởng ngành' },
    ])

    assert.deepEqual(row.values, { 'meeting-date': '', 'leader-note': '' })
})

test('industry cards and program badges use the requested colors for their levels', () => {
    const expectedColors = {
        'Chiên con': 'pink',
        'Ấu nhi': 'green-light',
        'Thiếu Nhi': 'blue-deep',
        'Nghĩa sĩ': 'yellow',
        'Hiệp sĩ': 'brown',
    }

    for (const [level, color] of Object.entries(expectedColors)) {
        assert.equal(lessonPlans.find((industry) => industry.level === level)?.color, color)

        const program = programs.find((item) => item.level === level)
        if (program) assert.equal(program.color, color)
    }
})

test('pink and light green industry colors match the supplied color samples', () => {
    assert.equal(industryColorHex.pink, '#FDD2DC')
    assert.equal(industryColorHex['green-light'], '#D2F786')
})

test('industry selection returns only programs belonging to that industry', () => {
    const availablePrograms = [
        { id: 'au-1', level: 'Ấu nhi', sublevel: 'Ấu 1' },
        { id: 'au-2', level: 'Ấu nhi', sublevel: 'Ấu 2' },
        { id: 'thieu-1', level: 'Thiếu Nhi', sublevel: 'Thiếu 1' },
    ]

    assert.deepEqual(getProgramsForIndustry(availablePrograms, 'Ấu nhi').map(({ id }) => id), ['au-1', 'au-2'])
})

test('industries without sublevels show direct programs but never nested programs', () => {
    const availablePrograms = [
        { id: 'ch-star', level: 'Chiên con', sublevel: undefined },
        { id: 'unexpected-nested', level: 'Chiên con', sublevel: 'Nhóm 1' },
        { id: 'au-1', level: 'Ấu nhi', sublevel: 'Ấu 1' },
    ]

    assert.deepEqual(getProgramsForDirectIndustry(availablePrograms, 'Chiên con').map(({ id }) => id), ['ch-star'])
})

test('sublevel selection returns only its matching program pages', () => {
    const availablePrograms = [
        { id: 'au-1-first', level: 'Ấu nhi', sublevel: 'Ấu 1' },
        { id: 'au-1-second', level: 'Ấu nhi', sublevel: 'Ấu 1' },
        { id: 'au-2', level: 'Ấu nhi', sublevel: 'Ấu 2' },
    ]

    assert.deepEqual(getProgramsForSublevel(availablePrograms, 'Ấu nhi', 'Ấu 1').map(({ id }) => id), ['au-1-first', 'au-1-second'])
})

test('lesson rich-text editor registers persistent font-size formatting', () => {
    assert.ok(lessonEditorExtensions.some((extension) => extension.name === 'fontSize'))
})
