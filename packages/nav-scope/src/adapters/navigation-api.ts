import { NavigationUnavailableError } from '../core/errors'
import type {
  EntryKey,
  NavigationAdapter,
  NavigationEntry,
  NavigationOperation,
  NavScopeEntryMetadata,
} from '../core/types'

const NAV_SCOPE_STATE_KEY = '__navScope'

export type NavigationApiTarget =
  | string
  | {
      readonly url: string
      readonly state?: unknown
    }

export interface CreateNavigationApiNavigationOptions {
  /**
   * 기본값은 현재 window.
   *
   * same-origin iframe의 Navigation을 대상으로 할 때
   * 해당 iframe의 window를 전달할 수 있다.
   */
  readonly window?: Window
}

export function createNavigationApiNavigation({
  window: targetWindow = window,
}: CreateNavigationApiNavigationOptions = {}): NavigationAdapter<NavigationApiTarget> {
  if (!('navigation' in targetWindow)) {
    throw new Error('Navigation API is not supported in this environment.')
  }

  return new NavigationApiAdapter(targetWindow)
}

class NavigationApiAdapter implements NavigationAdapter<NavigationApiTarget> {
  readonly #window: Window
  readonly #navigation: Navigation

  constructor(targetWindow: Window) {
    this.#window = targetWindow
    this.#navigation = targetWindow.navigation
  }

  current(): NavigationEntry {
    return toNavigationEntry(this.#getCurrentEntry())
  }

  entries(): readonly NavigationEntry[] {
    return this.#navigation.entries().map(toNavigationEntry)
  }

  push(target: NavigationApiTarget, metadata: NavScopeEntryMetadata): NavigationOperation {
    return this.#navigate(target, 'push', metadata)
  }

  replace(target: NavigationApiTarget, metadata: NavScopeEntryMetadata): NavigationOperation {
    return this.#navigate(target, 'replace', metadata)
  }

  traverseTo(key: EntryKey): NavigationOperation {
    return toNavigationOperation(this.#navigation.traverseTo(key))
  }

  subscribe(listener: () => void): () => void {
    const handleCurrentEntryChange = () => {
      listener()
    }

    this.#navigation.addEventListener('currententrychange', handleCurrentEntryChange)

    return () => {
      this.#navigation.removeEventListener('currententrychange', handleCurrentEntryChange)
    }
  }

  #getCurrentEntry(): NavigationHistoryEntry {
    const entry = this.#navigation.currentEntry

    if (!entry) {
      throw new NavigationUnavailableError('Navigation API has no current history entry.')
    }

    return entry
  }

  #navigate(
    target: NavigationApiTarget,
    history: 'push' | 'replace',
    metadata: NavScopeEntryMetadata,
  ): NavigationOperation {
    const resolved = resolveTarget(
      target,
      history === 'replace' ? this.#getCurrentEntry().getState() : undefined,
    )

    assertSameOrigin(this.#window, resolved.url)

    const info = {
      source: 'nav-scope',
    }

    const handleNavigate = (event: NavigateEvent) => {
      if (event.info !== info) {
        return
      }

      this.#navigation.removeEventListener('navigate', handleNavigate)

      if (!event.canIntercept) {
        if (event.cancelable) {
          event.preventDefault()
        }

        return
      }

      event.intercept({
        /**
         * nav-scope는 routing/rendering/scroll/focus를
         * 소유하지 않는다.
         */
        focusReset: 'manual',
        scroll: 'manual',
      })
    }

    this.#navigation.addEventListener('navigate', handleNavigate)

    try {
      const result = this.#navigation.navigate(resolved.url, {
        history,

        state: writeMetadata(resolved.state, metadata),

        info,
      })

      return toNavigationOperation(result)
    } catch (error) {
      this.#navigation.removeEventListener('navigate', handleNavigate)

      throw error
    }
  }
}

function toNavigationEntry(entry: NavigationHistoryEntry): NavigationEntry {
  const metadata = readMetadata(entry.getState())

  return {
    key: entry.key,
    url: entry.url,
    index: entry.index,

    ...(metadata
      ? {
          navScope: metadata,
        }
      : {}),
  }
}

function toNavigationOperation(result: NavigationResult): NavigationOperation {
  const { committed, finished } = result

  if (!committed || !finished) {
    throw new NavigationUnavailableError('Navigation API returned an incomplete navigation result.')
  }

  return {
    committed: committed.then(() => undefined),
    finished: finished.then(() => undefined),
  }
}

function resolveTarget(
  target: NavigationApiTarget,
  defaultState: unknown,
): {
  readonly url: string
  readonly state: unknown
} {
  if (typeof target === 'string') {
    return {
      url: target,
      state: defaultState,
    }
  }

  return {
    url: target.url,

    state: 'state' in target ? target.state : defaultState,
  }
}

function assertSameOrigin(targetWindow: Window, target: string): void {
  const currentUrl = new URL(targetWindow.location.href)

  const targetUrl = new URL(target, currentUrl)

  if (currentUrl.origin !== targetUrl.origin) {
    throw new Error(`nav-scope only supports same-origin navigation: ${targetUrl.href}`)
  }
}

function readMetadata(state: unknown): NavScopeEntryMetadata | undefined {
  if (!isRecord(state)) {
    return undefined
  }

  const metadata = state[NAV_SCOPE_STATE_KEY]

  if (!isNavScopeMetadata(metadata)) {
    return undefined
  }

  return metadata
}

function writeMetadata(state: unknown, metadata: NavScopeEntryMetadata): unknown {
  if (state == null) {
    return {
      [NAV_SCOPE_STATE_KEY]: metadata,
    }
  }

  if (!isRecord(state)) {
    throw new TypeError('Navigation API state must be an object when used with nav-scope.')
  }

  return {
    ...state,

    [NAV_SCOPE_STATE_KEY]: metadata,
  }
}

function isNavScopeMetadata(value: unknown): value is NavScopeEntryMetadata {
  if (!isRecord(value)) {
    return false
  }

  if (value.version !== 1) {
    return false
  }

  return Array.isArray(value.scopes)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
