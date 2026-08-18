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
  let scopeSequence = 0

  const createScopeId = (): ScopeId => {
    scopeSequence += 1

    return `scope-${scopeSequence}`
  }

  const createScope = (
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

    const path = parent ? [...parent.scopePath, frame] : [frame]

    return new NavigationScopeImpl({
      adapter,
      frame,
      scopePath: path,
      parent,
      createScope,
    })
  }

  return {
    begin(options = {}) {
      return createScope(adapter.current().key, undefined, options)
    },

    subscribe(listener) {
      return adapter.subscribe(listener)
    },
  }
}

interface NavigationScopeImplOptions<TTarget> {
  readonly adapter: NavigationAdapter<TTarget>

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

  readonly #frame: ScopeFrame

  readonly #parent: NavigationScopeImpl<TTarget> | undefined

  readonly #createScope: NavigationScopeImplOptions<TTarget>['createScope']

  readonly scopePath: readonly ScopeFrame[]

  constructor({
    adapter,
    frame,
    scopePath,
    parent,
    createScope,
  }: NavigationScopeImplOptions<TTarget>) {
    this.#adapter = adapter
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

  async push(target: TTarget): Promise<void> {
    await this.#adapter.push(target, this.#metadata()).finished
  }

  async replace(target: TTarget): Promise<void> {
    await this.#adapter.replace(target, this.#metadata()).finished
  }

  async back(): Promise<boolean> {
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
  }

  async forward(): Promise<boolean> {
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
  }

  async exit(): Promise<void> {
    if (this.#adapter.current().key === this.anchorKey) {
      return
    }

    await this.#adapter.traverseTo(this.anchorKey).finished
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
