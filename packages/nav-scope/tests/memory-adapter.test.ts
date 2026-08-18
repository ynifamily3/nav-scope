import { createMemoryNavigation } from '../src'

import { navigationAdapterContract } from './adapter-contract'

navigationAdapterContract({
  async create() {
    return createMemoryNavigation('/a')
  },
})
