export async function appNavigate(
  url: string,
  history: 'push' | 'replace' = 'push',
): Promise<void> {
  const info = {
    source: 'react-modal-example',
  }

  const handleNavigate = (event: NavigateEvent) => {
    if (event.info !== info) {
      return
    }

    navigation.removeEventListener('navigate', handleNavigate)

    if (!event.canIntercept) {
      throw new Error('Navigation cannot be intercepted.')
    }

    event.intercept({
      focusReset: 'manual',
      scroll: 'manual',
    })
  }

  navigation.addEventListener('navigate', handleNavigate)

  try {
    const result = navigation.navigate(url, {
      history,
      info,
    })

    const finished = result.finished

    if (!finished) {
      throw new Error('Navigation did not provide a finished promise.')
    }

    await finished
  } finally {
    navigation.removeEventListener('navigate', handleNavigate)
  }
}
