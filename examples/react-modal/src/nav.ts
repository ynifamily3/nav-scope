import { createNavigationApiNavigation, createNavigationScopes } from 'nav-scope'

export const navigationAdapter = createNavigationApiNavigation()

export const nav = createNavigationScopes({
  adapter: navigationAdapter,
})
