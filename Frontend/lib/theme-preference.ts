export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'giaoan.theme.v1'

export interface ThemePreferenceStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

const isThemePreference = (value: string | null): value is ThemePreference =>
    value === 'system' || value === 'light' || value === 'dark'

export function readThemePreference(storage: ThemePreferenceStorage): ThemePreference {
    try {
        const value = storage.getItem(THEME_STORAGE_KEY)
        return isThemePreference(value) ? value : 'system'
    } catch {
        return 'system'
    }
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
    if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
    return preference
}

export function writeThemePreference(storage: ThemePreferenceStorage, preference: ThemePreference): void {
    try {
        if (preference === 'system') {
            storage.removeItem(THEME_STORAGE_KEY)
            return
        }

        storage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
        // The current page can still use its in-memory preference when storage is unavailable.
    }
}

export function getThemeBootstrapScript(): string {
    return `(()=>{let theme='light';try{const saved=window.localStorage.getItem('${THEME_STORAGE_KEY}');theme=saved==='dark'?'dark':saved==='light'?'light':window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{try{theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{}}const root=document.documentElement;root.classList.toggle('dark',theme==='dark');root.style.colorScheme=theme})();`
}
