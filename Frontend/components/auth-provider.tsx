'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    type ReactNode,
} from 'react'

import { createCognitoAuth } from '../lib/auth/cognito.ts'
import { createLocalMockAuth } from '../lib/auth/local-mock.ts'
import {
    authReducer,
    completeNewPasswordAuthSession,
    getAccessTokenAuthSession,
    initialAuthState,
    invalidateCurrentAuthSession,
    loginAuthSession,
    restoreAuthSession,
} from '../lib/auth/state.ts'
import type { AuthClient, AuthStatus, AuthenticatedUser } from '../lib/auth/types'
import { getPublicConfig } from '../lib/config.ts'

export type AuthContextValue = {
    status: AuthStatus
    user: AuthenticatedUser | null
    error: string | null
    login(email: string, password: string): Promise<void>
    completeNewPassword(newPassword: string): Promise<void>
    logout(): void
    getAccessToken(): Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const UnauthorizedContext = createContext<(() => void) | null>(null)

export function AuthProvider({ children, client }: { children: ReactNode; client?: AuthClient }) {
    const [state, dispatch] = useReducer(authReducer, initialAuthState)
    const clientRef = useRef<AuthClient | null>(client ?? null)
    const sessionVersion = useRef(0)
    const currentVersion = sessionVersion.current

    const getClient = useCallback(() => {
        if (client) clientRef.current = client
        if (!clientRef.current) {
            const localMockEnabled = process.env.NODE_ENV === 'development'
                && process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_MOCK === 'true'
            if (localMockEnabled) {
                const email = process.env.NEXT_PUBLIC_LOCAL_AUTH_EMAIL
                const password = process.env.NEXT_PUBLIC_LOCAL_AUTH_PASSWORD
                if (!email || !password) throw new Error('Local mock credentials are not configured')
                clientRef.current = createLocalMockAuth({ email, password })
            } else {
                clientRef.current = createCognitoAuth(getPublicConfig())
            }
        }
        return clientRef.current
    }, [client])

    useEffect(() => {
        let active = true
        const version = ++sessionVersion.current

        try {
            void restoreAuthSession(getClient()).then((action) => {
                if (active && version === sessionVersion.current) dispatch(action)
            })
        } catch {
            dispatch({ type: 'RESTORE_ANONYMOUS', error: 'Hệ thống đăng nhập chưa được cấu hình.' })
        }

        return () => { active = false }
    }, [getClient])

    const login = useCallback(async (email: string, password: string) => {
        const version = ++sessionVersion.current
        dispatch({ type: 'AUTHENTICATING' })
        try {
            const action = await loginAuthSession(getClient(), email, password)
            if (version === sessionVersion.current) dispatch(action)
        } catch {
            if (version === sessionVersion.current) dispatch({ type: 'AUTH_FAILURE', error: 'Hệ thống đăng nhập chưa được cấu hình.' })
        }
    }, [getClient])

    const completeNewPassword = useCallback(async (newPassword: string) => {
        const version = ++sessionVersion.current
        dispatch({ type: 'AUTHENTICATING' })
        try {
            const action = await completeNewPasswordAuthSession(getClient(), newPassword)
            if (version === sessionVersion.current) dispatch(action)
        } catch {
            if (version === sessionVersion.current) dispatch({ type: 'CHALLENGE_FAILURE', error: 'Hệ thống đăng nhập chưa được cấu hình.' })
        }
    }, [getClient])

    const logout = useCallback(() => {
        sessionVersion.current++
        try {
            getClient().signOut()
        } finally {
            dispatch({ type: 'LOGOUT' })
        }
    }, [getClient])

    const handleUnauthorized = useCallback(() => {
        if (sessionVersion.current !== currentVersion) return
        try {
            invalidateCurrentAuthSession(getClient(), dispatch, () => sessionVersion.current === currentVersion)
        } catch {
            dispatch({ type: 'UNAUTHORIZED' })
        }
    }, [getClient, currentVersion])

    const getAccessToken = useCallback(
        () => getAccessTokenAuthSession(getClient(), dispatch, () => sessionVersion.current === currentVersion),
        [getClient, currentVersion],
    )
    const value = useMemo<AuthContextValue>(() => ({
        status: state.status,
        user: state.user,
        error: state.error,
        login,
        completeNewPassword,
        logout,
        getAccessToken,
    }), [completeNewPassword, getAccessToken, login, logout, state.error, state.status, state.user])

    return (
        <UnauthorizedContext.Provider value={handleUnauthorized}>
            <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
        </UnauthorizedContext.Provider>
    )
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth phải được dùng bên trong AuthProvider.')
    return context
}

export function useUnauthorizedHandler(): () => void {
    const handler = useContext(UnauthorizedContext)
    if (!handler) throw new Error('useUnauthorizedHandler phải được dùng bên trong AuthProvider.')
    return handler
}
