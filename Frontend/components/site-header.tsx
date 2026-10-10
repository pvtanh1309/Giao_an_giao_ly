'use client'

import Image from 'next/image'
import { LogIn, Menu, X } from 'lucide-react'
import type { AppRole } from '../lib/auth/types'

type SiteHeaderProps = {
    activeNav: string
    mobileMenu: boolean
    onNavigate: (path: string) => void
    onLogout: () => void
    onToggleMenu: () => void
    currentUser: AppRole
}

export function SiteHeader({
    activeNav,
    mobileMenu,
    onNavigate,
    onLogout,
    onToggleMenu,
    currentUser,
}: SiteHeaderProps) {
    const navigation = [
        { label: 'Tổng quan', path: '/dashboard' },
        { label: 'Giáo án', path: '/lesson-plans' },
        { label: 'Chương trình học', path: '/programs' },
        { label: 'Giáo lý viên', path: '/catechists' },
        ...(currentUser === 'admin' ? [{ label: 'Tài khoản hệ thống', path: '/accounts' }] : []),
    ]
    return (
        <header className="topbar">
            <div className="topbar-inner">
                <button
                    className="brand"
                    onClick={() => onNavigate('/dashboard')}
                    aria-label="Về trang chủ"
                >
                    <Image
                        className="parish-logo-image"
                        src="/images/logo-thieu-nhi.jpg"
                        alt="Logo Đoàn Thiếu nhi Thánh Thể Giáo xứ Thái An"
                        width={48}
                        height={48}
                    />
                    <span>
                        <strong>Giáo Phận Xuân Lộc</strong>
                        <small>Giáo xứ Thái An</small>
                    </span>
                </button>
                <nav
                    className={mobileMenu ? 'main-nav open' : 'main-nav'}
                    aria-label="Điều hướng chính"
                >
                    {navigation.map(
                        (item) => (
                            <button
                                key={item.label}
                                className={activeNav === item.label ? 'nav-link active' : 'nav-link'}
                                onClick={() => onNavigate(item.path)}
                            >
                                {item.label}
                            </button>
                        ),
                    )}
                </nav>
                <div className="header-actions">
                    <button className="login-button" onClick={onLogout}>
                        <LogIn size={16} /> Đăng xuất
                    </button>
                    <button
                        className="menu-button"
                        onClick={onToggleMenu}
                        aria-label="Mở menu"
                    >
                        {mobileMenu ? <X size={21} /> : <Menu size={21} />}
                    </button>
                </div>
            </div>
        </header>
    )
}
