'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()
    const label = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'

    return (
        <button
            className="icon-button theme-toggle"
            type="button"
            aria-label={label}
            aria-pressed={theme === 'dark'}
            title={label}
            onClick={toggleTheme}
        >
            {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
    )
}
