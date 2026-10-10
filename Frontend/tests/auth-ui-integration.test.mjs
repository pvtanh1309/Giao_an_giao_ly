import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('root layout installs the client provider composition', async () => {
    const [layout, providers] = await Promise.all([
        source('../app/layout.tsx'),
        source('../app/providers.tsx'),
    ])
    assert.match(layout, /<Providers>/)
    assert.match(providers, /<AuthProvider>/)
    assert.match(providers, /['"]use client['"]/)
})

test('application page consumes auth context for loading, user role, screen, and logout', async () => {
    const page = await source('../app/page.tsx')
    assert.match(page, /useAuth\s*\(\s*\)/)
    assert.match(page, /status\s*===\s*['"]loading['"]/) 
    assert.match(page, /<AuthScreen\s*\/>/)
    assert.match(page, /const currentUser\s*=\s*user\.role/)
    assert.match(page, /onLogout=\{logout\}/)
})

test('auth forms clear passwords in finally and block transitional double submits', async () => {
    const screen = await source('../components/auth-screen.tsx')
    assert.match(screen, /finally\s*\{[^}]*setPassword\(['"]['"]\)/s)
    assert.match(screen, /finally\s*\{[^}]*setNewPassword\(['"]['"]\)[^}]*setConfirmation\(['"]['"]\)/s)
    assert.match(screen, /const\s+submitting\s*=\s*status\s*===\s*['"]authenticating['"]/)
    assert.ok((screen.match(/disabled=\{submitting \|\| systemUnavailable\}/g) ?? []).length >= 2)
})

test('demo credentials and sessionStorage authentication are fully removed', async () => {
    const files = await Promise.all([
        source('../app/page.tsx'),
        source('../components/auth-screen.tsx'),
        source('../components/auth-provider.tsx'),
    ])
    const combined = files.join('\n')
    assert.doesNotMatch(combined, /giao-ly-user|sessionStorage|user@gmail\.com|reader@gmail\.com|editor@gmail\.com|admin@gmail\.com/)
    assert.doesNotMatch(combined, /setCurrentUser|demo-accounts/)
})

test('header owns the shared auth role type and production builds check TypeScript', async () => {
    const [header, config] = await Promise.all([
        source('../components/site-header.tsx'),
        source('../next.config.mjs'),
    ])
    assert.match(header, /import type \{ AppRole \} from ['"]\.\.\/lib\/auth\/types['"]/)
    assert.doesNotMatch(config, /ignoreBuildErrors/)
})
