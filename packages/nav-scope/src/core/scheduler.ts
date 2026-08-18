export interface NavigationScheduler {
  schedule<T>(operation: () => Promise<T>): Promise<T>
}

export function createNavigationScheduler(): NavigationScheduler {
  let tail: Promise<void> = Promise.resolve()

  return {
    schedule<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation)

      /**
       * 이전 operation이 실패해도
       * queue 전체가 rejected 상태로
       * 고정되지 않도록 한다.
       *
       * 호출자에게 반환하는 result는
       * 원래 rejection을 그대로 유지한다.
       */
      tail = result.then(
        () => undefined,
        () => undefined,
      )

      return result
    },
  }
}
