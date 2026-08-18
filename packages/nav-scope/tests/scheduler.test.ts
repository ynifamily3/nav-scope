import { createNavigationScheduler } from '../src/core/scheduler'

import { describe, expect, it } from 'vitest'

describe('navigation scheduler', () => {
  it('serializes operations in scheduling order', async () => {
    const scheduler = createNavigationScheduler()

    const events: string[] = []

    let releaseFirst: (() => void) | undefined

    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = scheduler.schedule(async () => {
      events.push('first:start')

      await firstGate

      events.push('first:end')
    })

    const second = scheduler.schedule(async () => {
      events.push('second:start')

      events.push('second:end')
    })

    /**
     * 첫 operation이 시작할
     * microtask에게 실행 기회를 준다.
     */
    await Promise.resolve()

    expect(events).toEqual(['first:start'])

    /**
     * 아직 first가 끝나지 않았으므로
     * second는 시작하면 안 된다.
     */
    expect(events).not.toContain('second:start')

    releaseFirst?.()

    await Promise.all([first, second])

    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('continues processing after a failed operation', async () => {
    const scheduler = createNavigationScheduler()

    const events: string[] = []

    const first = scheduler.schedule(async () => {
      events.push('first')

      throw new Error('navigation failed')
    })

    const second = scheduler.schedule(async () => {
      events.push('second')

      return 'done'
    })

    await expect(first).rejects.toThrow('navigation failed')

    await expect(second).resolves.toBe('done')

    expect(events).toEqual(['first', 'second'])
  })

  it('preserves operation return values', async () => {
    const scheduler = createNavigationScheduler()

    const result = await scheduler.schedule(async () => {
      return 42
    })

    expect(result).toBe(42)
  })
})

import { createMemoryNavigation, createNavigationScopes } from '../src'

it('serializes scope navigation commands', async () => {
  const adapter = createMemoryNavigation('/a')

  const scope = createNavigationScopes({
    adapter,
  }).begin()

  /**
   * 일부러 await하지 않는다.
   */
  const pushB = scope.push('/b')

  const pushC = scope.push('/c')

  const back = scope.back()

  await Promise.all([pushB, pushC, back])

  /**
   * 순서:
   *
   * /a
   *  ↓ push /b
   * /b
   *  ↓ push /c
   * /c
   *  ↓ back
   * /b
   */
  expect(adapter.current().url).toBe('/b')
})
