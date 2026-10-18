'use client'

import type { ReactNode } from 'react'

import { AuthProvider } from '../components/auth-provider'
import { PersonalProfileProvider } from '../components/personal-profile-provider'

export function Providers({ children }: { children: ReactNode }) {
    return <AuthProvider><PersonalProfileProvider>{children}</PersonalProfileProvider></AuthProvider>
}
