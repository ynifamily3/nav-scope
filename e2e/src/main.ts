// @ts-expect-error CSS imports are handled by the bundler.
import './style.css'

import { createTestApi } from './test-api'

const api = createTestApi()

window.__navScopeTest = api

const pageNameElement = getElement('#page-name')

const currentPathElement = getElement('#current-path')

const scopeIdElement = getElement('#scope-id')

const scopeAnchorElement = getElement('#scope-anchor')

const scopeCanBackElement = getElement('#scope-can-back')

const scopeCanForwardElement = getElement('#scope-can-forward')

const snapshotElement = getElement('#snapshot')

const errorElement = getElement('#error')

const backButton = getButton('[data-action="back"]')

const forwardButton = getButton('[data-action="forward"]')

const exitButton = getButton('[data-action="exit"]')

const routeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-route]')]

function render(): void {
  const snapshot = api.snapshot()

  const pathname = window.location.pathname

  pageNameElement.textContent = getPageName(pathname)

  currentPathElement.textContent = pathname

  scopeIdElement.textContent = snapshot.scope?.id ?? 'none'

  scopeAnchorElement.textContent = snapshot.scope?.anchorKey ?? 'none'

  scopeCanBackElement.textContent = String(snapshot.scope?.canBack ?? false)

  scopeCanForwardElement.textContent = String(snapshot.scope?.canForward ?? false)

  backButton.disabled = !snapshot.scope?.canBack

  forwardButton.disabled = !snapshot.scope?.canForward

  exitButton.disabled = !snapshot.scope

  for (const button of routeButtons) {
    button.disabled = !snapshot.scope
  }

  snapshotElement.textContent = JSON.stringify(
    {
      current: snapshot.current,

      entries: snapshot.entries.map((entry) => ({
        index: entry.index,
        key: entry.key,
        url: entry.url,

        scopes:
          entry.navScope?.scopes.map((scope) => ({
            id: scope.id,
            anchorKey: scope.anchorKey,
          })) ?? [],
      })),

      scope: snapshot.scope,
    },
    null,
    2,
  )
}

async function run(operation: () => void | Promise<unknown>): Promise<void> {
  clearError()

  try {
    await operation()

    render()
  } catch (error) {
    showError(error)
  }
}

document.addEventListener('click', (event) => {
  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  const actionButton = target.closest<HTMLButtonElement>('[data-action]')

  if (actionButton) {
    const action = actionButton.dataset.action

    switch (action) {
      case 'begin':
        void run(() => {
          api.begin()
        })
        return

      case 'back':
        void run(() => api.back())
        return

      case 'forward':
        void run(() => api.forward())
        return

      case 'exit':
        void run(() => api.exit())
        return
    }
  }

  const routeButton = target.closest<HTMLButtonElement>('[data-route]')

  if (!routeButton) {
    return
  }

  const route = routeButton.dataset.route

  if (!route) {
    return
  }

  void run(() => api.push(route))
})

/**
 * Browser toolbar Back / Forward처럼
 * nav-scope 외부에서 발생한 traversal도
 * UI에 반영한다.
 */
api.subscribe(() => {
  render()
})

render()

function getPageName(pathname: string): string {
  switch (pathname) {
    case '/a':
      return 'Page A'

    case '/b':
      return 'Page B'

    case '/c':
      return 'Page C'

    default:
      return 'Unknown page'
  }
}

function getElement(selector: string): HTMLElement {
  const element = document.querySelector(selector)

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Element not found: ${selector}`)
  }

  return element
}

function getButton(selector: string): HTMLButtonElement {
  const element = document.querySelector(selector)

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${selector}`)
  }

  return element
}

function clearError(): void {
  errorElement.hidden = true
  errorElement.textContent = ''
}

function showError(error: unknown): void {
  errorElement.hidden = false

  errorElement.textContent = error instanceof Error ? (error.stack ?? error.message) : String(error)
}
