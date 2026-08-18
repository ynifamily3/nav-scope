export type EntryKey = string

export type ScopeId = string

export interface ScopeFrame {
  readonly id: ScopeId
  readonly anchorKey: EntryKey

  readonly parentScopeId?: ScopeId

  readonly kind?: string
  readonly label?: string
}

export interface NavScopeEntryMetadata {
  readonly version: 1

  readonly scopes: readonly ScopeFrame[]
}

export interface NavigationEntry {
  /**
   * History list 안의 slot identity.
   *
   * replace navigation에서는 동일한 key가 유지될 수 있다.
   */
  readonly key: EntryKey

  readonly url: string | null

  /**
   * 현재 adapter가 노출하는 history entry 목록에서의 위치.
   */
  readonly index: number

  readonly navScope?: NavScopeEntryMetadata
}

export interface NavigationOperation {
  readonly committed: Promise<void>
  readonly finished: Promise<void>
}

export interface NavigationAdapter<TTarget> {
  current(): NavigationEntry

  entries(): readonly NavigationEntry[]

  push(target: TTarget, metadata: NavScopeEntryMetadata): NavigationOperation

  replace(target: TTarget, metadata: NavScopeEntryMetadata): NavigationOperation

  traverseTo(key: EntryKey): NavigationOperation

  subscribe(listener: () => void): () => void
}

export interface ScopeOptions {
  readonly id?: ScopeId
  readonly kind?: string
  readonly label?: string
}

export interface NavigationScope<TTarget> {
  readonly id: ScopeId

  readonly anchorKey: EntryKey

  readonly parent: NavigationScope<TTarget> | undefined

  readonly canBack: boolean
  readonly canForward: boolean

  entries(): readonly NavigationEntry[]

  push(target: TTarget): Promise<void>

  replace(target: TTarget): Promise<void>

  back(): Promise<boolean>

  forward(): Promise<boolean>

  exit(): Promise<void>

  begin(options?: ScopeOptions): NavigationScope<TTarget>
}

export interface NavigationScopeManager<TTarget> {
  begin(options?: ScopeOptions): NavigationScope<TTarget>

  /**
   * 현재 history entry에 속한 가장 안쪽 scope.
   *
   * 현재 entry가 어떤 scope에도 속하지 않으면 undefined.
   */
  current(): NavigationScope<TTarget> | undefined

  /**
   * 현재 history entry에 속한 scope들.
   *
   * outer → inner 순서.
   */
  scopes(): readonly NavigationScope<TTarget>[]

  subscribe(listener: () => void): () => void
}
