'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Church,
  FileText,
  Heart,
  LayoutDashboard,
  LogIn,
  Menu,
  Plus,
  Pencil,
  Search,
  Trash2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { SiteHeader } from '../components/site-header'
import { CatechistDirectory } from '../components/catechist-directory'
import { HeroSection } from '../components/hero-section'
import { LessonDirectory } from '../components/lesson-directory'
import { ProgramDirectory } from '../components/program-directory'
import { StatsStrip } from '../components/stats-strip'
import { AdminEditorDialog } from '../components/admin-editor-dialog'
import { LessonDialogs } from '../components/lesson-dialogs'
import { LessonReadingPage } from '../components/lesson-reading-page'
import { ProgramReadingPage } from '../components/program-reading-page'
import { ReferenceDirectory } from '../components/reference-directory'
import { ReferenceReadingPage } from '../components/reference-reading-page'
import { SystemAccountDirectory } from '../components/system-account-directory'
import {
  catechists,
  createEmptyProgramScheduleRow,
  defaultProgramScheduleColumns,
  defaultLessonScripture,
  defaultLessonScriptureReference,
  lessonCatalog,
  lessonPlans,
  programSchedule,
  programs,
  systemAccounts,
  type AccountStatus,
  type AppRole,
  type Catechist,
  type CatechistStatus,
  type Lesson,
  type Program,
  type ProgramScheduleRow,
  type ProgramScheduleColumn,
  type SystemAccount,
} from '../lib/content-data'
import { createEmptyLessonStructuredContent, createLessonFromDraft, type LessonStructuredContent } from '../lib/lesson-content'
import { getDashboardMetrics } from '../lib/dashboard-metrics'
import type { ReferenceCategory, ReferenceDocument } from '../lib/reference-content'

