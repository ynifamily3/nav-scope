import { describe, expect, it } from 'vitest'

import type { NavigationAdapter } from '../src'

interface AdapterFactory {
  create(): Promise<NavigationAdapter<string>>
}

export function navigationAdapterContract({ create }: AdapterFactory) {
  describe('NavigationAdapter contract', () => {
    it('starts with a current entry', async () => {
      const adapter = await create()

      const current = adapter.current()

      expect(current.key).toBeTruthy()
      expect(current.index).toBe(0)
    })

    it('pushes a new entry', async () => {
      const adapter = await create()

      const before = adapter.current()

      await adapter.push('/b', {
        version: 1,
        scopes: [],
      }).finished

      const after = adapter.current()

      expect(after.key).not.toBe(before.key)
      expect(after.index).toBe(1)
    })

    it('keeps the entry key on replace', async () => {
      const adapter = await create()

      await adapter.push('/b', {
        version: 1,
        scopes: [],
      }).finished

      const key = adapter.current().key

      await adapter.replace('/c', {
        version: 1,
        scopes: [],
      }).finished

      expect(adapter.current().key).toBe(key)
    })

    it('traverses by entry identity', async () => {
      const adapter = await create()

      const first = adapter.current()

      await adapter.push('/b', {
        version: 1,
        scopes: [],
      }).finished

      await adapter.traverseTo(first.key).finished

      expect(adapter.current().key).toBe(first.key)
    })
  })
}
