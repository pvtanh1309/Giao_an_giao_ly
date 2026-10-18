import assert from 'node:assert/strict'
import test from 'node:test'
import { createPersonalProfileApi } from '../lib/api/personal-profile.ts'

test('self profile uses /me without sending an identity and keeps login/contact emails separate', async () => {
    const calls = []
    const dto = { cognitoSub: 'a', displayName: 'Maria Lan', loginEmail: 'login@example.com', profile: { catechistId: 'cat-a', version: 2, email: 'contact@example.com' } }
    const service = createPersonalProfileApi({ request: async (...args) => { calls.push(args); return dto } })
    assert.equal((await service.getMe()).loginEmail, 'login@example.com')
    const fields = { email: 'new@example.com', phone: '', group: 'Ấu 1', accompanyingClass: '', version: 2 }
    await service.updateProfile(fields)
    assert.deepEqual(calls, [['/me'], ['/me/profile', { method: 'PUT', body: fields }]])
})
