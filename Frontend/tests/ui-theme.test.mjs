import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const siteStyles = readFileSync(new URL('../app/styles/site-base.css', import.meta.url), 'utf8')
const heroStyles = readFileSync(new URL('../app/styles/hero.css', import.meta.url), 'utf8')
const contentStyles = readFileSync(new URL('../app/styles/content.css', import.meta.url), 'utf8')
const programScheduleEditor = readFileSync(new URL('../components/program-schedule-editor.tsx', import.meta.url), 'utf8')
const siteHeader = readFileSync(new URL('../components/site-header.tsx', import.meta.url), 'utf8')
const loginPage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')

test('the site theme defines colorful accents without replacing the parish palette', () => {
    assert.ok(/--accent-teal:\s*#287A86/i.test(siteStyles), 'define the teal accent token')
    assert.ok(/--accent-coral:\s*#AC5A62/i.test(siteStyles), 'define the coral accent token')
})

test('the overview uses soft color washes and its content cards respond to hover', () => {
    assert.ok(/radial-gradient\([^;]+--accent-teal-rgb/s.test(heroStyles), 'add a teal hero wash')
    assert.ok(/\.lesson-card:hover[\s\S]*?transform:\s*translateY\(-\d+px\)/.test(contentStyles), 'lift lesson cards on hover')
    assert.ok(/\.program-category-card:hover[\s\S]*?transform:/.test(contentStyles), 'move program cards on hover')
})

test('the outer page background has no repeating decorative pattern', () => {
    assert.ok(!/\.site-shell::before/.test(siteStyles), 'leave the outer background free of the rejected ornament')
})

test('directory search frames have soft rounded corners', () => {
    assert.match(contentStyles, /\.directory-search\s*\{[^}]*border-radius:\s*(?:\d+px|\d+%)/s)
})

test('decorative motion is disabled for users who prefer reduced motion', () => {
    assert.ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(contentStyles), 'respect reduced-motion preference')
})

test('the parish youth logo is shown in the site header and login brand', () => {
    assert.ok(siteHeader.includes('parish-logo-image'), 'show the parish logo in the navigation brand')
    assert.ok(loginPage.includes('parish-logo-image'), 'show the parish logo in the login brand')
})

test('the parish youth logo is stored as a local public asset', () => {
    assert.ok(existsSync(new URL('../public/images/logo-thieu-nhi.jpg', import.meta.url)), 'include the approved logo asset')
})

test('directory search boxes can grow to 500px while remaining fluid on mobile', () => {
    assert.ok(/\.directory-search\s*\{[^}]*width:\s*min\(100%,\s*500px\)/s.test(contentStyles), 'allow desktop search boxes to grow to 500px')
    assert.ok(/\.section-heading-actions\s*\{[^}]*flex:\s*1/s.test(contentStyles), 'let directory actions use the available heading width')
    assert.ok(/\.directory-search\s*\{[^}]*flex:\s*1 1 500px/s.test(contentStyles), 'let the desktop search fill the available heading width')
    assert.ok(/@media\s*\(max-width:\s*800px\)[\s\S]*?\.directory-search\s*\{[^}]*flex:\s*1 1 240px/s.test(readFileSync(new URL('../app/styles/auth.css', import.meta.url), 'utf8')), 'keep search boxes fluid on mobile')
})

test('program schedule column actions use in-app dialogs instead of browser prompts', () => {
    assert.ok(!/window\.(prompt|confirm|alert)\s*\(/.test(programScheduleEditor), 'avoid browser-native dialogs')
    assert.ok(/role="dialog"[^>]*aria-modal="true"/.test(programScheduleEditor), 'show an accessible in-app dialog')
    assert.ok(/Thêm cột mới/.test(programScheduleEditor), 'label the new-column dialog clearly')
})
