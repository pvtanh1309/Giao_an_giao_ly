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

export type Lesson = {
    id: string
    title: string
    excerpt: string
    content: string
    tag: string
    time: string
    level?: string
    scripture?: string
    scriptureReference?: string
    keyPoints: string
    sentiment: string
    preparation: string
    progression: LessonProgressionStep[]
    sections?: LessonSection[]
}

export type LessonSectionKey = 'I' | 'II' | 'III' | 'IV' | 'V'

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

export type Program = {
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

export const defaultLessonScripture = '“Hãy để trẻ em đến với Thầy, đừng ngăn cấm chúng.”'
export const defaultLessonScriptureReference = 'Mt 19,14'

export const lessonCatalog: Lesson[] = [
    { id: 'lesson-01', title: 'Chúa Giêsu yêu thương em', excerpt: 'Nhận biết tình yêu của Chúa Giêsu qua những câu chuyện gần gũi.', content: 'Mục tiêu: Giúp các em nhận biết Chúa Giêsu luôn yêu thương và đồng hành với mình. Hoạt động: kể chuyện, thảo luận nhóm và lời nguyện kết thúc.', tag: 'BÀI 01', time: '45 phút', level: 'Ấu nhi', keyPoints: '', sentiment: '', preparation: '', progression: [] },
    { id: 'lesson-02', title: 'Em cầu nguyện cùng Chúa', excerpt: 'Tập thói quen thưa chuyện với Chúa bằng lời nguyện đơn sơ.', content: 'Tập thói quen thưa chuyện với Chúa bằng lời nguyện đơn sơ.', tag: 'BÀI 02', time: '40 phút', level: 'Ấu nhi', keyPoints: '', sentiment: '', preparation: '', progression: [] },
    { id: 'lesson-03', title: 'Gia đình là mái ấm', excerpt: 'Khám phá tình yêu gia đình như món quà Thiên Chúa trao ban.', content: 'Khám phá tình yêu gia đình như món quà Thiên Chúa trao ban.', tag: 'BÀI 03', time: '45 phút', level: 'Thiếu Nhi', keyPoints: '', sentiment: '', preparation: '', progression: [] },
    { id: 'lesson-04', title: 'Làm điều tốt mỗi ngày', excerpt: 'Biết thể hiện tình yêu qua những việc tốt nhỏ bé trong đời sống.', content: 'Biết thể hiện tình yêu qua những việc tốt nhỏ bé trong đời sống.', tag: 'BÀI 04', time: '50 phút', level: 'Nghĩa sĩ', keyPoints: '', sentiment: '', preparation: '', progression: [] },
]

export const programs: Program[] = [
    { id: 'program-au-nhi', title: 'Ngành Ấu Nhi', desc: 'Làm quen với Chúa Giêsu và đời sống đức tin', progress: 72, lessons: '24 bài học', color: 'green-light', level: 'Ấu nhi', sublevel: 'Ấu 1' },
    { id: 'program-thieu-nhi', title: 'Ngành Thiếu Nhi', desc: 'Khám phá Kinh Thánh và sống Lời Chúa', progress: 48, lessons: '36 bài học', color: 'blue-deep', level: 'Thiếu Nhi', sublevel: 'Thiếu 1' },
    { id: 'program-nghia-si', title: 'Ngành Nghĩa Sĩ', desc: 'Trưởng thành trong đức tin và phục vụ', progress: 86, lessons: '28 bài học', color: 'yellow', level: 'Nghĩa sĩ', sublevel: 'Nghĩa sĩ 1' },
]

export const catechists: Catechist[] = [
    { name: 'Maria Nguyễn Thị Lan', email: 'lan.nguyen@email.com', phone: '0901 234 567', homeroomClass: 'Ấu Nhi', accompanyingClass: '', status: 'Còn hoạt động' },
    { name: 'Gioan Trần Minh Đức', email: 'duc.tran@email.com', phone: '0912 345 678', homeroomClass: 'Thiếu Nhi', accompanyingClass: '', status: 'Còn hoạt động' },
    { name: 'Anna Lê Hoàng Yến', email: 'yen.le@email.com', phone: '0934 567 890', homeroomClass: 'Nghĩa sĩ', accompanyingClass: '', status: 'Còn hoạt động' },
    { name: 'Phaolô Phạm Quốc Bảo', email: 'bao.pham@email.com', phone: '0987 654 321', homeroomClass: 'Thiếu Nhi', accompanyingClass: '', status: 'Tạm nghỉ' },
    { name: 'Phêrô Lê Hữu Thành', email: 'thanh.le@email.com', phone: '0968 234 567', homeroomClass: 'Chiên con', accompanyingClass: '', status: 'Còn hoạt động' },
]

export const systemAccounts: SystemAccount[] = [
    { id: 'admin-1', email: 'admin@giaoxuthaian.vn', role: 'admin', status: 'Hoạt động', createdAt: '03/10/2026' },
    { id: 'editor-1', email: 'lan.nguyen@email.com', role: 'editor', linkedCatechistEmail: 'lan.nguyen@email.com', status: 'Hoạt động', createdAt: '03/10/2026' },
    { id: 'editor-2', email: 'duc.tran@email.com', role: 'editor', linkedCatechistEmail: 'duc.tran@email.com', status: 'Hoạt động', createdAt: '03/10/2026' },
    { id: 'editor-3', email: 'yen.le@email.com', role: 'editor', linkedCatechistEmail: 'yen.le@email.com', status: 'Hoạt động', createdAt: '03/10/2026' },
    { id: 'editor-4', email: 'bao.pham@email.com', role: 'editor', linkedCatechistEmail: 'bao.pham@email.com', status: 'Vô hiệu hóa', createdAt: '03/10/2026' },
    { id: 'editor-5', email: 'thanh.le@email.com', role: 'editor', linkedCatechistEmail: 'thanh.le@email.com', status: 'Hoạt động', createdAt: '03/10/2026' },
    { id: 'reader-1', email: 'giaoly@giaoxuthaian.vn', role: 'reader', status: 'Hoạt động', createdAt: '03/10/2026' },
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

export const programSchedule: ProgramScheduleRow[] = [
    { id: 'row-1', values: { date: '08/09/24', weekNumber: '1', topic: 'Em là con yêu dấu của Chúa', lessonContent: 'Làm quen, ghi nhớ tên và nhận biết mình được Chúa yêu thương.', activities: 'Nghi thức chào cờ · Tập hát', notes: 'Chương trình Chúa nhật' } },
    { id: 'row-2', values: { date: '15/09/24', weekNumber: '2', topic: 'Gia đình của em', lessonContent: 'Biết ơn cha mẹ, ông bà và thực hành một việc phục vụ trong gia đình.', activities: 'Bài hát: Gia đình nhỏ', notes: 'Sinh hoạt theo đội' } },
    { id: 'row-3', values: { date: '22/09/24', weekNumber: '3', topic: 'Lời Chúa trong đời sống', lessonContent: 'Lắng nghe một đoạn Tin Mừng và chia sẻ điều em muốn thực hiện.', activities: 'Kinh Lạy Cha · Sống đẹp', notes: 'Giờ học giáo lý' } },
    { id: 'row-4', values: { date: '29/09/24', weekNumber: '4', topic: 'Em sống yêu thương', lessonContent: 'Thực hành cách nói lời tử tế và xây dựng tình bạn trong lớp.', activities: 'Phong trào việc tốt', notes: 'Chương trình tháng' } },
]
