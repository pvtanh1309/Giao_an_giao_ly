import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { canonicalLessonFieldText, createLessonNoteAnchor, resolveLessonNoteAnchor } from '../lib/lesson-note-anchors.ts'
const fixtures = JSON.parse(await readFile(new URL('../../Backend/tests/fixtures/lesson_note_anchors.json', import.meta.url), 'utf8'))
for (const fixture of fixtures) test(`Unicode anchor ${fixture.quote}`, async () => {
    const text = canonicalLessonFieldText(fixture.value)
    assert.equal(text, fixture.text)
    const anchor = await createLessonNoteAnchor('scripture', text, fixture.start, fixture.end)
    assert.equal(anchor.exactQuote, fixture.quote)
    assert.deepEqual(await resolveLessonNoteAnchor(text, anchor), { start: fixture.start, end: fixture.end })
    assert.equal(await resolveLessonNoteAnchor('changed', anchor), null)
})
test('context fallback only reattaches one unique quote and rejects duplicates', async () => {
    const anchor = await createLessonNoteAnchor('scripture', 'Trước Lời Chúa sau', 6, 13)
    assert.deepEqual(await resolveLessonNoteAnchor('Mới Trước Lời Chúa sau', anchor), { start: 10, end: 17 })
    assert.equal(await resolveLessonNoteAnchor('Trước Lời Chúa sau Trước Lời Chúa sau', anchor), null)
})
