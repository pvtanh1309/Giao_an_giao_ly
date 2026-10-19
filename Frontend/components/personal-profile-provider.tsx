'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth, useUnauthorizedHandler } from './auth-provider'
import { createUsersApi } from '../lib/api/users'
import { getPublicConfig } from '../lib/config'
import { createPersonalProfileApi, type Me, type ProfileFields } from '../lib/api/personal-profile'

type Value = { me: Me | null; loading: boolean; error: string; reload: () => Promise<void>; updateProfile: (fields: ProfileFields) => Promise<void> }
const Context = createContext<Value | null>(null)
export function PersonalProfileProvider({ children }: { children: ReactNode }) {
    const { status, user, getAccessToken } = useAuth()
    const unauthorized = useUnauthorizedHandler()
    const sub = status === 'authenticated' && !user?.localMock ? user?.sub ?? '' : ''
    const scope = useRef(sub); scope.current = sub
    const generation = useRef(0)
    const [saved, setSaved] = useState<{ owner: string; data: Me } | null>(null)
    const [state, setState] = useState({ owner: '', loading: false, error: '' })
    const api = useMemo(() => sub ? createPersonalProfileApi(createUsersApi({ config: getPublicConfig(), getAccessToken, onUnauthorized: unauthorized })) : null, [sub, getAccessToken, unauthorized])
    const reload = useCallback(async () => {
        const id = ++generation.current
        if (!api || !sub) return
        setState({ owner: sub, loading: true, error: '' })
        try {
            const data = await api.getMe()
            if (scope.current === sub && generation.current === id && data.cognitoSub === sub) setSaved({ owner: sub, data })
        } catch (error) {
            if (scope.current === sub && generation.current === id) setState({ owner: sub, loading: false, error: error instanceof Error ? error.message : 'Không tải được hồ sơ.' })
        } finally {
            if (scope.current === sub && generation.current === id) setState((s) => ({ ...s, loading: false }))
        }
    }, [api, sub])
    useEffect(() => { setSaved(null); void reload(); return () => { generation.current++ } }, [reload])
    const updateProfile = async (fields: ProfileFields) => {
        if (!api || !sub) throw new Error('Cần đăng nhập.')
        generation.current++
        const data = await api.updateProfile(fields)
        if (scope.current !== sub || data.cognitoSub !== sub) throw new Error('Phiên đăng nhập đã thay đổi.')
        setSaved({ owner: sub, data })
        setState({ owner: sub, loading: false, error: '' })
    }
    return <Context.Provider value={{ me: saved?.owner === sub ? saved.data : null, loading: state.owner === sub && state.loading, error: state.owner === sub ? state.error : '', reload, updateProfile }}>{children}</Context.Provider>
}
export function usePersonalProfile() {
    const value = useContext(Context)
    if (!value) throw new Error('PersonalProfileProvider missing')
    return value
}
