import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const indicator = await readFile(new URL('../components/loading-indicator.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../app/styles/loading-indicator.css', import.meta.url), 'utf8')
const doveAsset = new URL('../public/images/loading-dove.png', import.meta.url)

test('uses the transparent photo dove with seven widening, animated light beams', () => {
    assert.match(indicator, /<image className="dove-loading-bird" href="\/images\/loading-dove\.png"/)
    assert.ok(existsSync(fileURLToPath(doveAsset)), 'the transparent dove asset should be included in public images')
    const rays = [...indicator.matchAll(/<g className="dove-loading-ray">([\s\S]*?)<\/g>/g)]
    assert.equal(rays.length, 7)
    assert.ok(rays.every(([, ray]) => /className="dove-loading-ray-aura"[^>]*d="M[^\"]*C[^\"]*A7 7[^\"]*C[^\"]*Z"/.test(ray)
      && /className="dove-loading-ray-core"[^>]*d="M[^\"]*C[^\"]*A3\.1 3\.1[^\"]*C[^\"]*Z"/.test(ray)), 'each light beam should curve into a broad, rounded end with a bright narrow core')
    assert.match(indicator, /<g className="dove-loading-rays" fill="currentColor">/)
    assert.match(styles, /\.dove-loading-ray\s*\{[^}]*opacity:\s*0[^}]*animation:\s*dove-loading-ray-glow 1\.68s/s)
    assert.match(styles, /\.dove-loading-ray-aura\s*\{[^}]*opacity:\s*\.46[^}]*filter:\s*blur\(2px\)/s)
    assert.match(styles, /filter:\s*drop-shadow\(0 0 6px currentColor\)/)
})

test('flaps both wings from the same dove image and keeps the beams animated', () => {
    const wings = [...indicator.matchAll(/className="dove-loading-wing dove-loading-wing--(?:left|right)"/g)]
    assert.equal(wings.length, 2)
    assert.equal([...indicator.matchAll(/href="\/images\/loading-dove\.png"/g)].length, 3)
    assert.match(styles, /\.dove-loading-wing--left\s*\{[^}]*animation:\s*dove-loading-wing-flap-left/s)
    assert.match(styles, /\.dove-loading-wing--right\s*\{[^}]*animation:\s*dove-loading-wing-flap-right/s)
    assert.match(styles, /@keyframes\s+dove-loading-wing-flap-left/)
    assert.match(styles, /@keyframes\s+dove-loading-wing-flap-right/)
    assert.doesNotMatch(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.dove-loading-ray\s*\{[^}]*animation:\s*none/s)
})

test('reveals the dove before the delayed light beams begin their sequence', () => {
    assert.match(styles, /\.dove-loading-rays\s*\{[^}]*opacity:\s*0[^}]*animation:\s*dove-loading-rays-appear[^}]*\.32s/s)
    assert.match(styles, /\.dove-loading-ray:nth-child\(1\)\s*\{\s*animation-delay:\s*\.35s;/)
    assert.match(styles, /\.dove-loading-ray:nth-child\(7\)\s*\{\s*animation-delay:\s*1\.79s;/)
    assert.match(styles, /@keyframes\s+dove-loading-ray-glow\s*\{\s*0%\s*\{[^}]*opacity:\s*0/s)
})
