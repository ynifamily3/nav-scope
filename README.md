# nav-scope

Scoped navigation semantics on top of the browser's linear history.

`nav-scope` lets you group multiple browser history entries into a semantic navigation scope without creating a second navigation stack.

```text
A                        ← scope anchor
│
B
│
C
│
D                        ← current
```

```ts
await scope.back()
// D → C

await scope.exit()
// D → A
```

The browser history remains native and linear.

---

## Why?

Browser history is a timeline.

```text
A → B → C → D
```

But applications often have navigation flows that are more meaningful than individual history entries.

For example, a modal may have multiple URL-addressable steps:

```text
/
│
/?modal=true
│
/?modal=true&step=2
│
/?modal=true&step=3
```

The browser Back button should naturally move through the steps:

```text
step 3 → step 2 → step 1 → /
```

But the modal's close button often wants something different:

```text
step 3 ─────────────────→ /
```

`nav-scope` adds that missing semantic boundary.

---

## Installation

```bash
pnpm add nav-scope
```

```bash
npm install nav-scope
```

The adapter used in the Quick Start relies on the browser Navigation API. The API
must be available in the target browser, and navigation targets must stay on the
same origin. Use `createMemoryNavigation()` for tests or environments without the
Navigation API.

---

## Quick start

```ts
import { createNavigationApiNavigation, createNavigationScopes } from 'nav-scope'

const adapter = createNavigationApiNavigation()

const nav = createNavigationScopes({
  adapter,
})

const scope = nav.begin()

await scope.push('/b')
await scope.push('/c')
await scope.push('/d')

await scope.back()
// /d → /c

await scope.exit()
// /c → scope anchor
```

`begin()` does not create a history entry.

The current entry becomes the scope's anchor, and the scope is materialized when the first scoped navigation occurs.

```text
/a                         ← anchor
│
/b                         scope X
│
/c                         scope X
```

---

## Modal example

```ts
const modal = nav.begin({
  kind: 'modal',
})

await modal.push('/?modal=true')

await modal.push('/?modal=true&step=2')

await modal.push('/?modal=true&step=3')
```

Browser history:

```text
/                             ← anchor
│
/?modal=true                  scope X
│
/?modal=true&step=2           scope X
│
/?modal=true&step=3           scope X
```

Inside the modal:

```ts
await modal.back()
// step 3 → step 2
```

Close the whole modal flow:

```ts
await modal.exit()
// step 3 → /
```

---

## Browser-native semantics

`nav-scope` does not maintain a second navigation stack.

The browser's history remains the source of truth.

Scope metadata is associated with history entries, so browser traversal can restore the active scope naturally.

```text
/c [scope X]
     │
     │ browser Back
     ▼
/b [scope X]
     │
     │ browser Back
     ▼
/a [no scope]
     │
     │ browser Forward
     ▼
/b [scope X]
```

No separate navigation stack needs to be synchronized with Back, Forward, or reload.

---

## Scope reconstruction

A `NavigationScope` object is a runtime projection of history metadata.

It is not the source of truth.

This means a scope can be reconstructed after the JavaScript runtime is recreated.

```text
history entry
    │
    └─ nav-scope metadata
            │
            ▼
      NavigationScope
```

For example:

```ts
const scope = nav.current()

if (scope) {
  await scope.exit()
}
```

can work using the scope metadata associated with the current history entry.

---

## Nested scopes

Scopes can be nested.

```text
A                         ← outer anchor
│
B                         outer
│
C                         outer / inner anchor
│
D                         outer + inner
│
E                         outer + inner
```

```ts
const outer = nav.begin()

await outer.push('/b')
await outer.push('/c')

const inner = outer.begin()

await inner.push('/d')
await inner.push('/e')

await inner.exit()
// /e → /c

await outer.exit()
// /c → A
```

The browser history is still a single linear timeline.

---

## API

### `createNavigationScopes()`

```ts
const nav = createNavigationScopes({
  adapter,
})
```

Creates a navigation scope manager.

### `nav.begin()`

```ts
const scope = nav.begin({
  kind: 'modal',
  label: 'Profile editor',
})
```

Starts a new scope using the current history entry as its anchor.

Calling `begin()` itself does not modify history.

### `nav.current()`

```ts
const scope = nav.current()
```

Returns the innermost scope associated with the current history entry.

Returns `undefined` when the current entry is outside every scope.

### `nav.scopes()`

