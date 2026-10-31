'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileText,
  Heart,
  LayoutDashboard,
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
import { SiteFooter } from '../components/site-footer'
import { SessionRestoringShell } from '../components/session-restoring-shell'
import { usePersonalProfile } from '../components/personal-profile-provider'
import { canLeaveCurrentPage, guardHistoryNavigation } from '../lib/unsaved-work'
import { HeroSection } from '../components/hero-section'
import { StatsStrip } from '../components/stats-strip'
import { AuthScreen } from '../components/auth-screen'
import { useAuth, useUnauthorizedHandler } from '../components/auth-provider'
import { getPublicConfig } from '../lib/config'
import { createUsersApi } from '../lib/api/users'
import { createAccountManagement } from '../lib/api/account-management'
import { createContentApi } from '../lib/api/content'
import { createContentManagement } from '../lib/api/content-management'
import {
  createEmptyProgramScheduleRow,
  defaultProgramScheduleColumns,
  lessonPlans,
  type AccountStatus,
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
import { getPageDataPlan } from '../lib/page-data-plan'
import type { ReferenceCategory, ReferenceDocument } from '../lib/reference-content'

const loadingContent = () => <div className="content-section"><ReadingPending message="Đang mở nội dung…" /></div>
const LessonDirectory = dynamic(() => import('../components/lesson-directory').then((module) => module.LessonDirectory), { loading: loadingContent })
const ProgramDirectory = dynamic(() => import('../components/program-directory').then((module) => module.ProgramDirectory), { loading: loadingContent })
const CatechistDirectory = dynamic(() => import('../components/catechist-directory').then((module) => module.CatechistDirectory), { loading: loadingContent })
const ReferenceDirectory = dynamic(() => import('../components/reference-directory').then((module) => module.ReferenceDirectory), { loading: loadingContent })
const SystemAccountDirectory = dynamic(() => import('../components/system-account-directory').then((module) => module.SystemAccountDirectory), { loading: loadingContent })
const LessonWithNotes = dynamic(() => import('../components/lesson-with-notes').then((module) => module.LessonWithNotes), { loading: loadingContent })
const ProgramReadingPage = dynamic(() => import('../components/program-reading-page').then((module) => module.ProgramReadingPage), { loading: loadingContent })
const ReferenceReadingPage = dynamic(() => import('../components/reference-reading-page').then((module) => module.ReferenceReadingPage), { loading: loadingContent })
const LessonDialogs = dynamic(() => import('../components/lesson-dialogs').then((module) => module.LessonDialogs), { loading: loadingContent })
const AdminEditorDialog = dynamic(() => import('../components/admin-editor-dialog').then((module) => module.AdminEditorDialog), {
  loading: () => <div className="admin-toast" role="status">Đang mở biểu mẫu…</div>,
})

function ReadingPending({ message }: { message: string }) {
  return <div className="reading-pending-skeleton" aria-busy="true">
    <span className="sr-only" role="status">{message}</span>
    <span className="session-skeleton reading-pending-title" aria-hidden="true" />
    <span className="session-skeleton reading-pending-line" aria-hidden="true" />
    <span className="session-skeleton reading-pending-line reading-pending-line-short" aria-hidden="true" />
    <span className="session-skeleton reading-pending-block" aria-hidden="true" />
  </div>
}

export default function Page({ initialView = 'overview' }: { initialView?: 'overview' | 'lessons' | 'programs' | 'catechists' | 'accounts' }) {
  const { status, user, logout, getAccessToken } = useAuth()
  const personal = usePersonalProfile()
  const onUnauthorized = useUnauthorizedHandler()
  const accountService = useMemo(() => status === 'authenticated' && !user?.localMock ? createAccountManagement(createUsersApi({
    config: getPublicConfig(), getAccessToken, onUnauthorized,
  })) : null, [status, getAccessToken, onUnauthorized])
  const contentService = useMemo(() => status === 'authenticated' && user && !user.localMock ? createContentManagement(createContentApi({
    config: getPublicConfig(), getAccessToken, onUnauthorized,
  }), user.role === 'admin' || user.role === 'editor') : null, [status, user?.sub, user?.role, user?.localMock, getAccessToken, onUnauthorized])
  const [contentLoading, setContentLoading] = useState(true)
  const [contentError, setContentError] = useState('')
  const [contentReload, setContentReload] = useState(0)
  const [referencesLoading, setReferencesLoading] = useState(false)
  const [referencesError, setReferencesError] = useState('')
  const [referencesReload, setReferencesReload] = useState(0)
  const [contentBusy, setContentBusy] = useState(false)
  const contentInFlight = useRef(false)
  const mediaUploadsInFlight = useRef(0)
  const [mediaUploads, setMediaUploads] = useState(0)
  const onUploadStateChange = useCallback((uploading: boolean) => {
    mediaUploadsInFlight.current = Math.max(0, mediaUploadsInFlight.current + (uploading ? 1 : -1))
    setMediaUploads(mediaUploadsInFlight.current)
  }, [])
  const [detailReady, setDetailReady] = useState('')
  const [detailError, setDetailError] = useState('')
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState('')
  const [accountsReload, setAccountsReload] = useState(0)
  const [activeNav, setActiveNav] = useState(initialView === 'lessons' ? 'Giáo án' : initialView === 'programs' ? 'Chương trình học' : initialView === 'catechists' ? 'Giáo lý viên' : initialView === 'accounts' ? 'Tài khoản hệ thống' : 'Tổng quan')
  const [mobileMenu, setMobileMenu] = useState(false)
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
  const [editingSchedule, setEditingSchedule] = useState<ProgramScheduleRow[]>([])
  const [editingScheduleColumns, setEditingScheduleColumns] = useState<ProgramScheduleColumn[]>(defaultProgramScheduleColumns.map((column) => ({ ...column })))
  const [lessonList, setLessonList] = useState<Lesson[]>([])
  const [programList, setProgramList] = useState<Program[]>([])
  const [adminNotice, setAdminNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [catechistList, setCatechistList] = useState<Catechist[]>([])
  useEffect(() => {
    const profile = personal.me?.profile
    if (profile) setCatechistList((items) => items.map((item) => item.id === profile.catechistId ? { ...item, email: profile.email, phone: profile.phone, homeroomClass: profile.group, accompanyingClass: profile.accompanyingClass ?? '', version: profile.version } : item))
  }, [personal.me])
  const [catechistsLoading, setCatechistsLoading] = useState(true)
  const [catechistsError, setCatechistsError] = useState('')
  const [catechistsReload, setCatechistsReload] = useState(0)
  const [accountList, setAccountList] = useState<SystemAccount[]>([])
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
  const primaryCatalog = getPageDataPlan(initialView, referenceLibraryOpen, selectedReferenceId, selectedLessonId, selectedProgramId).primaryCatalog
  const loadReferences = getPageDataPlan(initialView, referenceLibraryOpen, selectedReferenceId).loadReferences

  useEffect(() => {
    let active = true
    setDetailReady(''); setContentError('')
    if (!contentService || !primaryCatalog) {
      setContentLoading(false)
      return () => { active = false }
    }
    if (primaryCatalog === 'lessons') setProgramList([])
    else setLessonList([])
    setContentLoading(true)
    void (async () => {
      try {
        if (primaryCatalog === 'lessons') {
          const lessons = await contentService.lessons.list()
          if (active) setLessonList(lessons)
        } else {
          const programs = await contentService.programs.list()
          if (active) setProgramList(programs)
        }
      } catch (error) {
        if (active) setContentError(error instanceof Error ? error.message : `Không tải được ${primaryCatalog === 'lessons' ? 'giáo án' : 'chương trình học'}.`)
      } finally {
        if (active) setContentLoading(false)
      }
    })()
    return () => { active = false }
  }, [contentService, primaryCatalog, contentReload])

  useEffect(() => {
    let active = true
    setReferencesError('')
    if (!contentService || !loadReferences) {
      setReferencesLoading(false)
      if (!loadReferences && !selectedReferenceId) setReferenceList([])
      return () => { active = false }
    }
    setReferenceList([])
    setReferencesLoading(true)
    void contentService.references.list().then((references) => {
      if (active) setReferenceList(references)
    }).catch((error) => {
      if (active) setReferencesError(error instanceof Error ? error.message : 'Không tải được tài liệu tham khảo.')
    }).finally(() => {
      if (active) setReferencesLoading(false)
    })
    return () => { active = false }
  }, [contentService, loadReferences, selectedReferenceId, referencesReload])

  const selectedDetailKey = initialView === 'lessons'
    ? selectedReferenceId ? `references/${selectedReferenceId}` : selectedLessonId ? `lessons/${selectedLessonId}` : ''
    : initialView === 'programs' && selectedProgramId ? `programs/${selectedProgramId}` : ''
  const selectedReferenceDeleted = selectedReferenceForReading?.status === 'DELETED'
  const detailCatalogLoading = (selectedDetailKey.startsWith('lessons/') && primaryCatalog === 'lessons')
    || (selectedDetailKey.startsWith('programs/') && primaryCatalog === 'programs')
      ? contentLoading
      : false
  const detailCatalogError = selectedDetailKey.startsWith('references/') ? referencesError : contentError
  useEffect(() => {
    if (!contentService || detailCatalogLoading || detailCatalogError || !selectedDetailKey || detailReady === selectedDetailKey) return
    let active = true
    setDetailError('')
    if (selectedReferenceId?.startsWith('new-reference-') || selectedReferenceDeleted) {
      setDetailReady(selectedDetailKey)
      return
    }
    void (async () => {
      try {
        if (selectedDetailKey.startsWith('lessons/')) {
          const item = await contentService.lessons.get(selectedLessonId!)
          if (active) setLessonList((items) => [...items.filter((row) => row.id !== item.id), item])
        } else if (selectedDetailKey.startsWith('programs/')) {
          const item = await contentService.programs.get(selectedProgramId!)
          if (active) setProgramList((items) => [...items.filter((row) => row.id !== item.id), item])
        } else {
          const item = await contentService.references.get(selectedReferenceId!)
          if (active) setReferenceList((items) => [...items.filter((row) => row.id !== item.id), item])
        }
        if (active) setDetailReady(selectedDetailKey)
      } catch (error) {
        if (active) setDetailError(error instanceof Error ? error.message : 'Không tải được nội dung.')
      }
    })()
    return () => { active = false }
  }, [contentService, detailCatalogLoading, detailCatalogError, selectedDetailKey, selectedLessonId, selectedProgramId, selectedReferenceId, selectedReferenceDeleted, detailReady, contentReload, referencesReload])

  const runContentAction = async (action: () => Promise<void>, message: string): Promise<boolean> => {
    if (contentInFlight.current || !contentService) return false
    if (mediaUploadsInFlight.current) {
      setAdminNotice({ type: 'error', text: 'Hãy đợi ảnh tải lên hoàn tất trước khi lưu.' })
      return false
    }
    contentInFlight.current = true
    setContentBusy(true)
    setAdminNotice(null)
    try {
      await action()
      setAdminNotice({ type: 'success', text: message })
      return true
    } catch (error) {
      setAdminNotice({ type: 'error', text: error instanceof Error ? error.message : 'Không thể lưu nội dung. Hãy thử lại.' })
      return false
    } finally {
      contentInFlight.current = false
      setContentBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    setCatechistList([])
    setCatechistsError('')
    setCatechistsLoading(true)
    if (initialView !== 'catechists') return
    if (!accountService) {
      setCatechistsLoading(false)
      if (user?.localMock) setCatechistsError('Danh bạ giáo lý viên không khả dụng trong phiên xem thử.')
      return
    }
    void accountService.listProfiles().then((profiles) => {
      if (active) setCatechistList(profiles)
    }).catch((error) => {
      if (active) setCatechistsError(error instanceof Error ? error.message : 'Không tải được danh sách giáo lý viên.')
    }).finally(() => { if (active) setCatechistsLoading(false) })
    return () => { active = false }
  }, [accountService, initialView, user?.sub, user?.role, catechistsReload])

  useEffect(() => {
    if (initialView !== 'accounts' || user?.role !== 'admin') return
    let active = true
    setAccountsLoading(true)
    setAccountsError('')
    setAccountList([])
    setCatechistList([])
    if (!accountService) {
      setAccountsLoading(false)
      if (user?.localMock) setAccountsError('Quản lý tài khoản không khả dụng trong phiên xem thử.')
      return () => { active = false }
    }
    void (async () => {
      try {
        const [profiles, accountRows] = await Promise.all([
          accountService.listProfiles(),
          accountService.listAccounts([]),
        ])
        const accounts = accountRows.map((account) => ({
          ...account,
          linkedCatechistEmail: profiles.find((profile) => profile.id === account.linkedCatechistId)?.email,
        }))
        if (active) {
          setCatechistList(profiles)
          setAccountList(accounts)
        }
      } catch (error) {
        if (active) setAccountsError(error instanceof Error ? error.message : 'Không tải được danh sách tài khoản.')
      } finally {
        if (active) setAccountsLoading(false)
      }
    })()
    return () => { active = false }
  }, [accountService, initialView, user?.sub, user?.role, accountsReload])

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
    return guardHistoryNavigation(syncSelectionFromUrl)
  }, [initialView])

  const navigateTo = (path: string) => {
    if (contentInFlight.current || mediaUploadsInFlight.current) return
    if (!canLeaveCurrentPage()) return
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
      id: `new-reference-${Date.now()}`,
      title: '',
      category,
      status: 'ACTIVE',
      draft: { content: '{"type":"doc","content":[{"type":"paragraph"}]}', version: 1 },
    }
    setReferenceList((items) => [...items, reference])
    openReference(reference)
  }

  const storeReference = (reference: ReferenceDocument, saved: ReferenceDocument) => {
    setReferenceList((items) => [...items.filter((item) => item.id !== reference.id && item.id !== saved.id), saved])
    setDetailReady(`references/${saved.id}`)
    if (saved.id !== reference.id) {
      const url = new URL(window.location.href)
      url.searchParams.set('referenceId', saved.id)
      window.history.replaceState({}, '', url)
      setSelectedReferenceId(saved.id)
    }
  }

  const saveReferenceDraft = (reference: ReferenceDocument) => runContentAction(async () => {
    storeReference(reference, await contentService!.references.save(reference))
  }, 'Đã lưu bản nháp tài liệu tham khảo trên máy chủ.')

  const publishReference = (reference: ReferenceDocument) => runContentAction(async () => {
    const saved = await contentService!.references.save(reference)
    storeReference(reference, saved)
    storeReference(saved, await contentService!.references.publish(saved))
  }, 'Đã xuất bản tài liệu tham khảo.')

  const deleteReference = (reference: ReferenceDocument) => runContentAction(async () => {
    if (reference.version) storeReference(reference, await contentService!.references.archive(reference))
    else setReferenceList((items) => items.filter((item) => item.id !== reference.id))
    returnToReferenceDirectory(true)
  }, 'Đã xóa tài liệu tham khảo.')

  const restoreReference = (reference: ReferenceDocument) => runContentAction(async () => {
    const restored = await contentService!.references.restore(reference)
    storeReference(reference, restored)
    setDetailReady('')
  }, 'Đã khôi phục tài liệu tham khảo.')

  const saveLesson = (lesson: Lesson) => runContentAction(async () => {
    const saved = await contentService!.lessons.save(lesson)
    setLessonList((items) => [...items.filter((item) => item.id !== lesson.id && item.id !== saved.id), saved])
  }, 'Đã lưu bản nháp giáo án trên máy chủ.')

  const publishLesson = (lesson: Lesson) => runContentAction(async () => {
    const saved = await contentService!.lessons.publish(lesson)
    setLessonList((items) => items.map((item) => item.id === saved.id ? saved : item))
  }, 'Đã xuất bản giáo án.')

  const deleteLesson = (lesson: Lesson) => runContentAction(async () => {
    await contentService!.lessons.archive(lesson)
    setLessonList((items) => items.filter((item) => item.id !== lesson.id))
    returnToList('lessonId')
  }, 'Đã lưu trữ giáo án trên máy chủ.')

  const saveProgram = (program: Program) => runContentAction(async () => {
    const saved = await contentService!.programs.save(program)
    setProgramList((items) => [...items.filter((item) => item.id !== program.id && item.id !== saved.id), saved])
  }, 'Đã lưu bản nháp chương trình trên máy chủ.')

  const publishProgram = (program: Program) => runContentAction(async () => {
    const saved = await contentService!.programs.publish(program)
    setProgramList((items) => items.map((item) => item.id === saved.id ? saved : item))
  }, 'Đã xuất bản chương trình học.')

  const deleteProgram = (program: Program) => runContentAction(async () => {
    await contentService!.programs.archive(program)
    setProgramList((items) => items.filter((item) => item.id !== program.id))
    returnToList('programId')
  }, 'Đã lưu trữ chương trình học trên máy chủ.')

  const returnToList = (parameter: 'lessonId' | 'programId') => {
    const url = new URL(window.location.href)
    url.searchParams.delete(parameter)
    window.history.replaceState({}, '', url)
    if (parameter === 'lessonId') setSelectedLessonId(null)
    else setSelectedProgramId(null)
  }

  const closeAdminEditor = () => {
    if (contentInFlight.current) return
    setAdminEditor(null)
    setAdminEditingLabel(null)
  }

  const runProfileAction = async (action: () => Promise<void>, message: string): Promise<boolean> => {
    if (contentInFlight.current || !accountService || !['admin', 'editor'].includes(user?.role ?? '')) return false
    contentInFlight.current = true
    setContentBusy(true)
    setAdminNotice(null)
    try {
      await action()
      setAdminNotice({ type: 'success', text: message })
      return true
    } catch (error) {
      setAdminNotice({ type: 'error', text: error instanceof Error ? error.message : 'Không thể lưu hồ sơ giáo lý viên. Hãy thử lại.' })
      return false
    } finally {
      contentInFlight.current = false
      setContentBusy(false)
    }
  }

  const deleteCatechist = (profile: Catechist) => runProfileAction(async () => {
    await accountService!.archiveProfile(profile)
    setCatechistList((items) => items.filter((item) => item.id !== profile.id))
  }, `Đã lưu trữ giáo lý viên ${profile.name} trên máy chủ.`)

  const handleDeleteAdminEditor = async () => {
    if (adminEditor === 'catechist' && adminEditingLabel) {
      if (await deleteCatechist(editingCatechist)) closeAdminEditor()
      return
    }
    setAdminNotice({
      type: 'success',
      text: `Đã xóa ${adminEditor === 'lesson' ? 'bài giáo án' : adminEditor === 'program' ? 'chương trình học' : 'giáo lý viên'} khỏi danh sách.`,
    })
    closeAdminEditor()
  }

  const handleSaveAdminEditor = async () => {
    if (adminEditor === 'lesson' || adminEditor === 'program') {
      const saved = await runContentAction(async () => {
        if (adminEditor === 'lesson') {
          const lesson = await contentService!.lessons.save({
            ...createLessonFromDraft({ id: '', title: editingContent.title, excerpt: editingContent.description,
              tag: editingLessonTag, time: editingLessonTime, level: editingLevel, ...editingLessonFields }),
            sublevel: editingSublevel,
          })
          setLessonList((items) => [...items.filter((item) => item.id !== lesson.id), lesson])
          if (initialView === 'lessons') {
            setDetailReady(`lessons/${lesson.id}`)
            openLesson(lesson)
          }
        } else {
          const program = await contentService!.programs.save({ id: '', title: editingContent.title,
            desc: editingContent.description, level: editingLevel, sublevel: editingSublevel,
            color: editingIndustry?.color ?? lessonPlans[0].color, progress: 0, lessons: '0 buổi học',
            scheduleColumns: editingScheduleColumns, schedule: editingSchedule,
          })
          setProgramList((items) => [...items.filter((item) => item.id !== program.id), program])
          if (initialView === 'programs') { setDetailReady(`programs/${program.id}`); openProgram(program) }
        }
      }, 'Đã lưu bản nháp trên máy chủ. Bạn có thể chỉnh sửa tiếp hoặc xuất bản.')
      if (saved) closeAdminEditor()
      return
    }
    if (adminEditor === 'catechist') {
      const saved = await runProfileAction(async () => {
        const profile = await accountService!.saveProfile(editingCatechist)
        setCatechistList((items) => [...items.filter((item) => item.id !== profile.id), profile]
          .sort((a, b) => a.name.localeCompare(b.name, 'vi')))
      }, `${adminEditingLabel ? 'Đã cập nhật' : 'Đã thêm'} giáo lý viên trên máy chủ.`)
      if (saved) closeAdminEditor()
      return
    }
  }

  if (status === 'loading') {
    return (
      <SessionRestoringShell
        initialView={initialView}
        activeNav={activeNav}
        mobileMenu={mobileMenu}
        referenceLibraryOpen={referenceLibraryOpen || Boolean(selectedReferenceId)}
        onNavigate={navigateTo}
        onToggleMenu={() => setMobileMenu(!mobileMenu)}
      />
    )
  }

  if (status !== 'authenticated' || !user) return <AuthScreen />

  const currentUser = user.role

  return (
    <main className={`site-shell view-${initialView}`}>
      <SiteHeader
        activeNav={activeNav}
        mobileMenu={mobileMenu}
        currentUser={currentUser}
        onNavigate={navigateTo}
        onLogout={() => { if (!contentInFlight.current && !mediaUploadsInFlight.current && canLeaveCurrentPage()) logout() }}
        onToggleMenu={() => setMobileMenu(!mobileMenu)}
      />
 
      {initialView === 'overview' && <HeroSection onNavigate={navigateTo} />}
      {initialView === 'overview' && <StatsStrip
        lessonCount={dashboardMetrics.lessonCount}
        industryCount={dashboardMetrics.industryCount}
        canManage={currentUser === 'admin' || currentUser === 'editor'}
        loading={initialView === 'overview' && contentLoading}
      />}

      {contentBusy && <p role="status" className="content-section">Đang lưu thay đổi trên máy chủ…</p>}
      {mediaUploads > 0 && <p role="status" className="content-section">Đang tải ảnh lên. Hãy đợi trước khi lưu hoặc rời trang.</p>}

      <fieldset disabled={contentBusy || mediaUploads > 0} inert={contentBusy || mediaUploads > 0} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>

      {initialView === 'lessons' && !selectedLessonId && !selectedReferenceId && !referenceLibraryOpen && <LessonDirectory
        canManage={currentUser === 'admin' || currentUser === 'editor'}
        industries={lessonPlans}
        lessons={lessonList}
        loading={primaryCatalog === 'lessons' && contentLoading}
        loadError={primaryCatalog === 'lessons' ? contentError : ''}
        onRetry={() => setContentReload((value) => value + 1)}
        query={lessonQuery}
        onQueryChange={setLessonQuery}
        onAdd={() => {
          setAdminEditingLabel(null);
          setEditingContent({ title: "", description: "", content: "" });
          setEditingLevel(lessonPlans[0].level);
          setEditingLessonFields(createEmptyLessonStructuredContent())
          setEditingLessonId('')
          setEditingSublevel(lessonPlans[0].sublevels[0] ?? '')
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
        loading={referencesLoading}
        loadError={referencesError}
        onRetry={() => setReferencesReload((value) => value + 1)}
        category={selectedReferenceCategory}
        query={referenceQuery}
        canManage={currentUser === 'admin' || currentUser === 'editor'}
        onBack={() => returnToReferenceDirectory(false)}
        onCategoryChange={selectReferenceCategory}
        onQueryChange={setReferenceQuery}
        onOpenReference={openReference}
        onCreate={createReference}
      />}

      {initialView === 'programs' && !selectedProgramId && <ProgramDirectory
        canManage={currentUser === 'admin' || currentUser === 'editor'}
        industries={lessonPlans}
        programs={programList}
        loading={primaryCatalog === 'programs' && contentLoading}
        loadError={primaryCatalog === 'programs' ? contentError : ''}
        onRetry={() => setContentReload((value) => value + 1)}
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
        onDelete={deleteProgram}
      />}

      {initialView === 'lessons' && selectedLessonId && (
        selectedLessonForReading && detailReady === selectedDetailKey ? <LessonWithNotes key={`${user?.sub}:${selectedLessonId}`}
          lesson={selectedLessonForReading}
          canManage={currentUser === 'admin' || currentUser === 'editor'}
          onBack={() => returnToList('lessonId')}
          busy={contentBusy}
          getAccessToken={getAccessToken}
          onUploadStateChange={onUploadStateChange}
          onSave={saveLesson}
          onPublish={publishLesson}
          onDelete={deleteLesson}
        /> : <section className="content-section reading-page-placeholder">
          <button className="secondary-button" onClick={() => returnToList('lessonId')}>Quay lại danh sách bài học</button>
          {detailError || contentError
            ? <div role="alert"><h1>Không tải được giáo án</h1><p>{detailError || contentError}</p><button className="secondary-button" onClick={() => setContentReload((value) => value + 1)}>Thử tải lại</button></div>
            : <ReadingPending message="Đang tải giáo án…" />}
        </section>
      )}

      {initialView === 'lessons' && selectedReferenceId && (
        selectedReferenceForReading && detailReady === selectedDetailKey && ((currentUser === 'admin' || currentUser === 'editor') || (selectedReferenceForReading.status === 'ACTIVE' && selectedReferenceForReading.published))
          ? <ReferenceReadingPage
            reference={selectedReferenceForReading}
            canManage={currentUser === 'admin' || currentUser === 'editor'}
            busy={contentBusy}
            onBack={backToReferenceList}
            onSaveDraft={saveReferenceDraft}
            onPublish={publishReference}
            onDelete={deleteReference}
            onRestore={restoreReference}
          />
          : <section className="reference-reading-page reading-page-placeholder">
            <button className="secondary-button" onClick={backToReferenceList}>Quay lại thư viện tài liệu</button>
            {detailError || referencesError || contentError
              ? <div role="alert"><h1>Không tải được tài liệu tham khảo</h1><p>{detailError || referencesError || contentError}</p><button className="secondary-button" onClick={() => setReferencesReload((value) => value + 1)}>Thử tải lại</button></div>
              : <ReadingPending message="Đang tải tài liệu tham khảo…" />}
          </section>
      )}
      {initialView === 'programs' && selectedProgramId && (
        selectedProgramForReading && detailReady === selectedDetailKey ? <ProgramReadingPage
          program={selectedProgramForReading}
          canManage={currentUser === 'admin' || currentUser === 'editor'}
          onBack={() => returnToList('programId')}
          busy={contentBusy}
          onSave={saveProgram}
          onPublish={publishProgram}
          onDelete={deleteProgram}
        /> : <section className="program-section reading-page-placeholder">
          <div className="program-inner">
            <button className="outline-button light-button" onClick={() => returnToList('programId')}>Quay lại chương trình học</button>
            {detailError || contentError
              ? <div role="alert"><h1>Không tải được chương trình học</h1><p>{detailError || contentError}</p><button className="outline-button light-button" onClick={() => setContentReload((value) => value + 1)}>Thử tải lại</button></div>
              : <ReadingPending message="Đang tải chương trình học…" />}
          </div>
        </section>
      )}

      </fieldset>

      {initialView === "catechists" && (
        <CatechistDirectory
          canManage={currentUser === 'admin' || currentUser === 'editor'}
          loading={catechistsLoading}
          busy={contentBusy}
          loadError={catechistsError}
          onRetry={accountService ? () => setCatechistsReload((value) => value + 1) : undefined}
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
          onDelete={(catechist) => { void deleteCatechist(catechist) }}
        />
      )}

      {initialView === 'accounts' && currentUser === 'admin' && (
        <SystemAccountDirectory
          accounts={accountList}
          catechists={catechistList}
          loading={accountsLoading}
          loadError={accountsError}
          onRetry={accountService ? () => setAccountsReload((value) => value + 1) : undefined}
          onCreate={async (account) => {
            if (!accountService) throw new Error('Cần đăng nhập để tạo tài khoản.')
            const saved = await accountService.createAccount(account, catechistList)
            setAccountList((items) => [...items.filter((item) => item.id !== saved.id), saved])
            setAdminNotice({ type: 'success', text: 'Đã cấp tài khoản mới. Mật khẩu không được hiển thị lại.' })
          }}
          onResetPassword={async (account, password) => {
            if (!accountService) throw new Error('Cần đăng nhập để đặt lại mật khẩu.')
            await accountService.resetPassword(account, password)
            setAdminNotice({ type: 'success', text: `Đã đặt lại mật khẩu cho ${account.email}.` })
          }}
          onUpdateStatus={async (account, status: AccountStatus) => {
            if (!accountService) throw new Error('Cần đăng nhập để cập nhật tài khoản.')
            const saved = await accountService.updateStatus(account, status, catechistList)
            setAccountList((items) => items.map((item) => item.id === saved.id ? saved : item))
            setAdminNotice({ type: 'success', text: status === 'Đã lưu trữ' ? `Đã lưu trữ ${account.email} trong 10 ngày.` : `Đã cập nhật trạng thái ${account.email}.` })
          }}
          onDelete={async (account) => {
            if (!accountService) throw new Error('Cần đăng nhập để xóa tài khoản.')
            await accountService.deleteAccount(account)
            setAccountList((items) => items.filter((item) => item.id !== account.id))
            setAdminNotice({ type: 'success', text: `Đã xóa tài khoản ${account.email}.` })
          }}
          onUpdateLink={async (account, linkedCatechistId) => {
            if (!accountService) throw new Error('Cần đăng nhập để cập nhật liên kết.')
            const saved = await accountService.updateLink(account, linkedCatechistId, catechistList)
            setAccountList((items) => items.map((item) => item.id === saved.id ? saved : item))
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

      <SiteFooter />

      {lessonBrowser && <LessonDialogs
        browser={lessonBrowser}
        lessons={lessonsInBrowser}
        onCloseBrowser={() => setLessonBrowser(null)}
        onSelectLesson={openLesson}
      />}
      {adminEditor && <AdminEditorDialog
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
        lessonId={editingLessonId || undefined}
        getAccessToken={getAccessToken}
        busy={contentBusy}
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
      />}
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
