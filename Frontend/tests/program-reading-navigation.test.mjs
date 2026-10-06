import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../components/program-reading-page.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/styles/program-reading.css', import.meta.url), 'utf8')

test('program detail offers an obvious back action to the current sublevel or industry', () => {
    assert.match(page, /program\.sublevel\s*\?\s*`Quay lại phân ngành \$\{program\.sublevel\}`\s*:\s*`Quay lại ngành \$\{program\.level\}`/)
    assert.match(page, /className="secondary-button program-back-button"/)
    assert.match(app, /const openProgram = \(program: Program\) => \{[\s\S]*window\.scrollTo\(\{ top: 0/)
    assert.match(app, /onBack=\{\(\) => returnToList\('programId'\)\}/)
    assert.match(app, /searchParams\.delete\(parameter\)/)
    assert.match(styles, /\.program-back-button\s*\{[^}]*border-radius:/s)
})
