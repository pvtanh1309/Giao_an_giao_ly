'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useAuth } from './auth-provider'
import { usePersonalProfile } from './personal-profile-provider'
import { PersonalProfileDialog } from './personal-profile-dialog'
import { createPortal } from 'react-dom'

export function AccountMenu({ onLogout }: { onLogout: () => void }) {
    const { user } = useAuth()
    const { me, loading } = usePersonalProfile()
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const root = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const name = me?.displayName || user?.email || 'Tài khoản'
    useEffect(() => {
        const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside)
    }, [])
    useEffect(() => { setOpen(false); setEditing(false) }, [user?.sub])
    return <div className="account-menu" ref={root} onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }}>
        <button ref={trigger} className="account-menu-trigger" type="button" aria-label={`Tài khoản ${name}`} aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="account-menu-avatar" aria-hidden="true">{name.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</span><span>{loading && !me ? 'Đang tải…' : name}</span><ChevronDown size={15} />
        </button>
        {open && <div className="account-menu-options"><button type="button" onClick={() => { setOpen(false); setEditing(true) }}><UserRound size={16} /> Cập nhật thông tin</button><button type="button" onClick={() => { setOpen(false); onLogout() }}><LogOut size={16} /> Đăng xuất</button></div>}
        {editing && createPortal(<PersonalProfileDialog key={`${me?.profile?.catechistId}:${me?.profile?.version}`} onClose={() => { setEditing(false); trigger.current?.focus() }} />, document.body)}
    </div>
}
