import type { ApiClient } from './client'

export type PersonalProfile = { catechistId: string; name: string; email: string; phone: string; group: string; accompanyingClass?: string; version: number }
export type Me = { cognitoSub: string; loginEmail: string; displayName: string; profile: PersonalProfile | null }
export type ProfileFields = Pick<PersonalProfile, 'email' | 'phone' | 'group' | 'version'> & { accompanyingClass: string }

export function createPersonalProfileApi(api: ApiClient) {
    return {
        getMe: () => api.request<Me>('/me'),
        updateProfile: (fields: ProfileFields) => api.request<Me>('/me/profile', { method: 'PUT', body: fields }),
    }
}