```ts
const scopes = nav.scopes()
```

Returns the scopes associated with the current entry in outer-to-inner order.

### `scope.push()`

```ts
await scope.push('/next')
```

Pushes a new history entry associated with the scope.

Targets can also provide application state:

```ts
await scope.push({
  url: '/next',
  state: {
    source: 'modal',
  },
})
```

The target URL must be same-origin. When an object target is used, `state` must be
an object or `undefined`, because `nav-scope` stores its scope metadata alongside
that state.

### `scope.replace()`

```ts
await scope.replace('/next')
```

Replaces the current history entry while preserving the history-entry identity used for traversal.

### `scope.back()`

```ts
const moved = await scope.back()
```

Moves to the previous entry inside the scope.

It will not cross the scope anchor.

### `scope.forward()`

```ts
const moved = await scope.forward()
```

Moves to the next entry inside the scope.

### `scope.exit()`

```ts
await scope.exit()
```

Traverses directly to the scope anchor.

### `scope.entries()`

```ts
const entries = scope.entries()
```

Returns the currently reachable browser-history entries associated with the scope.

---

## Important: `exit()` does not delete history

`nav-scope` is traversal-based, not stack-mutation-based.

Suppose the history is:

```text
A
│
B
│
C
│
D                        ← current
```

Calling:

```ts
await scope.exit()
```

results in:

```text
A                        ← current
│
B
│
C
│
D
```

The entries `B`, `C`, and `D` may still be reachable using browser Forward navigation.

This is intentional.

The web platform currently does not provide an API for arbitrary deletion or rearrangement of session-history entries.

For this reason, `nav-scope` intentionally does not expose APIs such as:

```ts
scope.pop()
scope.popToRoot()
scope.clear()
scope.deleteHistory()
```

Those names would imply stack mutation that the browser cannot actually perform.

---

## Deep links

A URL identifies a location.

A navigation scope identifies how the current browser history entry relates to a previous navigation journey.

Those are different things.

For example, opening this URL directly:

```text
/?modal=true&step=2
```

does not automatically recreate the history journey:

```text
/
│
/?modal=true
│
/?modal=true&step=2
```

because the shared URL does not contain the original browser-history entries or their identities.

Applications can choose how to handle this.

A modal application may, for example, materialize a new scope for the deep link:

```text
/?modal=true&step=2
        │
        │ application bootstrap
        ▼
/                         ← new anchor
│
/?modal=true&step=2       ← scoped entry
```

`nav-scope` does not infer this policy automatically.

---

## Why the Navigation API?

`nav-scope` uses history-entry identity instead of history arithmetic.

Conceptually:

```ts
navigation.traverseTo(anchorKey)
```

instead of:

```ts
history.go(-depth)
```

This matters especially when iframes are involved.

The Navigation API operates within a single navigable/frame, so top-level navigation entries are not mixed with navigation occurring inside an embedded iframe.

```text
Top-level Navigation

A
B
C


iframe Navigation

X
Y
Z
```

A scope therefore represents navigation within one Navigation context rather than trying to count overall browser-history steps.

---

## Async navigation

Programmatic navigation operations are serialized.

```ts
scope.push('/b')
scope.push('/c')
scope.back()
```

is executed in order:

```text
push /b
   ↓
push /c
   ↓
back
```

even when the caller does not explicitly await each operation.

User-driven browser traversal remains browser-controlled and is treated as the source of truth.

---

## Design principles

- Browser history is the source of truth.
- A scope is semantic metadata over browser history, not another history stack.
- Navigation uses entry identity rather than history distance.
- Scope objects can be reconstructed from history metadata.
- Browser-native Back and Forward semantics are preserved.
- Platform limitations are exposed rather than hidden.

---

## What nav-scope does not do

`nav-scope` is intentionally not:

- a router
- a modal library
- a replacement for browser history
- a memory navigation stack
- a history rewriting library

It does not manage rendering, route matching, loaders, animations, focus management, or modal UI.

Those responsibilities belong to your application or router.

---

## Status

`nav-scope` is experimental.

The API is still being explored and may change before `1.0`.

The current implementation is focused on the browser Navigation API and modern SPA navigation patterns.

---

## Roadmap

Planned areas of exploration include:

- scope-aware navigation blocking
- React bindings
- TanStack Router integration
- scope checkpoints
- lifecycle and disposal observation
- navigation timeline devtools

---

## License

MIT
