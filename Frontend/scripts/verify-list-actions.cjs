const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const lessonDialogs = read('components/lesson-dialogs.tsx')
const programDirectory = read('components/program-directory.tsx')
const page = read('app/page.tsx')

assert.doesNotMatch(lessonDialogs, /onEditLesson/, 'Lesson list must not expose an edit action')
assert.doesNotMatch(programDirectory, /onEdit:/, 'Program list must not expose an edit action')
assert.doesNotMatch(programDirectory, /<Pencil size=\{14\}/, 'Program list must not render an edit button')
assert.doesNotMatch(page, /onEdit=\{beginProgramEdit\}/, 'Page must not wire editing through the program list')

console.log('Lists expose no edit action; editing remains inside detail views.')
