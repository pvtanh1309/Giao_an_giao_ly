import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { clampLessonImageWidth } from '../lib/lesson-media.ts'
import { lessonEditorExtensions } from '../components/rich-text-extensions.ts'

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('lesson images default to 220px and preserve custom pixel widths', () => {
    assert.equal(clampLessonImageWidth(undefined), 220)
    assert.equal(clampLessonImageWidth(75), 75)
    assert.equal(clampLessonImageWidth(255), 255)
    assert.equal(clampLessonImageWidth(900), 900)
})

test('inline lesson images are responsive and expose accessible zoom activation', async () => {
    const extensions = await source('../components/rich-text-extensions.ts')
    const css = await source('../app/styles/rich-text.css')
    assert.match(extensions, /data-lesson-image-trigger/)
    assert.match(extensions, /aria-label/)
    assert.ok(lessonEditorExtensions.some((extension) => extension.name === 'image'))
    assert.match(extensions, /width:\s*\{\s*default:\s*220/)
    assert.match(css, /max-width:\s*100%/)
})

test('zoom dialog supports Escape, a labelled close button, and returns focus to its trigger', async () => {
    const component = await source('../components/lesson-image-lightbox.tsx')
    const editor = await source('../components/lesson-rich-text-editor.tsx')
    assert.match(component, /Escape/)
    assert.match(component, /event\.key === 'Tab'/)
    assert.match(component, /aria-label=.*(?:óng|lose)/i)
    assert.match(component, /triggerRef\.current\?\.focus\(/)
    assert.match(editor, /LessonImageLightbox/)
})
