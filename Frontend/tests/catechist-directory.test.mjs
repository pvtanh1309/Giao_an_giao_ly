import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const directory = readFileSync(new URL('../components/catechist-directory.tsx', import.meta.url), 'utf8')
const data = readFileSync(new URL('../lib/content-data.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/styles/catechist-cards.css', import.meta.url), 'utf8')

test('catechist directory reveals contact fields only for the expanded name', () => {
    assert.match(directory, /useState<string\s*\|\s*null>/)
    assert.match(directory, /aria-expanded=\{expandedCatechistEmail === catechist\.email\}/)
    assert.match(directory, /expandedCatechistEmail === catechist\.email[\s\S]*catechist\.phone[\s\S]*catechist\.email/)
    assert.match(directory, /Lớp chủ nhiệm/)
    assert.match(directory, /Lớp đồng hành/)
    assert.match(data, /homeroomClass:\s*string/)
    assert.match(data, /accompanyingClass:\s*string/)
})

test('catechist directory uses a neon-inspired background while keeping class details neutral', () => {
    assert.match(styles, /\.catechists-section\s*\{[^}]*linear-gradient/i)
    assert.match(styles, /\.catechist-name-button\s*\{[^}]*#(?:[0-9a-f]{3,8})/i)
    assert.match(styles, /\.catechist-info>span\s*\{[^}]*color:\s*(?:var\(--muted\)|#[0-9a-f]{3,8})/i)
    assert.match(styles, /\.catechist-card\s*\{[^}]*background:\s*(?:rgba\(255, 255, 255|var\(--paper\))/i)
})
