import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const browserIcon = new URL('../public/images/logo-thieu-nhi-icon-32.png', import.meta.url)
const highResolutionIcon = new URL('../public/images/logo-thieu-nhi-icon-180.png', import.meta.url)

test('uses the parish logo instead of the generated v0 icon in browser tabs', async () => {
  assert.match(layout, /url:\s*'\/images\/logo-thieu-nhi-icon-32\.png'/)
  assert.match(layout, /url:\s*'\/images\/logo-thieu-nhi-icon-180\.png'/)
  assert.match(layout, /apple:\s*'\/images\/logo-thieu-nhi-icon-180\.png'/)
  assert.doesNotMatch(layout, /url:\s*'\/icon\.svg'/)

  for (const [asset, size] of [[browserIcon, 32], [highResolutionIcon, 180]]) {
    assert.ok(existsSync(fileURLToPath(asset)), `expected logo icon ${asset.pathname}`)
    const image = await readFile(asset)
    assert.equal(image.toString('ascii', 1, 4), 'PNG')
    assert.equal(image.readUInt32BE(16), size)
    assert.equal(image.readUInt32BE(20), size)
  }
})
