import { createMemoryNavigation, createNavigationScopes } from '../src'
import { describe, expect, it } from 'vitest'

describe('scope traversal', () => {
  it('moves backward inside a scope', async () => {
    const adapter = createMemoryNavigation('/a')

    const scope = createNavigationScopes({
      adapter,
    }).begin()

    await scope.push('/b')
    await scope.push('/c')

    const moved = await scope.back()

    expect(moved).toBe(true)
    expect(adapter.current().url).toBe('/b')
  })

  it('does not back past the scope anchor', async () => {
    const adapter = createMemoryNavigation('/a')

    const scope = createNavigationScopes({
      adapter,
    }).begin()

    await scope.push('/b')

    const moved = await scope.back()

    expect(moved).toBe(false)

    expect(adapter.current().url).toBe('/b')
  })

  it('exits directly to the scope anchor', async () => {
    const adapter = createMemoryNavigation('/a')

    const scope = createNavigationScopes({
      adapter,
    }).begin()

    await scope.push('/b')
    await scope.push('/c')
    await scope.push('/d')

    await scope.exit()

    expect(adapter.current().url).toBe('/a')
  })

  it('can forward back into a scope after exit', async () => {
    const adapter = createMemoryNavigation('/a')

    const scope = createNavigationScopes({
      adapter,
    }).begin()

    await scope.push('/b')
    await scope.push('/c')

    await scope.exit()

    expect(scope.canForward).toBe(true)

    const moved = await scope.forward()

    expect(moved).toBe(true)
    expect(adapter.current().url).toBe('/b')
  })
})
