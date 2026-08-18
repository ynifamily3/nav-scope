import { createMemoryNavigation, createNavigationScopes } from '../src'
import { describe, expect, it } from 'vitest'

describe('nested scopes', () => {
  it('restores the parent scope when a child exits', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav = createNavigationScopes({
      adapter,
    })

    const outer = nav.begin({
      kind: 'exploration',
    })

    await outer.push('/b')
    await outer.push('/c')

    const inner = outer.begin({
      kind: 'dialog',
    })

    await inner.push('/d')
    await inner.push('/e')

    expect(adapter.current().navScope?.scopes.map((scope) => scope.id)).toEqual([
      outer.id,
      inner.id,
    ])

    await inner.exit()

    expect(adapter.current().url).toBe('/c')

    await outer.exit()

    expect(adapter.current().url).toBe('/a')
  })

  it('propagates parent scope metadata into child entries', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav = createNavigationScopes({
      adapter,
    })

    const outer = nav.begin()

    await outer.push('/b')

    const inner = outer.begin()

    await inner.push('/c')

    expect(adapter.current().navScope?.scopes).toEqual([
      expect.objectContaining({
        id: outer.id,
      }),

      expect.objectContaining({
        id: inner.id,
        parentScopeId: outer.id,
      }),
    ])
  })
})
