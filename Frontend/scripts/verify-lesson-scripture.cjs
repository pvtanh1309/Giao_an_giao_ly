const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const contentData = read('lib/content-data.ts')
const page = read('app/page.tsx')
const lessonDialogs = read('components/lesson-dialogs.tsx')

assert.match(contentData, /scripture\?: string/, 'Lessons must store their own scripture text')
assert.match(contentData, /scriptureReference\?: string/, 'Lessons must store their own scripture reference')
assert.match(contentData, /defaultLessonScripture/, 'Existing lessons need a safe scripture fallback')
assert.match(page, /const \[editingScripture/, 'Inline lesson editing must keep a scripture draft')
assert.match(page, /scripture: editingScripture/, 'Saving a lesson must persist its scripture text')
assert.match(page, /scriptureReference: editingScriptureReference/, 'Saving a lesson must persist its scripture reference')
assert.match(lessonDialogs, /className="lesson-scripture"/, 'Scripture must appear at the top of the lesson page')
assert.match(lessonDialogs, /onEditingScriptureChange:/, 'Admins must be able to edit scripture in place')

console.log('Lesson scripture is stored per lesson, displayed first, and editable in place.')
