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

  let scope: NavigationScope<NavigationApiTarget> | undefined

  const snapshot = (): TestSnapshot => ({
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
  })

  const getScope = () => {
    if (!scope) {
      throw new Error('No navigation scope has been started.')
    }

    return scope
  }

  return {
    snapshot,

    begin() {
      scope = nav.begin()

      return snapshot()
    },

    async push(url) {
      await getScope().push(url)

      return snapshot()
    },

    async replace(url) {
      await getScope().replace(url)

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
      await getScope().exit()

      return snapshot()
    },
  }
}
