import { createMemoryNavigation, createNavigationScopes } from '../src'
import { describe, expect, it } from 'vitest'

describe('navigation scope', () => {
  it('does not mutate history when a scope begins', () => {
    const adapter = createMemoryNavigation('/a')

    const nav = createNavigationScopes({
      adapter,
    })

    nav.begin()

    expect(adapter.entries()).toHaveLength(1)
    expect(adapter.current().url).toBe('/a')
  })

  it('attaches a scope to pushed entries', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav = createNavigationScopes({
      adapter,
    })

    const scope = nav.begin()

    await scope.push('/b')
    await scope.push('/c')

    expect(adapter.entries().map((entry) => entry.url)).toEqual(['/a', '/b', '/c'])

    expect(scope.entries()).toHaveLength(2)

    expect(scope.entries().map((entry) => entry.url)).toEqual(['/b', '/c'])
  })

  it('keeps the same entry key when replacing', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav = createNavigationScopes({
      adapter,
    })

    const scope = nav.begin()

    await scope.push('/b')

    const before = adapter.current().key

    await scope.replace('/c')

    expect(adapter.current().url).toBe('/c')

    expect(adapter.current().key).toBe(before)
  })
})
