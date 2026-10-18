import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const siteStyles = readFileSync(new URL('../app/styles/site-base.css', import.meta.url), 'utf8')
const heroStyles = readFileSync(new URL('../app/styles/hero.css', import.meta.url), 'utf8')
const contentStyles = readFileSync(new URL('../app/styles/content.css', import.meta.url), 'utf8')
const themeStyles = readFileSync(new URL('../app/styles/theme.css', import.meta.url), 'utf8')
const dialogsStyles = readFileSync(new URL('../app/styles/dialogs.css', import.meta.url), 'utf8')
const accountsStyles = readFileSync(new URL('../app/styles/accounts.css', import.meta.url), 'utf8')
const personalProfileStyles = readFileSync(new URL('../app/styles/personal-profile.css', import.meta.url), 'utf8')
const authStyles = readFileSync(new URL('../app/styles/auth.css', import.meta.url), 'utf8')
const passwordStyles = readFileSync(new URL('../app/styles/password-input.css', import.meta.url), 'utf8')
const richTextStyles = readFileSync(new URL('../app/styles/rich-text.css', import.meta.url), 'utf8')
const lessonReadingStyles = readFileSync(new URL('../app/styles/lesson-reading.css', import.meta.url), 'utf8')
const programReadingStyles = readFileSync(new URL('../app/styles/program-reading.css', import.meta.url), 'utf8')
const referenceReadingStyles = readFileSync(new URL('../app/styles/reference-reading.css', import.meta.url), 'utf8')
const programScheduleEditor = readFileSync(new URL('../components/program-schedule-editor.tsx', import.meta.url), 'utf8')
const siteHeader = readFileSync(new URL('../components/site-header.tsx', import.meta.url), 'utf8')
const loginScreen = readFileSync(new URL('../components/auth-screen.tsx', import.meta.url), 'utf8')

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
    assert.ok(loginScreen.includes('parish-logo-image'), 'show the parish logo in the login brand')
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

test('the theme toggle sits beside the account menu in the header actions', () => {
    assert.ok(/className="header-actions">[\s\S]*?<ThemeToggle\s*\/>[\s\S]*?<AccountMenu/.test(siteHeader), 'place the theme control beside the account menu')
})

test('the theme toggle has a localized label and announces whether dark mode is pressed', () => {
    const togglePath = new URL('../components/theme-toggle.tsx', import.meta.url)
    assert.ok(existsSync(togglePath), 'provide the theme toggle component')
    const themeToggle = readFileSync(togglePath, 'utf8')

    assert.ok(themeToggle.includes("const label = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"), 'describe the next theme in Vietnamese')
    assert.match(themeToggle, /aria-label=\{label\}/, 'use the localized label for screen readers')
    assert.match(themeToggle, /aria-pressed=\{theme === 'dark'\}/, 'expose the active dark theme state')
})

test('the theme toggle uses the shared visible keyboard focus style', () => {
    assert.match(themeStyles, /:focus-visible\s*\{[^}]*outline:\s*2px solid/s, 'show a visible keyboard focus outline')
})

test('dark mode defines a dark native color scheme and overrides shared palette tokens', () => {
    const darkPalette = themeStyles.match(/\.dark\s*\{([^}]*)\}/s)?.[1] ?? ''
    assert.match(darkPalette, /color-scheme:\s*dark/)

    for (const token of ['ink', 'muted', 'cream', 'paper', 'line', 'blue', 'blue-deep', 'gold', 'wine', 'surface-blue', 'surface-rose']) {
        assert.match(darkPalette, new RegExp(`--${token}:\\s*#[0-9a-f]{6}`, 'i'), `override --${token} for dark mode`)
    }
})

test('header, search, and search-result surfaces follow dark theme tokens', () => {
    assert.match(siteStyles, /\.topbar\s*\{[^}]*background:\s*var\(--paper\)/s, 'use the page paper token for the sticky header')
    assert.match(contentStyles, /\.directory-search\s*\{[^}]*background:\s*var\(--paper\)/s, 'keep the directory search on the paper token')
    assert.match(themeStyles, /\.dark\s+\.lesson-search-result:hover\s*\{[^}]*background:\s*var\(--paper\)/s, 'avoid a light hover surface in dark mode')
    assert.match(themeStyles, /\.dark\s+\.nav-link(?:\.active|:hover)/, 'give active navigation a readable dark-mode color')
})

test('dark mode themes dialogs, account menus, forms, and semantic account statuses', () => {
    assert.match(dialogsStyles, /\.dark\s+\.modal-card(?:,|\s*\{)/, 'theme the modal surface')
    assert.match(accountsStyles, /\.dark\s+\.account-tools\s*\{/, 'theme the account filter surface')
    assert.match(accountsStyles, /\.dark\s+\.account-status\.active\s*\{/, 'retain readable success status colors')
    assert.match(personalProfileStyles, /\.dark\s+\.account-menu-trigger(?:,|\s*\{)/, 'theme the account menu trigger')
    assert.match(authStyles, /\.dark\s+\.auth-form\s+input\s*\{/, 'theme login inputs')
    assert.match(passwordStyles, /\.dark\s+\.password-visibility-toggle:focus-visible\s*\{/, 'keep password control focus visible')
})

test('rich-text chrome follows the theme while the editable canvas and authored colors stay on paper', () => {
    assert.match(richTextStyles, /\.dark\s+\.rich-text-toolbar\s*\{[^}]*background:\s*var\(--paper\)/s, 'theme the editor toolbar')
    assert.match(richTextStyles, /\.rich-text-editor\.is-editable\s+\.rich-text-content\s*\{[^}]*background:\s*var\(--lesson-paper\)/s, 'keep the editor canvas on warm paper')
    assert.match(richTextStyles, /\.rich-text-content\s+\.tiptap\s*\{[^}]*color:\s*#000000/s, 'keep the paper canvas default text black')
    assert.doesNotMatch(richTextStyles, /\.dark\s+\[style(?:[^\]]*)\]/, 'do not recolor authored inline styles')
})

test('dark mode themes reading chrome, reference lists, and schedule editing controls', () => {
    assert.match(lessonReadingStyles, /\.dark\s+\.lesson-draft-notice\s*\{/, 'theme the lesson draft notice')
    assert.match(programReadingStyles, /\.dark\s+\.schedule-column-dialog\s+input(?:,|\s*\{)/, 'theme program schedule dialog controls')
    assert.match(referenceReadingStyles, /\.dark\s+\.reference-list-item\s*\{/, 'theme reference directory rows')
    assert.match(programReadingStyles, /\.dark\s+\.program-reading-page\s+\.schedule-table\s*\{[^}]*background:\s*var\(--lesson-paper\)/s, 'keep schedule cells on the warm paper canvas')
})

test('reading papers, schedule content, and print canvases are not recolored for dark mode', () => {
    assert.match(lessonReadingStyles, /\.lesson-reading-paper,\s*\.program-reading-paper\s*\{[^}]*background:\s*#fffdf8/s)
    assert.match(referenceReadingStyles, /\.reference-reading-paper\s*\{[^}]*background:\s*#fffdf8/s)
    assert.match(programReadingStyles, /\.program-schedule-cell-content\s*\{[^}]*color:\s*#000000/s)

    const readingStyles = `${lessonReadingStyles}\n${programReadingStyles}\n${referenceReadingStyles}`
    assert.doesNotMatch(readingStyles, /\.dark\s+[^{}]*\.(?:lesson-reading-paper|program-reading-paper|reference-reading-paper|program-schedule-cell-content)/, 'leave paper and authored schedule content unchanged')
})
