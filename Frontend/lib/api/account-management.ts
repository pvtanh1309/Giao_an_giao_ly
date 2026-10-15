import type { AccountStatus, AppRole, Catechist, SystemAccount } from '../content-data'
import type { ApiClient } from './client'

export type AccountForm = {
    email: string
    password: string
    confirmPassword: string
    role: Extract<AppRole, 'editor' | 'reader'>
    linkedCatechistId: string
}

type AccountDto = {
    cognitoSub: string
    email: string
    role: 'ADMIN' | 'EDITOR' | 'READER'
    accountStatus: 'ACTIVE' | 'DISABLED' | 'DELETED'
    catechistId?: string
    createdAt: string
}
type ProfileDto = {
    catechistId: string
    name: string
    email: string
    phone: string
    group: string
    status: 'ACTIVE' | 'PAUSED' | 'INACTIVE'
    version: number
}

const statusLabels: Record<AccountDto['accountStatus'], AccountStatus> = {
    ACTIVE: 'Hoạt động', DISABLED: 'Vô hiệu hóa', DELETED: 'Đã lưu trữ',
}

function accountView(item: AccountDto, profiles: Catechist[]): SystemAccount {
    return {
        id: item.cognitoSub,
        email: item.email,
        role: item.role.toLowerCase() as AppRole,
        status: statusLabels[item.accountStatus],
        linkedCatechistId: item.catechistId,
        linkedCatechistEmail: profiles.find((profile) => profile.id === item.catechistId)?.email,
        createdAt: new Intl.DateTimeFormat('vi-VN').format(new Date(item.createdAt)),
    }
}

function profileId(profiles: Catechist[], selectedId: string): string {
    const id = profiles.find((profile) => profile.id === selectedId)?.id
    if (!id) throw new Error('Hãy chọn hồ sơ giáo lý viên đã được lưu trên máy chủ.')
    return id
}

export function createAccountManagement(api: ApiClient) {
    async function listAll<T>(path: string): Promise<T[]> {
        const items: T[] = []
        const seen = new Set<string>()
        let cursor: string | undefined
        do {
            const query = new URLSearchParams({ limit: '50' })
            if (cursor) query.set('cursor', cursor)
            const page = await api.requestPage<T>(`${path}?${query}`)
            items.push(...page.items)
            cursor = page.nextCursor
            if (cursor && seen.has(cursor)) throw new Error('Máy chủ trả về phân trang không hợp lệ.')
            if (cursor) seen.add(cursor)
        } while (cursor)
        return items
    }
    return {
        async listProfiles(): Promise<Catechist[]> {
            return (await listAll<ProfileDto>('/catechists')).map((profile) => ({
                id: profile.catechistId, version: profile.version,
                name: profile.name, email: profile.email, phone: profile.phone,
                homeroomClass: profile.group, accompanyingClass: '',
                status: profile.status === 'ACTIVE' ? 'Còn hoạt động' : profile.status === 'PAUSED' ? 'Tạm nghỉ' : 'Đã nghỉ',
            }))
        },
        async listAccounts(profiles: Catechist[]) {
            return (await listAll<AccountDto>('/admin/accounts')).map((item) => accountView(item, profiles))
        },
        async createAccount(form: AccountForm, profiles: Catechist[]) {
            const item = await api.request<AccountDto>('/admin/accounts', {
                method: 'POST',
                body: {
                    email: form.email.trim(), password: form.password, role: form.role.toUpperCase(),
                    ...(form.role === 'editor' ? { catechistId: profileId(profiles, form.linkedCatechistId) } : {}),
                },
            })
            return accountView(item, profiles)
        },
        async resetPassword(account: SystemAccount, password: string) {
            await api.request(`/admin/accounts/${encodeURIComponent(account.id)}/reset-password`, { method: 'POST', body: { password } })
        },
        async updateStatus(account: SystemAccount, status: AccountStatus, profiles: Catechist[]) {
            const base = `/admin/accounts/${encodeURIComponent(account.id)}`
            const action = status === 'Đã lưu trữ' ? '' : status === 'Vô hiệu hóa' ? '/disable'
                : account.status === 'Đã lưu trữ' ? '/restore' : '/enable'
            const item = await api.request<AccountDto>(base + action, { method: status === 'Đã lưu trữ' ? 'DELETE' : 'POST', body: {} })
            return accountView(item, profiles)
        },
        async updateLink(account: SystemAccount, selectedId: string, profiles: Catechist[]) {
            const item = await api.request<AccountDto>(`/admin/accounts/${encodeURIComponent(account.id)}/catechist-link`, {
                method: 'PUT', body: { catechistId: profileId(profiles, selectedId) },
            })
            return accountView(item, profiles)
        },
    }
}
