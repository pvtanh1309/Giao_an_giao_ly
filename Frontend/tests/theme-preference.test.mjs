import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import {
    THEME_STORAGE_KEY,
    getThemeBootstrapScript,
    readThemePreference,
    resolveTheme,
    writeThemePreference,
} from '../lib/theme-preference.ts'

function createMemoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial))

    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null
        },
        setItem(key, value) {
            values.set(key, String(value))
        },
        removeItem(key) {
            values.delete(key)
        },
    }
}

test('reads only supported theme preferences and defaults missing or invalid values to system', () => {
    for (const preference of ['system', 'light', 'dark']) {
        assert.equal(readThemePreference(createMemoryStorage({ [THEME_STORAGE_KEY]: preference })), preference)
    }

    assert.equal(readThemePreference(createMemoryStorage()), 'system')
    assert.equal(readThemePreference(createMemoryStorage({ [THEME_STORAGE_KEY]: 'sepia' })), 'system')
})

test('resolves system preference while preserving explicit light and dark choices', () => {
    assert.equal(resolveTheme('system', true), 'dark')
    assert.equal(resolveTheme('system', false), 'light')
    assert.equal(resolveTheme('light', true), 'light')
    assert.equal(resolveTheme('dark', false), 'dark')
})

test('persists explicit preferences and removes storage when returning to system mode', () => {
    const storage = createMemoryStorage()

    writeThemePreference(storage, 'dark')
    assert.equal(storage.getItem(THEME_STORAGE_KEY), 'dark')
    assert.equal(readThemePreference(storage), 'dark')

    writeThemePreference(storage, 'system')
    assert.equal(storage.getItem(THEME_STORAGE_KEY), null)
    assert.equal(readThemePreference(storage), 'system')
})

test('storage failures fall back to system and do not prevent in-memory theme changes', () => {
    const throwingStorage = {
        getItem() { throw new Error('storage blocked') },
        setItem() { throw new Error('storage blocked') },
        removeItem() { throw new Error('storage blocked') },
    }

    assert.equal(readThemePreference(throwingStorage), 'system')
    assert.doesNotThrow(() => writeThemePreference(throwingStorage, 'dark'))
    assert.doesNotThrow(() => writeThemePreference(throwingStorage, 'system'))
})

function runThemeBootstrap({ storedPreference = null, systemPrefersDark = false, storageThrows = false }) {
    const classes = new Set()
    const document = {
        documentElement: {
            classList: {
                toggle(name, enabled) {
                    if (enabled) classes.add(name)
                    else classes.delete(name)
                },
            },
            style: {},
        },
    }
    const window = {
        matchMedia() {
            return { matches: systemPrefersDark }
        },
    }

    Object.defineProperty(window, 'localStorage', {
        get() {
            if (storageThrows) throw new Error('storage blocked')
            return { getItem: () => storedPreference }
        },
    })

    runInNewContext(getThemeBootstrapScript(), { window, document })
    return { isDark: classes.has('dark'), colorScheme: document.documentElement.style.colorScheme }
}

test('bootstrap applies saved light and dark themes before hydration', () => {
    assert.deepEqual(runThemeBootstrap({ storedPreference: 'light', systemPrefersDark: true }), {
        isDark: false,
        colorScheme: 'light',
    })
    assert.deepEqual(runThemeBootstrap({ storedPreference: 'dark', systemPrefersDark: false }), {
        isDark: true,
        colorScheme: 'dark',
    })
})

test('bootstrap follows the system when there is no explicit saved choice', () => {
    assert.deepEqual(runThemeBootstrap({ systemPrefersDark: false }), { isDark: false, colorScheme: 'light' })
    assert.deepEqual(runThemeBootstrap({ systemPrefersDark: true }), { isDark: true, colorScheme: 'dark' })
})

test('bootstrap falls back to the system when local storage throws', () => {
    assert.deepEqual(runThemeBootstrap({ systemPrefersDark: true, storageThrows: true }), {
        isDark: true,
        colorScheme: 'dark',
    })
})
