'use client'

import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from './auth-provider'
import { PasswordInput } from './password-input'

export function AuthScreen() {
    const { status, error, login, completeNewPassword } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [challengeActive, setChallengeActive] = useState(false)
    const [localError, setLocalError] = useState<string | null>(null)
    const submitting = status === 'authenticating'
    const systemUnavailable = error?.includes('chưa được cấu hình') ?? false
    const needsNewPassword = status === 'new-password-required' || challengeActive

    useEffect(() => {
        if (status === 'new-password-required') setChallengeActive(true)
    }, [status])

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (submitting || systemUnavailable) return
        setLocalError(null)
        try {
            await login(email.trim(), password)
        } finally {
            setPassword('')
        }
    }

    const handleNewPassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (submitting || systemUnavailable) return
        setLocalError(null)
        try {
            if (newPassword !== confirmation) {
                setLocalError('Mật khẩu xác nhận chưa khớp.')
                return
            }
            await completeNewPassword(newPassword)
        } finally {
            setNewPassword('')
            setConfirmation('')
        }
    }

    return (
        <main className="auth-shell">
            <div className="auth-art" aria-hidden="true">
                <img src="/images/auth-church-group.png" alt="" />
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
                    <span><strong>Giáo phận Xuân Lộc</strong><small>Giáo xứ Thái An</small></span>
                </div>
                <div className="auth-copy">
                    <span className="section-kicker">Tài liệu giáo lý Công giáo</span>
                    <h1>Cùng nhau lớn lên<br /><em>trong đức tin</em></h1>
                    <p>Nơi giáo lý viên tìm thấy những bài học, chương trình và cảm hứng để đồng hành cùng các em Thiếu Nhi.</p>
                </div>

                {needsNewPassword ? (
                    <form className="auth-form" onSubmit={handleNewPassword}>
                        <div className="auth-heading">
                            <span className="section-kicker">Bảo vệ tài khoản</span>
                            <h2>Đặt mật khẩu mới</h2>
                        </div>
                        <label>
                            Mật khẩu mới
                            <PasswordInput
                                key="new-password"
                                visibilityLabel="mật khẩu mới"
                                required
                                minLength={8}
                                disabled={submitting || systemUnavailable}
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                            />
                        </label>
                        <label>
                            Xác nhận mật khẩu mới
                            <PasswordInput
                                key="confirm-new-password"
                                visibilityLabel="xác nhận mật khẩu mới"
                                required
                                minLength={8}
                                disabled={submitting || systemUnavailable}
                                autoComplete="new-password"
                                value={confirmation}
                                onChange={(event) => setConfirmation(event.target.value)}
                            />
                        </label>
                        {(localError || error) && <p className="auth-error" role="alert">{localError || error}</p>}
                        <button className="primary-button full" type="submit" disabled={submitting || systemUnavailable}>
                            {submitting ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'} <ArrowRight size={17} />
                        </button>
                    </form>
                ) : (
                    <form className="auth-form" onSubmit={handleLogin}>
                        <div className="auth-heading">
                            <span className="section-kicker">Anh/Chị hãy đăng nhập để xem tài liệu nhé</span>
                            <h2>Đăng nhập tài khoản</h2>
                        </div>
                        <label>
                            Email
                            <input
                                required
                                type="email"
                                autoComplete="username"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="ten@vidu.vn"
                            />
                        </label>
                        <label>
                            Mật khẩu
                            <PasswordInput
                                key="login-password"
                                visibilityLabel="mật khẩu đăng nhập"
                                required
                                disabled={submitting || systemUnavailable}
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />
                        </label>
                        {(localError || error) && <p className="auth-error" role="alert">{localError || error}</p>}
                        <button className="primary-button full" type="submit" disabled={submitting || systemUnavailable}>
                            {submitting ? 'Đang đăng nhập…' : 'Vào trang tổng quan'} <ArrowRight size={17} />
                        </button>
                    </form>
                )}
            </section>
        </main>
    )
}
