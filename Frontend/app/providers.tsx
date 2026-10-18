'use client'

import type { ReactNode } from 'react'

import { AuthProvider } from '../components/auth-provider'
import { PersonalProfileProvider } from '../components/personal-profile-provider'
import { ThemeProvider } from '../components/theme-provider'

export function Providers({ children }: { children: ReactNode }) {
    return <ThemeProvider><AuthProvider><PersonalProfileProvider>{children}</PersonalProfileProvider></AuthProvider></ThemeProvider>
}
