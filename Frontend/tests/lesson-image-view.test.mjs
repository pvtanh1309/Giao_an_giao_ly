import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { clampLessonImageWidth, lessonImageWidths } from '../lib/lesson-media.ts'
import { lessonEditorExtensions } from '../components/rich-text-extensions.ts'

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('lesson images default to 220px and stay within supported size choices', () => {
    assert.deepEqual(lessonImageWidths, [140, 220, 320])
    assert.equal(clampLessonImageWidth(undefined), 220)
    assert.equal(clampLessonImageWidth(75), 140)
    assert.equal(clampLessonImageWidth(255), 220)
    assert.equal(clampLessonImageWidth(900), 320)
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
