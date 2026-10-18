'use client'
import { useEffect, useRef, useState } from 'react'
import { usePersonalProfile } from './personal-profile-provider'
import { beforeAppNavigation } from '../lib/unsaved-work'
import { useDialogFocus } from './use-dialog-focus'

export function PersonalProfileDialog({ onClose }: { onClose: () => void }) {
    const { me, error, reload, updateProfile } = usePersonalProfile()
    const profile = me?.profile
    const initial = { email: profile?.email ?? '', phone: profile?.phone ?? '', group: profile?.group ?? '', accompanyingClass: profile?.accompanyingClass ?? '', version: profile?.version ?? 0 }
    const [fields, setFields] = useState(initial)
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const pending = useRef(false)
    const dirty = JSON.stringify(fields) !== JSON.stringify(initial)
    const close = () => { if (!pending.current && (!dirty || window.confirm('Bỏ các thay đổi thông tin chưa lưu?'))) onClose() }
    useEffect(() => {
        const navigation = (e: Event) => { if (pending.current || (dirty && !window.confirm('Bỏ các thay đổi thông tin chưa lưu?'))) e.preventDefault() }
        const unload = (e: BeforeUnloadEvent) => { if (dirty || pending.current) { e.preventDefault(); e.returnValue = '' } }
        window.addEventListener(beforeAppNavigation, navigation); window.addEventListener('beforeunload', unload)
        return () => { window.removeEventListener(beforeAppNavigation, navigation); window.removeEventListener('beforeunload', unload) }
    }, [dirty])
    const formRef = useRef<HTMLFormElement>(null)
    const dialogRef = useRef<HTMLElement>(null)
    useDialogFocus(dialogRef)
    useEffect(() => { formRef.current?.querySelector<HTMLInputElement>('input:not([readonly])')?.focus() }, [])
    return <div className="personal-profile-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close() }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}>
        <section ref={dialogRef} className="personal-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="personal-profile-title">
            <h2 id="personal-profile-title">Cập nhật thông tin</h2>
            {!profile ? <><p>{error || 'Tài khoản chưa được liên kết hồ sơ. Liên hệ Admin để cập nhật thông tin.'}</p><button type="button" onClick={() => { void reload() }}>Tải lại thông tin</button><button type="button" onClick={close}>Đóng</button></> : <form ref={formRef} onSubmit={async (e) => {
                e.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setMessage('')
                try { await updateProfile(fields); onClose() } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lưu được thông tin.') }
                finally { pending.current = false; setBusy(false) }
            }}>
                <fieldset disabled={busy}>
                    <label>Email đăng nhập<input readOnly value={me.loginEmail} /></label>
                    <p>Email liên hệ bên dưới không thay đổi email đăng nhập.</p>
                    {(['email', 'phone', 'group', 'accompanyingClass'] as const).map((key, index) => <label key={key}>{['Email liên hệ', 'Số điện thoại', 'Lớp chủ nhiệm', 'Lớp đồng hành'][index]}<input required={key === 'email'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} maxLength={key === 'email' ? 254 : key === 'phone' ? 32 : 100} value={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.value })} /></label>)}
                    {message && <div role="alert"><p>{message}</p><button type="button" onClick={async () => { if (window.confirm('Tải thông tin mới từ máy chủ và bỏ thay đổi trong biểu mẫu?')) { await reload(); onClose() } }}>Tải lại thông tin</button></div>}
                    <div className="personal-profile-actions"><button type="button" className="secondary-button" onClick={close}>Hủy</button><button className="primary-button">{busy ? 'Đang lưu…' : 'Lưu thông tin'}</button></div>
                </fieldset>
            </form>}
        </section>
    </div>
}
