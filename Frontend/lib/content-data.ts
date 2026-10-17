export type { ReferenceCategory, ReferenceDocument, ReferenceListItem } from './reference-content'
export type { AppRole } from './auth/types'
import type { AppRole } from './auth/types'

export const industryColorHex = {
    pink: '#FDD2DC',
    'green-light': '#D2F786',
    'blue-deep': '#315C83',
    yellow: '#C09A3D',
    brown: '#79563F',
} as const

export type IndustryColor = keyof typeof industryColorHex

export type Industry = {
    level: string
    subtitle: string
    sublevels: string[]
    color: IndustryColor
    icon: string
}

export type ContentState = {
    version?: number
    status?: 'ACTIVE' | 'DELETED'
    hasDraft?: boolean
    hasPublished?: boolean
}

export type Lesson = ContentState & {
    id: string
    title: string
    excerpt: string
    content: string
    tag: string
    time: string
    level?: string
    sublevel?: string
    scripture?: string
    scriptureReference?: string
    keyPoints: string
    sentiment: string
    preparation: string
    progression: LessonProgressionStep[]
    sections?: LessonSection[]
}

export type LessonSectionKey = string

export type LessonSection = {
    key: LessonSectionKey
    title: string
    contentHtml: string
}

export type LessonProgressionStep = {
    teacherActivity: string
    learnerActivity: string
}

export type ProgramScheduleColumn = { id: string; label: string }

export type ProgramScheduleRow = {
    id: string
    values: Record<string, string>
    mergedCellGroups?: string[][]
}

export type Program = ContentState & {
    id: string
    title: string
    desc: string
    progress: number
    lessons: string
    color: IndustryColor
    level: string
    sublevel?: string
    scheduleColumns?: ProgramScheduleColumn[]
    schedule?: ProgramScheduleRow[]
}

export type CatechistStatus = 'Đã nghỉ' | 'Tạm nghỉ' | 'Còn hoạt động'

export type Catechist = {
    id?: string
    version?: number
    name: string
    email: string
    phone: string
    homeroomClass: string
    accompanyingClass: string
    status: CatechistStatus
}

export type AccountStatus = 'Hoạt động' | 'Vô hiệu hóa' | 'Đã lưu trữ'

export type SystemAccount = {
    id: string
    email: string
    role: AppRole
    linkedCatechistEmail?: string
    linkedCatechistId?: string
    status: AccountStatus
    createdAt: string
}

export const lessonPlans: Industry[] = [
    { level: 'Chiên con', subtitle: 'Giáo án theo ngành', sublevels: [], color: 'pink', icon: '✦' },
    { level: 'Ấu nhi', subtitle: 'Giáo án theo ngành', sublevels: ['Ấu 1', 'Ấu 2', 'Ấu 3'], color: 'green-light', icon: '✣' },
    { level: 'Thiếu Nhi', subtitle: 'Giáo án theo ngành', sublevels: ['Thiếu 1', 'Thiếu 2', 'Thiếu 3'], color: 'blue-deep', icon: '✥' },
    { level: 'Nghĩa sĩ', subtitle: 'Giáo án theo ngành', sublevels: ['Nghĩa sĩ 1', 'Nghĩa sĩ 2', 'Nghĩa sĩ 3'], color: 'yellow', icon: '✧' },
    { level: 'Hiệp sĩ', subtitle: 'Giáo án theo ngành', sublevels: [], color: 'brown', icon: '✣' },
]

export const defaultProgramScheduleColumns: ProgramScheduleColumn[] = [
    { id: 'date', label: 'Ngày' },
    { id: 'weekNumber', label: 'Tuần' },
    { id: 'topic', label: 'Đề tài' },
    { id: 'lessonContent', label: 'Nội dung thực hiện' },
    { id: 'activities', label: 'Phong trào / kỹ năng' },
    { id: 'notes', label: 'Chương trình trong ngày / tuần' },
]

export const createEmptyProgramScheduleRow = (columns: ProgramScheduleColumn[] = defaultProgramScheduleColumns): ProgramScheduleRow => ({
    id: `schedule-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    values: Object.fromEntries(columns.map(({ id }) => [id, ''])),
})
