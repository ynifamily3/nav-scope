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

  /**
   * begin() 직후에는 아직 history entry에
   * scope metadata가 존재하지 않는다.
   *
   * 첫 scoped navigation 전까지만
   * 임시 handle을 유지한다.
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

    begin() {
      pendingScope = nav.begin()

      return snapshot()
    },

    async push(url) {
      const scope = getScope()

      await scope.push(url)

      /**
       * 첫 push 이후 scope metadata는
       * current history entry에서 복원 가능하다.
       */
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
