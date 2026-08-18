export { createNavigationScopes } from './core/create-navigation-scopes'

export { createMemoryNavigation } from './adapters/memory'

export { createNavigationApiNavigation } from './adapters/navigation-api'

export { NavigationUnavailableError } from './core/errors'

export type {
  EntryKey,
  NavigationAdapter,
  NavigationEntry,
  NavigationOperation,
  NavigationScope,
  NavigationScopeManager,
  NavScopeEntryMetadata,
  ScopeFrame,
  ScopeId,
  ScopeOptions,
} from './core/types'

export type {
  CreateNavigationApiNavigationOptions,
  NavigationApiTarget,
} from './adapters/navigation-api'
