import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

function collectCss(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return collectCss(path)
        return entry.name.endsWith('.css') ? [readFileSync(path, 'utf8')] : []
    }).join('\n')
}

const buildCssDirectory = fileURLToPath(new URL('../.next/static', import.meta.url))
const hasBuildCss = existsSync(buildCssDirectory)
const buildCss = hasBuildCss ? collectCss(buildCssDirectory) : ''
const lessonReadingStyles = readFileSync(new URL('../app/styles/lesson-reading.css', import.meta.url), 'utf8')
const richTextStyles = readFileSync(new URL('../app/styles/rich-text.css', import.meta.url), 'utf8')
const programReadingStyles = readFileSync(new URL('../app/styles/program-reading.css', import.meta.url), 'utf8')

test('lesson and program reading surfaces use the bundled Vietnamese font by default', () => {
    assert.match(lessonReadingStyles, /\.lesson-reading-paper\s*\{[^}]*font(?:-family)?[^}]*var\(--font-sans\)/s)
    assert.match(richTextStyles, /\.rich-text-content \.tiptap\s*\{[^}]*font(?:-family)?[^}]*var\(--font-sans\)/s)
    assert.match(programReadingStyles, /\.program-schedule-cell-content\s*\{[^}]*font-family:\s*var\(--font-sans\)/s)
})

for (const family of ['Be Vietnam Pro', 'Fraunces', 'Playfair Display']) {
    test(`${family} includes the Vietnamese tone-mark glyph range in the built CSS`, { skip: !buildCss }, () => {
        const fontFaces = [...buildCss.matchAll(/@font-face\s*\{([^}]+)\}/g)]
            .map(([, face]) => face)
            .filter((face) => face.includes(`font-family:${family};`))

        assert.ok(fontFaces.some((face) => /unicode-range:[^;}]*U\+1EA0-1EF9/i.test(face)), `${family} must contain Vietnamese-specific vowels and tone marks`)
    })
}