export default function Page({ initialView = 'overview' }: { initialView?: 'overview' | 'lessons' | 'programs' | 'catechists' | 'accounts' }) {
  const [activeNav, setActiveNav] = useState(initialView === 'lessons' ? 'Giáo án' : initialView === 'programs' ? 'Chương trình học' : initialView === 'catechists' ? 'Giáo lý viên' : initialView === 'accounts' ? 'Tài khoản hệ thống' : 'Tổng quan')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [currentUser, setCurrentUser] = useState<AppRole | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [selectedProgramLevel, setSelectedProgramLevel] = useState<string | null>(null)
  const [selectedProgramSublevel, setSelectedProgramSublevel] = useState<string | null>(null)
  const [lessonBrowser, setLessonBrowser] = useState<{ level: string; subtitle: string } | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null)
  const [selectedReferenceCategory, setSelectedReferenceCategory] = useState<ReferenceCategory | null>(null)
  const [referenceLibraryOpen, setReferenceLibraryOpen] = useState(false)
  const [adminEditor, setAdminEditor] = useState<'lesson' | 'program' | 'catechist' | null>(null)
  const [adminEditingLabel, setAdminEditingLabel] = useState<string | null>(null)
  const [editingCatechist, setEditingCatechist] = useState<Catechist>({ name: '', email: '', phone: '', homeroomClass: '', accompanyingClass: '', status: 'Còn hoạt động' })
  const [editingContent, setEditingContent] = useState({ title: '', description: '', content: '' })
  const [editingLessonFields, setEditingLessonFields] = useState<LessonStructuredContent>(() => createEmptyLessonStructuredContent())
  const [editingLessonTag, setEditingLessonTag] = useState('')
  const [editingLessonId, setEditingLessonId] = useState('')
  const [editingLessonTime, setEditingLessonTime] = useState('45 phút')
  const [editingLevel, setEditingLevel] = useState(lessonPlans[0].level)
  const [editingSublevel, setEditingSublevel] = useState('')
  const [editingSchedule, setEditingSchedule] = useState<ProgramScheduleRow[]>(programSchedule.map((row) => ({ ...row })))
  const [editingScheduleColumns, setEditingScheduleColumns] = useState<ProgramScheduleColumn[]>(defaultProgramScheduleColumns.map((column) => ({ ...column })))
  const [lessonList, setLessonList] = useState<Lesson[]>(lessonCatalog.map((lesson) => ({ ...lesson, content: lesson.content ?? lesson.excerpt })))
  const [programList, setProgramList] = useState<Program[]>(programs)
  const [adminNotice, setAdminNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [catechistList, setCatechistList] = useState<Catechist[]>(catechists)
  const [accountList, setAccountList] = useState<SystemAccount[]>(systemAccounts)
  const [lessonQuery, setLessonQuery] = useState('')
  const [referenceQuery, setReferenceQuery] = useState('')
  const [referenceList, setReferenceList] = useState<ReferenceDocument[]>([])
  const [catechistQuery, setCatechistQuery] = useState('')
  const lessonsInBrowser = lessonBrowser
    ? lessonList.filter((lesson) => lesson.level === lessonBrowser.level)
    : []
  const matchingLessons = lessonList.filter((lesson) =>
    `${lesson.title} ${lesson.excerpt} ${lesson.content} ${lesson.level ?? ''}`
      .toLocaleLowerCase('vi')
      .includes(lessonQuery.trim().toLocaleLowerCase('vi')),
  )
  const matchingCatechists = catechistList.filter((catechist) =>
    `${catechist.name} ${catechist.email} ${catechist.phone} ${catechist.homeroomClass} ${catechist.accompanyingClass} ${catechist.status}`
      .toLocaleLowerCase('vi')
      .includes(catechistQuery.trim().toLocaleLowerCase('vi')),
  )
  const editingIndustry = lessonPlans.find((plan) => plan.level === editingLevel)
  const selectedLessonForReading = lessonList.find((lesson) => lesson.id === selectedLessonId)
  const selectedReferenceForReading = referenceList.find((reference) => reference.id === selectedReferenceId)
  const selectedProgramForReading = programList.find((program) => program.id === selectedProgramId)
  const dashboardMetrics = getDashboardMetrics(lessonList)

  useEffect(() => {
    const savedUser = sessionStorage.getItem('giao-ly-user')
    if (savedUser === 'reader' || savedUser === 'editor' || savedUser === 'admin') setCurrentUser(savedUser)
    if (savedUser === 'user') setCurrentUser('reader')
    setAuthReady(true)
  }, [])

  useEffect(() => {
    const syncSelectionFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      setSelectedLessonId(initialView === 'lessons' ? params.get('lessonId') : null)
      setSelectedProgramId(initialView === 'programs' ? params.get('programId') : null)
      setSelectedReferenceId(initialView === 'lessons' ? params.get('referenceId') : null)
      setReferenceLibraryOpen(initialView === 'lessons' && params.has('referenceCategory'))
      const category = initialView === 'lessons' ? params.get('referenceCategory') : null
      setSelectedReferenceCategory(category === 'Sinh hoạt' || category === 'Kỹ năng' ? category : null)
      setSelectedProgramLevel(params.get('programLevel'))
      setSelectedProgramSublevel(params.get('programSublevel'))
    }
    syncSelectionFromUrl()
    window.addEventListener('popstate', syncSelectionFromUrl)
    return () => window.removeEventListener('popstate', syncSelectionFromUrl)
  }, [initialView])

  const navigateTo = (path: string) => {
    window.location.href = path
  }

  const scrollTo = (id: string, nav: string) => {
    setActiveNav(nav)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenu(false)
  }

  const openProgram = (program: Program) => {
    const url = new URL(window.location.href)
    url.searchParams.set('programId', program.id)
    url.searchParams.delete('lessonId')
    window.history.pushState({}, '', url)
    setSelectedProgramId(program.id)
    setSelectedLessonId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectProgramLevel = (level: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('programLevel', level)
    url.searchParams.delete('programSublevel')
    url.searchParams.delete('programId')
    window.history.pushState({}, '', url)
    setSelectedProgramLevel(level)
    setSelectedProgramSublevel(null)
    setSelectedProgramId(null)
  }

  const selectProgramSublevel = (sublevel: string) => {
    if (!selectedProgramLevel) return
    const url = new URL(window.location.href)
    url.searchParams.set('programLevel', selectedProgramLevel)
    url.searchParams.set('programSublevel', sublevel)
    url.searchParams.delete('programId')
    window.history.pushState({}, '', url)
    setSelectedProgramSublevel(sublevel)
    setSelectedProgramId(null)
  }

  const backProgramDirectory = (target: 'industries' | 'sublevels') => {
    const url = new URL(window.location.href)
    url.searchParams.delete('programId')
    if (target === 'industries') {
      url.searchParams.delete('programLevel')
      url.searchParams.delete('programSublevel')
      setSelectedProgramLevel(null)
      setSelectedProgramSublevel(null)
    } else {
      url.searchParams.delete('programSublevel')
      setSelectedProgramSublevel(null)
    }
    window.history.pushState({}, '', url)
    setSelectedProgramId(null)
  }

  const openLesson = (lesson: Lesson) => {
    const url = new URL(window.location.href)
    url.searchParams.set('lessonId', lesson.id)
    url.searchParams.delete('programId')
    window.history.pushState({}, '', url)
    setSelectedLessonId(lesson.id)
    setSelectedProgramId(null)
    setLessonBrowser(null)
  }

  const openReferenceLibrary = () => {
    const url = new URL('/lesson-plans', window.location.origin)
    url.searchParams.set('referenceCategory', 'all')
    window.location.href = url.toString()
  }

  const selectReferenceCategory = (category: ReferenceCategory | null) => {
    const url = new URL(window.location.href)
    url.searchParams.delete('referenceId')
    if (category) url.searchParams.set('referenceCategory', category)
    else url.searchParams.set('referenceCategory', 'all')
    window.history.pushState({}, '', url)
    setReferenceLibraryOpen(true)
    setSelectedReferenceId(null)
    setSelectedReferenceCategory(category)
  }

  const openReference = (reference: ReferenceDocument) => {
    const url = new URL(window.location.href)
    url.searchParams.set('referenceCategory', reference.category)
    url.searchParams.set('referenceId', reference.id)
    url.searchParams.delete('lessonId')
    window.history.pushState({}, '', url)
    setReferenceLibraryOpen(true)
    setSelectedReferenceCategory(reference.category)
    setSelectedReferenceId(reference.id)
    setSelectedLessonId(null)
  }

  const returnToReferenceDirectory = (backToLibrary = false) => {
    const url = new URL(window.location.href)
    url.searchParams.delete('referenceId')
    if (!backToLibrary) url.searchParams.delete('referenceCategory')
    else url.searchParams.set('referenceCategory', 'all')
    window.history.pushState({}, '', url)
    setReferenceLibraryOpen(backToLibrary)
    setSelectedReferenceId(null)
    setSelectedReferenceCategory(null)
  }

  const backToReferenceList = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('referenceId')
    window.history.pushState({}, '', url)
    setReferenceLibraryOpen(true)
    setSelectedReferenceId(null)
  }

  const createReference = (category: ReferenceCategory) => {
    const reference: ReferenceDocument = {
      id: `reference-${Date.now()}`,
      title: '',
      category,
      status: 'ACTIVE',
      draft: { content: '{"type":"doc","content":[{"type":"paragraph"}]}', version: 1 },
    }
    setReferenceList((items) => [...items, reference])
    openReference(reference)
  }

  const saveReferenceDraft = (reference: ReferenceDocument) => {
    setReferenceList((items) => items.map((item) => item.id === reference.id ? reference : item))
    setAdminNotice({ type: 'success', text: 'Đã lưu bản nháp tài liệu tham khảo.' })
  }

  const publishReference = (reference: ReferenceDocument) => {
    const draft = reference.draft
    if (!draft || !reference.title.trim()) {
      setAdminNotice({ type: 'error', text: 'Hãy nhập tiêu đề và lưu nội dung trước khi xuất bản.' })
      return
    }
    setReferenceList((items) => items.map((item) => item.id === reference.id
      ? { id: item.id, title: reference.title, category: reference.category, status: 'ACTIVE', published: draft }
      : item))
    setAdminNotice({ type: 'success', text: 'Đã xuất bản tài liệu tham khảo và xóa bản nháp.' })
  }

  const deleteReference = (reference: ReferenceDocument) => {
    setReferenceList((items) => items.map((item) => item.id === reference.id ? { ...item, status: 'DELETED' } : item))
    setAdminNotice({ type: 'success', text: 'Đã chuyển tài liệu tham khảo vào mục đã xóa trong 10 ngày.' })
    returnToReferenceDirectory(true)
  }

  const restoreReference = (reference: ReferenceDocument) => {
    setReferenceList((items) => items.map((item) => item.id === reference.id ? { ...item, status: 'ACTIVE' } : item))
    setAdminNotice({ type: 'success', text: 'Đã khôi phục tài liệu tham khảo.' })
  }

  const returnToList = (parameter: 'lessonId' | 'programId') => {
    const url = new URL(window.location.href)
    url.searchParams.delete(parameter)
    window.history.replaceState({}, '', url)
    if (parameter === 'lessonId') setSelectedLessonId(null)
    else setSelectedProgramId(null)
  }

  const handleAuth = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    if ((authEmail === 'user@gmail.com' || authEmail === 'reader@gmail.com') && authPassword === '123') {
      sessionStorage.setItem('giao-ly-user', 'reader')
      setCurrentUser('reader')
      return
    }
    if (authEmail === 'editor@gmail.com' && authPassword === '123') {
      sessionStorage.setItem('giao-ly-user', 'editor')
      setCurrentUser('editor')
      return
    }
    if (authEmail === 'admin@gmail.com' && authPassword === '123') {
      sessionStorage.setItem('giao-ly-user', 'admin')
      setCurrentUser('admin')
      return
    }
    setAuthError('Email hoặc mật khẩu chưa đúng. Hãy thử tài khoản demo được hướng dẫn bên dưới.')
  }

  const closeAdminEditor = () => {
    setAdminEditor(null)
    setAdminEditingLabel(null)
  }

  const handleDeleteAdminEditor = () => {
    if (adminEditor === 'catechist' && adminEditingLabel) {
      setCatechistList((items) => items.filter((item) => item.name !== adminEditingLabel))
    }
    setAdminNotice({
      type: 'success',
      text: `Đã xóa ${adminEditor === 'lesson' ? 'bài giáo án' : adminEditor === 'program' ? 'chương trình học' : 'giáo lý viên'} khỏi danh sách.`,
    })
    closeAdminEditor()
  }

  const handleSaveAdminEditor = () => {
    if (adminEditor === 'lesson') {
      setLessonList((items) =>
        adminEditingLabel
          ? items.map((item) =>
            item.title === adminEditingLabel
              ? {
                ...item,
                title: editingContent.title,
                excerpt: editingContent.description,
                content: editingContent.content,
                level: editingLevel,
              }
              : item,
          )
          : [
            ...items,
            createLessonFromDraft({
              id: editingLessonId || `lesson-${Date.now()}`,
              title: editingContent.title,
              excerpt: editingContent.description,
              tag: editingLessonTag || `BÀI ${String(items.length + 1).padStart(2, '0')}`,
              time: editingLessonTime,
              level: editingLevel,
              ...editingLessonFields,
            }),
          ],
      )
    }
    if (adminEditor === 'program') {
      setProgramList((items) =>
        adminEditingLabel
          ? items.map((item) =>
            item.title === adminEditingLabel
              ? {
                ...item,
                title: editingContent.title,
                desc: editingContent.description,
                level: editingLevel,
                color: lessonPlans.find((plan) => plan.level === editingLevel)?.color ?? lessonPlans[0].color,
                sublevel: editingSublevel || undefined,
                scheduleColumns: editingScheduleColumns,
                schedule: editingSchedule.filter((row) => Object.values(row.values).some((cell) => cell.trim())),
              }
              : item,
          )
          : [
            ...items,
            {
              id: `program-${Date.now()}`,
              title: editingContent.title,
              desc: editingContent.description,
              progress: 0,
              lessons: '0 bài học',
              color: lessonPlans.find((plan) => plan.level === editingLevel)?.color ?? lessonPlans[0].color,
              level: editingLevel,
              sublevel: editingSublevel || undefined,
              scheduleColumns: editingScheduleColumns,
              schedule: editingSchedule.filter((row) => Object.values(row.values).some((cell) => cell.trim())),
            },
          ],
      )
    }
    if (adminEditor === 'catechist') {
      setCatechistList((items) =>
        adminEditingLabel
          ? items.map((item) =>
            item.name === adminEditingLabel ? { ...item, ...editingCatechist } : item,
          )
          : [...items, editingCatechist],
      )
    }
    setAdminNotice({
      type: 'success',
      text: `${adminEditingLabel ? 'Đã cập nhật' : 'Đã thêm'} ${adminEditor === 'lesson' ? 'bài giáo án' : adminEditor === 'program' ? 'chương trình học' : 'giáo lý viên'} thành công.`,
    })
    closeAdminEditor()
  }

  if (!authReady || !currentUser) {
    return (
      <main className="auth-shell">
        <div className="auth-art" aria-hidden="true">
          <img src="/images/auth-church-group.png" alt="Cộng đoàn giáo lý viên trước nhà thờ" />
          <div className="auth-art-overlay" />
        </div>
        <section className="auth-panel">
          <div className="auth-brand">
            <Image
              className="parish-logo-image auth-parish-logo"
              src="/images/logo-thieu-nhi.jpg"
              alt="Logo Đoàn Thiếu nhi Thánh Thể Giáo xứ Thái An"
              width={56}
              height={56}
            />
            <span><strong>Giáo lý</strong><small>Giáo phận Việt Nam</small></span>
          </div>
          <div className="auth-copy">
            <span className="section-kicker">Kho tài liệu giáo lý Công giáo</span>
            <h1>Cùng nhau lớn lên<br /><em>trong đức tin</em></h1>
            <p>Nơi giáo lý viên tìm thấy những bài học, chương trình và cảm hứng để đồng hành cùng các em.</p>
          </div>
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="auth-heading">
              <span className="section-kicker">Chào mừng trở lại</span>
              <h2>Đăng nhập tài khoản</h2>
            </div>
            <label>
              Email
              <input required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="user@gmail.com" />
            </label>
            <label>
              Mật khẩu
              <input required type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="123" />
            </label>
            {authError && <p className="auth-error">{authError}</p>}
            <button className="primary-button full" type="submit">
              Vào trang tổng quan <ArrowRight size={17} />
            </button>
          </form>
          <div className="demo-accounts">
            <strong>Tài khoản xem thử</strong>
            <span><b>Reader</b> user@gmail.com · 123</span>
            <span><b>Editor</b> editor@gmail.com · 123</span>
            <span><b>Admin</b> admin@gmail.com · 123</span>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={`site-shell view-${initialView}`}>
      <SiteHeader
        activeNav={activeNav}
        mobileMenu={mobileMenu}
        currentUser={currentUser}
        onNavigate={navigateTo}
        onLogout={() => {
          sessionStorage.removeItem("giao-ly-user");
          setCurrentUser(null);
          navigateTo("/");
        }}
        onToggleMenu={() => setMobileMenu(!mobileMenu)}
      />

      <HeroSection onNavigate={navigateTo} />
      <StatsStrip
        lessonCount={dashboardMetrics.lessonCount}
        industryCount={dashboardMetrics.industryCount}
        canManage={currentUser === 'admin' || currentUser === 'editor'}
      />

      {!(initialView === 'lessons' && (selectedLessonId || referenceLibraryOpen)) && <LessonDirectory
        canManage={currentUser === 'admin' || currentUser === 'editor'}
        industries={lessonPlans}
        lessons={lessonList}
        query={lessonQuery}
        onQueryChange={setLessonQuery}
        onAdd={() => {
          setAdminEditingLabel(null);
          setEditingContent({ title: "", description: "", content: "" });
          setEditingLevel(lessonPlans[0].level);
          setEditingLessonFields(createEmptyLessonStructuredContent(defaultLessonScripture, defaultLessonScriptureReference))
          setEditingLessonId(`draft-lesson-${Date.now()}`)
          setEditingLessonTag(`BÀI ${String(lessonList.length + 1).padStart(2, '0')}`)
          setEditingLessonTime('45 phút')
          setAdminEditor("lesson");
        }}
        onOpenIndustry={(industry) =>
          setLessonBrowser({ level: industry.level, subtitle: industry.subtitle })
        }
        onOpenLesson={openLesson}
        onOpenReferences={openReferenceLibrary}
      />}

      {initialView === 'lessons' && referenceLibraryOpen && !selectedReferenceId && <ReferenceDirectory
        references={referenceList}
        category={selectedReferenceCategory}
        query={referenceQuery}
        canManage={currentUser === 'admin' || currentUser === 'editor'}
        onBack={() => returnToReferenceDirectory(false)}
        onCategoryChange={selectReferenceCategory}
        onQueryChange={setReferenceQuery}
        onOpenReference={openReference}
        onCreate={createReference}
      />}

      {!(initialView === 'programs' && selectedProgramId) && <ProgramDirectory
        canManage={currentUser === 'admin' || currentUser === 'editor'}
        industries={lessonPlans}
        programs={programList}
        selectedLevel={selectedProgramLevel}
        selectedSublevel={selectedProgramSublevel}
        onSelectLevel={selectProgramLevel}
        onSelectSublevel={selectProgramSublevel}
        onBack={backProgramDirectory}
        onAdd={(level, sublevel) => {
          setAdminEditingLabel(null);
          setEditingContent({ title: "", description: "", content: "" });
          const industry = lessonPlans.find((plan) => plan.level === level) ?? lessonPlans[0];
          setEditingLevel(industry.level);
          setEditingSublevel(sublevel ?? industry.sublevels[0] ?? "");
          setEditingSchedule([createEmptyProgramScheduleRow()]);
          setEditingScheduleColumns(defaultProgramScheduleColumns.map((column) => ({ ...column })))
          setAdminEditor("program");
        }}
        onOpen={openProgram}
        onDelete={(program) => {
          setProgramList((items) =>
            items.filter((item) => item.title !== program.title),
          );
          setAdminNotice({ type: "success", text: `Đã xóa ${program.title}.` });
        }}
      />}

      {initialView === 'lessons' && selectedLessonId && (
        selectedLessonForReading ? <LessonReadingPage
          lesson={selectedLessonForReading}
          canManage={currentUser === 'admin' || currentUser === 'editor'}
          onBack={() => returnToList('lessonId')}
          onSave={(updated) => {
            setLessonList((items) => items.map((item) => item.id === updated.id ? updated : item))
            setAdminNotice({ type: 'success', text: 'Đã cập nhật bài giáo án.' })
          }}
          onDelete={(lesson) => {
            setLessonList((items) => items.filter((item) => item.id !== lesson.id))
            returnToList('lessonId')
            setAdminNotice({ type: 'success', text: 'Đã xóa giáo án.' })
          }}
        /> : <section className="content-section reading-page-placeholder">
          <button className="secondary-button" onClick={() => returnToList('lessonId')}>Quay lại danh sách bài học</button>
          <h1>Không tìm thấy giáo án này</h1>
        </section>
      )}

      {initialView === 'lessons' && selectedReferenceId && (
        selectedReferenceForReading && ((currentUser === 'admin' || currentUser === 'editor') || (selectedReferenceForReading.status === 'ACTIVE' && selectedReferenceForReading.published))
          ? <ReferenceReadingPage
            reference={selectedReferenceForReading}
            canManage={currentUser === 'admin' || currentUser === 'editor'}
            onBack={backToReferenceList}
            onSaveDraft={saveReferenceDraft}
            onPublish={publishReference}
            onDelete={deleteReference}
            onRestore={restoreReference}
          />
          : <section className="reference-reading-page reading-page-placeholder">
            <button className="secondary-button" onClick={backToReferenceList}>Quay lại thư viện tài liệu</button>
            <h1>Không tìm thấy tài liệu tham khảo</h1>
          </section>
      )}
      {initialView === 'programs' && selectedProgramId && (
        selectedProgramForReading ? <ProgramReadingPage
          program={selectedProgramForReading}
          canManage={currentUser === 'admin' || currentUser === 'editor'}
          onBack={() => returnToList('programId')}
          onSave={(updated) => {
            setProgramList((items) => items.map((item) => item.id === updated.id ? updated : item))
            setAdminNotice({ type: 'success', text: 'Đã cập nhật chương trình học.' })
          }}
          onDelete={(program) => {
            setProgramList((items) => items.filter((item) => item.id !== program.id))
            returnToList('programId')
            setAdminNotice({ type: 'success', text: `Đã xóa ${program.title}.` })
          }}
        /> : <section className="program-section reading-page-placeholder">
          <div className="program-inner">
            <button className="outline-button light-button" onClick={() => returnToList('programId')}>Quay lại chương trình học</button>
            <h1>Không tìm thấy chương trình học này</h1>
          </div>
        </section>
      )}

      {initialView === "catechists" && (
        <CatechistDirectory
          canManage={currentUser === 'admin' || currentUser === 'editor'}
          catechists={matchingCatechists}
          query={catechistQuery}
          onQueryChange={setCatechistQuery}
          onAdd={() => {
            setAdminEditingLabel(null);
            setEditingCatechist({
              name: "",
              email: "",
              phone: "",
              homeroomClass: "",
              accompanyingClass: "",
              status: "Còn hoạt động",
            });
            setAdminEditor("catechist");
          }}
          onEdit={(catechist) => {
            setAdminEditingLabel(catechist.name);
            setEditingCatechist(catechist);
            setAdminEditor("catechist");
          }}
          onDelete={(catechist) => {
            setCatechistList((items) =>
              items.filter((item) => item.email !== catechist.email),
            );
            setAdminNotice({
              type: "success",
              text: `Đã xóa giáo lý viên ${catechist.name}.`,
            });
          }}
        />
      )}

      {initialView === 'accounts' && currentUser === 'admin' && (
        <SystemAccountDirectory
          accounts={accountList}
          catechists={catechistList}
          onCreate={(account) => {
            setAccountList((items) => [
              ...items,
              {
                id: `account-${Date.now()}`,
                email: account.email.trim(),
                role: account.role,
                linkedCatechistEmail: account.role === 'editor' ? account.linkedCatechistEmail : undefined,
                status: 'Hoạt động',
                createdAt: new Intl.DateTimeFormat('vi-VN').format(new Date()),
              },
            ])
            setAdminNotice({ type: 'success', text: 'Đã cấp tài khoản mới. Mật khẩu không được hiển thị lại.' })
          }}
          onResetPassword={(account) => setAdminNotice({ type: 'success', text: `Đã đặt lại mật khẩu cho ${account.email}.` })}
          onUpdateStatus={(account, status: AccountStatus) => {
            setAccountList((items) => items.map((item) => item.id === account.id ? { ...item, status } : item))
            setAdminNotice({ type: 'success', text: status === 'Đã lưu trữ' ? `Đã lưu trữ ${account.email} trong 10 ngày.` : `Đã cập nhật trạng thái ${account.email}.` })
          }}
          onUpdateLink={(account, linkedCatechistEmail) => {
            setAccountList((items) => items.map((item) => item.id === account.id ? { ...item, linkedCatechistEmail } : item))
            setAdminNotice({ type: 'success', text: `Đã cập nhật hồ sơ liên kết cho ${account.email}.` })
          }}
        />
      )}

      {initialView === 'accounts' && currentUser !== 'admin' && (
        <section className="accounts-access-denied">
          <span className="section-kicker">Khu vực quản trị</span>
          <h1>Bạn không có quyền truy cập khu vực này</h1>
          <p>Chỉ tài khoản Admin mới có thể cấp và quản lý tài khoản hệ thống.</p>
          <button className="primary-button" onClick={() => navigateTo('/dashboard')}>Về trang tổng quan</button>
        </section>
      )}

      <footer>
        <div className="footer-brand">
          <span className="brand-mark">
            <Church size={18} />
          </span>
          <span>
            <strong>Giáo Phận Xuân Lộc</strong>
            <small>Giáo xứ Thái An</small>
          </span>
        </div>
        <p>
          Góp phần xây dựng một thế hệ trẻ sống đức tin và yêu mến Giáo Hội.
        </p>
        <span className="footer-copy">© 2025 Giáo lý Công giáo</span>
      </footer>

      <LessonDialogs
        browser={lessonBrowser}
        lessons={lessonsInBrowser}
        onCloseBrowser={() => setLessonBrowser(null)}
        onSelectLesson={openLesson}
      />
      <AdminEditorDialog
        editor={adminEditor}
        editingLabel={adminEditingLabel}
        catechist={editingCatechist}
        content={editingContent}
        level={editingLevel}
        sublevel={editingSublevel}
        industry={editingIndustry}
        schedule={editingSchedule}
        scheduleColumns={editingScheduleColumns}
        lessonTag={editingLessonTag}
        lessonTime={editingLessonTime}
        lessonFields={editingLessonFields}
            lessonId={editingLessonId}
        onTitleChange={(title) => setEditingContent((current) => ({ ...current, title }))}
        onCatechistChange={setEditingCatechist}
        onContentChange={setEditingContent}
        onLessonTagChange={setEditingLessonTag}
        onLessonTimeChange={setEditingLessonTime}
        onLessonFieldsChange={setEditingLessonFields}
        onLevelChange={(level) => {
          const industry = lessonPlans.find((item) => item.level === level)
          setEditingLevel(level)
          setEditingSublevel(industry?.sublevels[0] ?? "")
        }}
        onSublevelChange={setEditingSublevel}
        onScheduleChange={setEditingSchedule}
        onScheduleColumnsChange={setEditingScheduleColumns}
        onClose={closeAdminEditor}
        onDelete={handleDeleteAdminEditor}
        onSave={handleSaveAdminEditor}
      />
      {adminNotice && (
        <div className={`admin-toast ${adminNotice.type}`} role="status">
          <strong>
            {adminNotice.type === "success"
              ? "Thành công"
              : "Không thể cập nhật"}
          </strong>
          <span>{adminNotice.text}</span>
          <button
            onClick={() => setAdminNotice(null)}
            aria-label="Đóng thông báo"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
