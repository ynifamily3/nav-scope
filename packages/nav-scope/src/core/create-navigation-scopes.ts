import { createNavigationScheduler } from './scheduler'

import type { NavigationScheduler } from './scheduler'

import type {
  EntryKey,
  NavigationAdapter,
  NavigationEntry,
  NavigationScope,
  NavigationScopeManager,
  NavScopeEntryMetadata,
  ScopeFrame,
  ScopeId,
  ScopeOptions,
} from './types'

interface CreateNavigationScopesOptions<TTarget> {
  readonly adapter: NavigationAdapter<TTarget>
}

export function createNavigationScopes<TTarget>({
  adapter,
}: CreateNavigationScopesOptions<TTarget>): NavigationScopeManager<TTarget> {
  /**
   * Scope마다 하나가 아니라
   * manager 전체가 하나의 scheduler를 공유한다.
   *
   * 그래야 nested scope끼리 navigation이
   * 경쟁하지 않는다.
   */
  const scheduler = createNavigationScheduler()

  const createNewScope = (
    anchorKey: EntryKey,
    parent: NavigationScopeImpl<TTarget> | undefined,
    options: ScopeOptions,
  ): NavigationScopeImpl<TTarget> => {
    const id = options.id ?? createScopeId()

    const frame: ScopeFrame = {
      id,
      anchorKey,

      ...(parent
        ? {
            parentScopeId: parent.id,
          }
        : {}),

      ...(options.kind
        ? {
            kind: options.kind,
          }
        : {}),

      ...(options.label
        ? {
            label: options.label,
          }
        : {}),
    }

    const scopePath = parent ? [...parent.scopePath, frame] : [frame]

    return new NavigationScopeImpl({
      adapter,
      scheduler,
      frame,
      scopePath,
      parent,
      createScope: createNewScope,
    })
  }

  const reconstructScopes = (frames: readonly ScopeFrame[]): NavigationScopeImpl<TTarget>[] => {
    const scopes: NavigationScopeImpl<TTarget>[] = []

    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index]

      if (!frame) {
        continue
      }

      const parent = scopes[scopes.length - 1]

      const scopePath = frames.slice(0, index + 1)

      scopes.push(
        new NavigationScopeImpl({
          adapter,
          scheduler,
          frame,
          scopePath,
          parent,
          createScope: createNewScope,
        }),
      )
    }

    return scopes
  }

  const reconstructCurrentScopes = () => {
    const frames = adapter.current().navScope?.scopes

    if (!frames?.length) {
      return []
    }

    return reconstructScopes(frames)
  }

  return {
    begin(options = {}) {
      return createNewScope(adapter.current().key, undefined, options)
    },

    current() {
      const scopes = reconstructCurrentScopes()

      return scopes.at(-1)
    },

    scopes() {
      return reconstructCurrentScopes()
    },

    subscribe(listener) {
      return adapter.subscribe(listener)
    },
  }
}

interface NavigationScopeImplOptions<TTarget> {
  readonly adapter: NavigationAdapter<TTarget>

  readonly scheduler: NavigationScheduler

  readonly frame: ScopeFrame

  readonly scopePath: readonly ScopeFrame[]

  readonly parent: NavigationScopeImpl<TTarget> | undefined

  readonly createScope: (
    anchorKey: EntryKey,
    parent: NavigationScopeImpl<TTarget> | undefined,
    options: ScopeOptions,
  ) => NavigationScopeImpl<TTarget>
}

class NavigationScopeImpl<TTarget> implements NavigationScope<TTarget> {
  readonly #adapter: NavigationAdapter<TTarget>

  readonly #scheduler: NavigationScheduler

  readonly #frame: ScopeFrame

  readonly #parent: NavigationScopeImpl<TTarget> | undefined

  readonly #createScope: NavigationScopeImplOptions<TTarget>['createScope']

  readonly scopePath: readonly ScopeFrame[]

  constructor({
    adapter,
    scheduler,
    frame,
    scopePath,
    parent,
    createScope,
  }: NavigationScopeImplOptions<TTarget>) {
    this.#adapter = adapter
    this.#scheduler = scheduler
    this.#frame = frame
    this.scopePath = scopePath
    this.#parent = parent
    this.#createScope = createScope
  }

  get id(): ScopeId {
    return this.#frame.id
  }

  get anchorKey(): EntryKey {
    return this.#frame.anchorKey
  }

  get parent(): NavigationScope<TTarget> | undefined {
    return this.#parent
  }

  get canBack(): boolean {
    const entries = this.entries()

    const currentIndex = entries.findIndex((entry) => entry.key === this.#adapter.current().key)

    return currentIndex > 0
  }

  get canForward(): boolean {
    const entries = this.#adapter.entries()

    const current = this.#adapter.current()

    const currentIsAnchor = current.key === this.anchorKey

    const currentIsInside = this.#containsScope(current)

    if (!currentIsAnchor && !currentIsInside) {
      return false
    }

    const next = entries[current.index + 1]

    if (!next) {
      return false
    }

    return this.#containsScope(next)
  }

  entries(): readonly NavigationEntry[] {
    return this.#adapter.entries().filter((entry) => this.#containsScope(entry))
  }

  push(target: TTarget): Promise<void> {
    return this.#scheduler.schedule(async () => {
      await this.#adapter.push(target, this.#metadata()).finished
    })
  }

  replace(target: TTarget): Promise<void> {
    return this.#scheduler.schedule(async () => {
      await this.#adapter.replace(target, this.#metadata()).finished
    })
  }

  back(): Promise<boolean> {
    return this.#scheduler.schedule(async () => {
      /**
       * 중요:
       *
       * target 계산 자체를 scheduler
       * 안에서 수행한다.
       *
       * queue에 먼저 들어간 navigation이
       * 끝난 뒤의 실제 current entry를
       * 사용해야 하기 때문이다.
       */
      const entries = this.entries()

      const currentIndex = entries.findIndex((entry) => entry.key === this.#adapter.current().key)

      if (currentIndex <= 0) {
        return false
      }

      const target = entries[currentIndex - 1]

      if (!target) {
        return false
      }

      await this.#adapter.traverseTo(target.key).finished

      return true
    })
  }

  forward(): Promise<boolean> {
    return this.#scheduler.schedule(async () => {
      const entries = this.#adapter.entries()

      const current = this.#adapter.current()

      const currentIsAnchor = current.key === this.anchorKey

      const currentIsInside = this.#containsScope(current)

      if (!currentIsAnchor && !currentIsInside) {
        return false
      }

      const target = entries[current.index + 1]

      if (!target || !this.#containsScope(target)) {
        return false
      }

      await this.#adapter.traverseTo(target.key).finished

      return true
    })
  }

  exit(): Promise<void> {
    return this.#scheduler.schedule(async () => {
      /**
       * exit 역시 실행 시점에
       * current entry를 확인한다.
       */
      if (this.#adapter.current().key === this.anchorKey) {
        return
      }

      await this.#adapter.traverseTo(this.anchorKey).finished
    })
  }

  begin(options: ScopeOptions = {}): NavigationScope<TTarget> {
    return this.#createScope(this.#adapter.current().key, this, options)
  }

  #metadata(): NavScopeEntryMetadata {
    return {
      version: 1,
      scopes: this.scopePath,
    }
  }

  #containsScope(entry: NavigationEntry): boolean {
    return entry.navScope?.scopes.some((scope) => scope.id === this.id) ?? false
  }
}

function createScopeId(): ScopeId {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return ['scope', Date.now().toString(36), Math.random().toString(36).slice(2)].join('-')
}
