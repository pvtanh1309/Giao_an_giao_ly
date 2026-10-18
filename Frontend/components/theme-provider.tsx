'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
    THEME_STORAGE_KEY,
    readThemePreference,
    resolveTheme,
    writeThemePreference,
    type ResolvedTheme,
    type ThemePreference,
    type ThemePreferenceStorage,
} from '../lib/theme-preference'

type ThemeContextValue = {
    preference: ThemePreference
    theme: ResolvedTheme
    setPreference: (preference: ThemePreference) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const SYSTEM_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

function getSystemPreference(): boolean {
    try {
        return window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY).matches
    } catch {
        return false
    }
}

function applyRootTheme(theme: ResolvedTheme): void {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [preference, setPreferenceState] = useState<ThemePreference>('system')
    const [theme, setTheme] = useState<ResolvedTheme>('light')
    const preferenceRef = useRef<ThemePreference>('system')
    const themeRef = useRef<ResolvedTheme>('light')

    const applyPreference = useCallback((nextPreference: ThemePreference, systemPrefersDark: boolean) => {
        const nextTheme = resolveTheme(nextPreference, systemPrefersDark)
        preferenceRef.current = nextPreference
        themeRef.current = nextTheme
        setPreferenceState(nextPreference)
        setTheme(nextTheme)
        applyRootTheme(nextTheme)
    }, [])

    const setPreference = useCallback((nextPreference: ThemePreference) => {
        applyPreference(nextPreference, getSystemPreference())

        try {
            writeThemePreference(window.localStorage, nextPreference)
        } catch {
            // Keep the current page usable when the browser blocks local storage access.
        }
    }, [applyPreference])

    const toggleTheme = useCallback(() => {
        setPreference(themeRef.current === 'dark' ? 'light' : 'dark')
    }, [setPreference])

    useEffect(() => {
        let storage: ThemePreferenceStorage | null = null
        try {
            storage = window.localStorage
        } catch {
            // A blocked local storage falls back to the system preference.
        }

        const media = window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY)
        const syncFromStorage = () => {
            applyPreference(storage ? readThemePreference(storage) : 'system', media.matches)
        }
        const onStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
            if (storage && event.storageArea && event.storageArea !== storage) return
            syncFromStorage()
        }
        const onSystemPreferenceChange = (event: MediaQueryListEvent) => {
            if (preferenceRef.current === 'system') applyPreference('system', event.matches)
        }

        syncFromStorage()
        window.addEventListener('storage', onStorage)
        media.addEventListener('change', onSystemPreferenceChange)

        return () => {
            window.removeEventListener('storage', onStorage)
            media.removeEventListener('change', onSystemPreferenceChange)
        }
    }, [applyPreference])

    const value = useMemo(() => ({ preference, theme, setPreference, toggleTheme }), [preference, theme, setPreference, toggleTheme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext)
    if (!context) throw new Error('useTheme must be used within ThemeProvider')
    return context
}
