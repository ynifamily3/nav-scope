export class NavigationUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NavigationUnavailableError'
  }
}
