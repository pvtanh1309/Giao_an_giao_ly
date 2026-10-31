import assert from 'node:assert/strict'
import test from 'node:test'
import { getPageDataPlan } from '../lib/page-data-plan.ts'

test('loads only the catalog needed by the active page', () => {
    assert.deepEqual(getPageDataPlan('overview', false, null), { primaryCatalog: 'lessons', loadReferences: false })
    assert.deepEqual(getPageDataPlan('lessons', false, null), { primaryCatalog: 'lessons', loadReferences: false })
    assert.deepEqual(getPageDataPlan('programs', false, null), { primaryCatalog: 'programs', loadReferences: false })
    assert.deepEqual(getPageDataPlan('catechists', false, null), { primaryCatalog: null, loadReferences: false })
    assert.deepEqual(getPageDataPlan('accounts', false, null), { primaryCatalog: null, loadReferences: false })
})

test('loads a detail directly without first fetching its full catalog', () => {
    assert.deepEqual(getPageDataPlan('lessons', false, null, 'lesson-1'), { primaryCatalog: null, loadReferences: false })
    assert.deepEqual(getPageDataPlan('programs', false, null, null, 'program-1'), { primaryCatalog: null, loadReferences: false })
})

test('loads reference documents only while the lesson reference library is open', () => {
    assert.deepEqual(getPageDataPlan('lessons', true, null), { primaryCatalog: null, loadReferences: true })
    assert.deepEqual(getPageDataPlan('lessons', true, 'reference-1'), { primaryCatalog: null, loadReferences: false })
    assert.deepEqual(getPageDataPlan('programs', true, 'reference-1'), { primaryCatalog: 'programs', loadReferences: false })
})
