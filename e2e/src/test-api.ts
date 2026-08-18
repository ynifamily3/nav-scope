import { createNavigationApiNavigation, createNavigationScopes } from 'nav-scope'

import type { NavigationApiTarget, NavigationEntry, NavigationScope } from 'nav-scope'

export interface ScopeSnapshot {
  readonly id: string
  readonly anchorKey: string

  readonly canBack: boolean
  readonly canForward: boolean

  readonly entries: readonly NavigationEntry[]
}

export interface TestSnapshot {
  readonly current: NavigationEntry

  readonly entries: readonly NavigationEntry[]

  readonly scope: ScopeSnapshot | undefined
}

export interface NavScopeTestApi {
  snapshot(): TestSnapshot

  subscribe(listener: () => void): () => void

  begin(): TestSnapshot

  push(url: string): Promise<TestSnapshot>

  replace(url: string): Promise<TestSnapshot>

  back(): Promise<{
    readonly moved: boolean
    readonly snapshot: TestSnapshot
  }>

  forward(): Promise<{
    readonly moved: boolean
    readonly snapshot: TestSnapshot
  }>

  exit(): Promise<TestSnapshot>
}

export function createTestApi(): NavScopeTestApi {
  const adapter = createNavigationApiNavigation()

  const nav = createNavigationScopes({
    adapter,
  })

  /**
   * begin() 자체는 history를 변경하지 않으므로
   * 첫 scoped navigation 전까지만
   * runtime handle이 필요하다.
   */
  let pendingScope: NavigationScope<NavigationApiTarget> | undefined

  const resolveScope = () => {
    return pendingScope ?? nav.current()
  }

  const snapshot = (): TestSnapshot => {
    const scope = resolveScope()

    return {
      current: adapter.current(),

      entries: adapter.entries(),

      scope: scope
        ? {
            id: scope.id,
            anchorKey: scope.anchorKey,

            canBack: scope.canBack,
            canForward: scope.canForward,

            entries: scope.entries(),
          }
        : undefined,
    }
  }

  const getScope = () => {
    const scope = resolveScope()

    if (!scope) {
      throw new Error('No navigation scope has been started.')
    }

    return scope
  }

  return {
    snapshot,

    subscribe(listener) {
      return nav.subscribe(listener)
    },

    begin() {
      pendingScope = nav.begin()

      return snapshot()
    },

    async push(url) {
      const scope = getScope()

      await scope.push(url)

      pendingScope = undefined

      return snapshot()
    },

    async replace(url) {
      const scope = getScope()

      await scope.replace(url)

      pendingScope = undefined

      return snapshot()
    },

    async back() {
      const moved = await getScope().back()

      return {
        moved,
        snapshot: snapshot(),
      }
    },

    async forward() {
      const moved = await getScope().forward()

      return {
        moved,
        snapshot: snapshot(),
      }
    },

    async exit() {
      const scope = getScope()

      await scope.exit()

      pendingScope = undefined

      return snapshot()
    },
  }
}
