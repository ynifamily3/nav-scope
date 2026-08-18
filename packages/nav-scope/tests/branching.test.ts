import { createMemoryNavigation, createNavigationScopes } from '../src'
import { describe, expect, it } from 'vitest'

describe('history branching', () => {
  it('disposes forward entries when pushing from an earlier entry', async () => {
    const adapter = createMemoryNavigation('/a')

    const scope = createNavigationScopes({
      adapter,
    }).begin()

    await scope.push('/b')
    await scope.push('/c')
    await scope.push('/d')

    // /a → /b → /c → /d
    //             ↑
    const c = adapter.entries()[2]

    expect(c).toBeDefined()

    await adapter.traverseTo(c!.key).finished

    // /c에서 새로운 branch 생성
    await scope.push('/e')

    expect(adapter.entries().map((entry) => entry.url)).toEqual(['/a', '/b', '/c', '/e'])
  })
})
