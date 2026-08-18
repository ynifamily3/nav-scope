import type { NavScopeTestApi } from './test-api'

declare global {
  interface Window {
    __navScopeTest: NavScopeTestApi
  }
}

export {}
