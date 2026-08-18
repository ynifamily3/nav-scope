import { createMemoryNavigation, createNavigationScopes } from '../src'
import { describe, expect, it } from 'vitest'

describe('scope reconstruction', () => {
  it('returns undefined when the current entry is outside a scope', () => {
    const adapter = createMemoryNavigation('/a')

    const nav = createNavigationScopes({
      adapter,
    })

    expect(nav.current()).toBeUndefined()

    expect(nav.scopes()).toEqual([])
  })

  it('reconstructs the current scope from entry metadata', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav1 = createNavigationScopes({
      adapter,
    })

    const scope = nav1.begin()

    await scope.push('/b')
    await scope.push('/c')

    /**
     * 새로운 JS runtime을 흉내 낸다.
     *
     * 기존 NavigationScope 객체를
     * nav2에는 전달하지 않는다.
     */
    const nav2 = createNavigationScopes({
      adapter,
    })

    const restored = nav2.current()

    expect(restored).toBeDefined()

    expect(restored?.id).toBe(scope.id)

    expect(restored?.anchorKey).toBe(scope.anchorKey)

    expect(restored?.entries().map((entry) => entry.url)).toEqual(['/b', '/c'])
  })

  it('can exit using a reconstructed scope', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav1 = createNavigationScopes({
      adapter,
    })

    const scope = nav1.begin()

    await scope.push('/b')
    await scope.push('/c')

    const nav2 = createNavigationScopes({
      adapter,
    })

    const restored = nav2.current()

    expect(restored).toBeDefined()

    await restored?.exit()

    expect(adapter.current().url).toBe('/a')

    expect(nav2.current()).toBeUndefined()
  })

  it('reconstructs nested scopes in outer-to-inner order', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav1 = createNavigationScopes({
      adapter,
    })

    const outer = nav1.begin({
      kind: 'exploration',
    })

    await outer.push('/b')
    await outer.push('/c')

    const inner = outer.begin({
      kind: 'dialog',
    })

    await inner.push('/d')
    await inner.push('/e')

    const nav2 = createNavigationScopes({
      adapter,
    })

    const restored = nav2.scopes()

    expect(restored).toHaveLength(2)

    expect(restored[0]?.id).toBe(outer.id)

    expect(restored[1]?.id).toBe(inner.id)

    expect(restored[1]?.parent?.id).toBe(outer.id)

    expect(nav2.current()?.id).toBe(inner.id)
  })

  it('restores the parent scope after the child scope exits', async () => {
    const adapter = createMemoryNavigation('/a')

    const nav1 = createNavigationScopes({
      adapter,
    })

    const outer = nav1.begin()

    await outer.push('/b')
    await outer.push('/c')

    const inner = outer.begin()

    await inner.push('/d')
    await inner.push('/e')

    /**
     * runtime 재생성
     */
    const nav2 = createNavigationScopes({
      adapter,
    })

    expect(nav2.current()?.id).toBe(inner.id)

    await nav2.current()?.exit()

    expect(adapter.current().url).toBe('/c')

    /**
     * 현재 entry가 /c로 바뀌었기 때문에
     * metadata 역시 [outer]만 존재한다.
     */
    expect(nav2.current()?.id).toBe(outer.id)

    expect(nav2.scopes()).toHaveLength(1)

    await nav2.current()?.exit()

    expect(adapter.current().url).toBe('/a')

    expect(nav2.current()).toBeUndefined()
  })
})
