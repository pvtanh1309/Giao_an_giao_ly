'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useId, useState, type InputHTMLAttributes } from 'react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    visibilityLabel?: string
}

export function PasswordInput({ id, value, disabled, visibilityLabel = 'mật khẩu', ...props }: PasswordInputProps) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const [visible, setVisible] = useState(false)
    const revealed = visible && !disabled

    useEffect(() => {
        if (!value || disabled) setVisible(false)
    }, [value, disabled])

    return (
        <span className="password-input">
            <input {...props} id={inputId} value={value} disabled={disabled} type={revealed ? 'text' : 'password'} />
            <button
                className="password-visibility-toggle"
                type="button"
                disabled={disabled}
                aria-label={`${revealed ? 'Ẩn' : 'Hiện'} ${visibilityLabel}`}
                aria-controls={inputId}
                aria-pressed={revealed}
                onClick={() => setVisible((current) => !current)}
            >
                {revealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
        </span>
    )
}
