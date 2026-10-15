'use client'

import { Archive, KeyRound, LockKeyhole, Pencil, Plus, RotateCcw, Search, ShieldCheck, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { AccountStatus, AppRole, Catechist, SystemAccount } from '../lib/content-data'
import type { AccountForm } from '../lib/api/account-management'
import { PasswordInput } from './password-input'

type SystemAccountDirectoryProps = {
  accounts: SystemAccount[]
  catechists: Catechist[]
  loading?: boolean
  loadError?: string
  onCreate: (account: AccountForm) => Promise<void>
  onResetPassword: (account: SystemAccount, password: string) => Promise<void>
  onUpdateStatus: (account: SystemAccount, status: AccountStatus) => Promise<void>
  onUpdateLink: (account: SystemAccount, linkedCatechistId: string) => Promise<void>
}

const emptyForm: AccountForm = {
  email: '',
  password: '',
  confirmPassword: '',
  role: 'editor',
  linkedCatechistId: '',
}

const roleLabel: Record<AppRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  reader: 'Tài khoản dùng chung',
}

export function SystemAccountDirectory({ accounts, catechists, loading = false, loadError = '', onCreate, onResetPassword, onUpdateStatus, onUpdateLink }: SystemAccountDirectoryProps) {
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const [actionError, setActionError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all')
  const [form, setForm] = useState<AccountForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [dialog, setDialog] = useState<'create' | 'reset' | 'link' | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<SystemAccount | null>(null)

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const matchesQuery = `${account.email} ${roleLabel[account.role]}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
    return matchesQuery && (roleFilter === 'all' || account.role === roleFilter) && (statusFilter === 'all' || account.status === statusFilter)
  }), [accounts, query, roleFilter, statusFilter])

  const closeDialog = () => {
    if (pending.current) return
    setDialog(null)
    setSelectedAccount(null)
    setForm(emptyForm)
    setFormError('')
  }

  const openCreate = () => {
    if (pending.current || loading || loadError) return
    setForm(emptyForm)
    setFormError('')
    setDialog('create')
  }

  const runAction = async (action: () => Promise<void>, inDialog = true) => {
    if (pending.current) return
    pending.current = true
    setSubmitting(true)
    setFormError('')
    setActionError('')
    try {
      await action()
      if (inDialog) {
        setDialog(null)
        setSelectedAccount(null)
        setForm(emptyForm)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật tài khoản. Vui lòng thử lại.'
      if (inDialog) setFormError(message)
      else setActionError(message)
    } finally {
      setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
      pending.current = false
      setSubmitting(false)
    }
  }

  const submitCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.email.trim() || !form.password) return setFormError('Vui lòng nhập email và mật khẩu.')
    if (form.password !== form.confirmPassword) return setFormError('Xác nhận mật khẩu chưa khớp.')
    if (form.role === 'editor' && !form.linkedCatechistId) return setFormError('Editor cần được liên kết với một hồ sơ giáo lý viên.')
    void runAction(() => onCreate(form))
  }

  const submitReset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAccount) return
    if (!form.password) return setFormError('Vui lòng nhập mật khẩu mới.')
    if (form.password !== form.confirmPassword) return setFormError('Xác nhận mật khẩu chưa khớp.')
    const account = selectedAccount
    void runAction(() => onResetPassword(account, form.password))
  }

  const submitLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAccount || !form.linkedCatechistId) return setFormError('Vui lòng chọn hồ sơ giáo lý viên.')
    const account = selectedAccount
    void runAction(() => onUpdateLink(account, form.linkedCatechistId))
  }

  const linkedCatechist = (account: SystemAccount) => catechists.find((item) => item.id === account.linkedCatechistId)

  return (
    <section className="accounts-section">
      <div className="accounts-heading">
        <div>
          <span className="section-kicker">Quản trị hệ thống</span>
          <h1>Tài khoản hệ thống</h1>
          <p>Cấp quyền truy cập, đặt lại mật khẩu và quản lý tài khoản dùng chung của giáo xứ.</p>
        </div>
        <button className="primary-button" disabled={loading || submitting || Boolean(loadError)} onClick={openCreate}><Plus size={17} /> Cấp tài khoản</button>
      </div>

      <div className="account-summary" aria-label="Tóm tắt tài khoản">
        <article><ShieldCheck size={19} /><span><strong>{accounts.filter((account) => account.role === 'admin').length}</strong><small>Admin</small></span></article>
        <article><UserRoundCheck size={19} /><span><strong>{accounts.filter((account) => account.role === 'editor').length}</strong><small>Editor</small></span></article>
        <article><UsersRound size={19} /><span><strong>{accounts.filter((account) => account.role === 'reader').length}</strong><small>Dùng chung</small></span></article>
      </div>

      <div className="account-tools">
        <label className="directory-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Tìm tài khoản" placeholder="Tìm theo email hoặc vai trò" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Lọc theo vai trò" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | AppRole)}><option value="all">Tất cả vai trò</option><option value="admin">Admin</option><option value="editor">Editor</option><option value="reader">Tài khoản dùng chung</option></select>
        <select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | AccountStatus)}><option value="all">Tất cả trạng thái</option><option>Hoạt động</option><option>Vô hiệu hóa</option><option>Đã lưu trữ</option></select>
      </div>

      {loading && <p role="status">Đang tải danh sách tài khoản…</p>}
      {(loadError || actionError) && <p role="alert" className="account-form-error">{loadError || actionError}</p>}
      <fieldset disabled={submitting || loading || Boolean(loadError)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="accounts-table-wrap">
        <table className="accounts-table">
          <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Hồ sơ giáo lý viên</th><th>Trạng thái</th><th>Ngày cấp</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
          <tbody>{filteredAccounts.map((account) => {
            const profile = linkedCatechist(account)
            const isOnlyAdmin = account.role === 'admin'
            return <tr key={account.id}>
              <td><span className="account-email"><KeyRound size={16} />{account.email}</span></td>
              <td><span className={`role-badge ${account.role}`}>{roleLabel[account.role]}</span></td>
              <td>{account.role === 'editor' ? (profile ? <span className="account-profile">{profile.name}<small>{profile.homeroomClass || profile.accompanyingClass || 'Chưa phân lớp'}</small></span> : 'Chưa liên kết') : '—'}</td>
              <td><span className={`account-status ${account.status === 'Hoạt động' ? 'active' : account.status === 'Vô hiệu hóa' ? 'disabled' : 'archived'}`}>{account.status}</span></td>
              <td>{account.createdAt}</td>
              <td><div className="account-actions">
                {account.role === 'editor' && <button type="button" onClick={() => { setFormError(''); setSelectedAccount(account); setForm({ ...emptyForm, linkedCatechistId: account.linkedCatechistId ?? '' }); setDialog('link') }} title="Đổi hồ sơ liên kết"><Pencil size={15} /></button>}
                {account.status !== 'Đã lưu trữ' && <button type="button" disabled={isOnlyAdmin} onClick={() => { setFormError(''); setSelectedAccount(account); setForm(emptyForm); setDialog('reset') }} title="Đặt lại mật khẩu"><RotateCcw size={15} /></button>}
                {account.status !== 'Đã lưu trữ' && <button type="button" disabled={isOnlyAdmin} onClick={() => void runAction(() => onUpdateStatus(account, account.status === 'Hoạt động' ? 'Vô hiệu hóa' : 'Hoạt động'), false)} title={account.status === 'Hoạt động' ? 'Vô hiệu hóa' : 'Kích hoạt'}><LockKeyhole size={15} /></button>}
                {account.status === 'Đã lưu trữ' ? <button type="button" disabled={isOnlyAdmin} onClick={() => void runAction(() => onUpdateStatus(account, 'Hoạt động'), false)} title="Khôi phục"><RotateCcw size={15} /></button> : <button type="button" disabled={isOnlyAdmin || account.role === 'reader'} onClick={() => void runAction(() => onUpdateStatus(account, 'Đã lưu trữ'), false)} title="Lưu trữ 10 ngày"><Archive size={15} /></button>}
              </div></td>
            </tr>
          })}</tbody>
        </table>
        {!loading && !loadError && !filteredAccounts.length && <p className="account-empty">Không tìm thấy tài khoản phù hợp.</p>}
      </div>

      {dialog && <div className="account-dialog-backdrop" role="presentation"><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
        <button className="dialog-close" onClick={closeDialog} aria-label="Đóng"><X size={18} /></button>
        {dialog === 'create' && <form onSubmit={submitCreate}><span className="section-kicker">Quản trị hệ thống</span><h2 id="account-dialog-title">Cấp tài khoản</h2><p>Chỉ cấp Editor hoặc tài khoản Reader dùng chung. Tài khoản Admin được quản lý riêng.</p>
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="email@giaoxuthaian.vn" /></label>
          <label>Vai trò<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AccountForm['role'], linkedCatechistId: '' })}><option value="editor">Editor</option><option value="reader">Tài khoản dùng chung</option></select></label>
          {form.role === 'editor' ? <label>Hồ sơ giáo lý viên<select required value={form.linkedCatechistId} onChange={(event) => setForm({ ...form, linkedCatechistId: event.target.value })}><option value="">Chọn hồ sơ liên kết</option>{catechists.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.homeroomClass || item.accompanyingClass || 'Chưa phân lớp'}</option>)}</select></label> : <p className="account-warning">Tài khoản này dùng chung để các anh chị chỉ xem nội dung; không liên kết hồ sơ giáo lý viên.</p>}
          <label>Mật khẩu<PasswordInput visibilityLabel="mật khẩu mới" disabled={submitting} required minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>Xác nhận mật khẩu<PasswordInput visibilityLabel="xác nhận mật khẩu" disabled={submitting} required minLength={8} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
          {formError && <p className="account-form-error">{formError}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={closeDialog}>Hủy</button><button className="primary-button" type="submit">Cấp tài khoản</button></div>
        </form>}
        {dialog === 'reset' && selectedAccount && <form onSubmit={submitReset}><span className="section-kicker">Bảo mật tài khoản</span><h2 id="account-dialog-title">Đặt lại mật khẩu</h2><p>Đặt mật khẩu mới cho <strong>{selectedAccount.email}</strong>. Mật khẩu sẽ không được hiển thị lại sau khi lưu.</p><label>Mật khẩu mới<PasswordInput visibilityLabel="mật khẩu mới" disabled={submitting} required minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>Xác nhận mật khẩu<PasswordInput visibilityLabel="xác nhận mật khẩu" disabled={submitting} required minLength={8} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>{formError && <p className="account-form-error">{formError}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={closeDialog}>Hủy</button><button className="primary-button" type="submit">Lưu mật khẩu</button></div></form>}
        {dialog === 'link' && selectedAccount && <form onSubmit={submitLink}><span className="section-kicker">Tài khoản Editor</span><h2 id="account-dialog-title">Đổi hồ sơ liên kết</h2><p>Chọn hồ sơ giáo lý viên tương ứng với <strong>{selectedAccount.email}</strong>.</p><label>Hồ sơ giáo lý viên<select required value={form.linkedCatechistId} onChange={(event) => setForm({ ...form, linkedCatechistId: event.target.value })}><option value="">Chọn hồ sơ liên kết</option>{catechists.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.homeroomClass || item.accompanyingClass || 'Chưa phân lớp'}</option>)}</select></label>{formError && <p className="account-form-error">{formError}</p>}<div className="dialog-actions"><button type="button" className="secondary-button" onClick={closeDialog}>Hủy</button><button className="primary-button" type="submit">Cập nhật liên kết</button></div></form>}
      </section></div>}
      </fieldset>
    </section>
  )
}
