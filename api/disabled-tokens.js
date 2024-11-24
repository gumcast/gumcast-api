const assert = require('assert')

const updateInterval = 43200 // 12 hours

class DisabledTokens {
  #url
  #logger
  #disabledTokens
  #interval

  constructor ({
    url,
    logger
  }) {
    assert(url, 'a url is required')
    this.#url = url
    this.#logger = logger.child({ disabledTokenUpdater: true })
    this.#disabledTokens = []
  }

  get disabledTokens () {
    return this.#disabledTokens
  }

  async #updateTokens () {
    try {
      const response = await fetch(this.#url)

      const newTokens = await response.json()
      this.#disabledTokens = newTokens
      this.#logger.debug({ newTokens })
      this.#logger.info('Disabled tokens refreshed')
      this.#logger.info({ disabledTokens: this.#disabledTokens })
    } catch (err) {
      this.#logger.error(err, 'Error updating disabled tokens')
    }
  }

  start () {
    if (!this.#interval) {
      this.#updateTokens() // update imediately
      this.#interval = setInterval(this.#updateTokens.bind(this), updateInterval)
      this.#logger.info('Disabled tokens refresh interval started')
    } else {
      this.#logger.warn('Disabled tokens refresh already started ')
    }
  }

  stop () {
    if (this.#interval) {
      clearInterval(this.#interval)
      this.#interval = null
      this.#logger.warn('Disabled tokens refresh stopped')
    } else {
      this.#logger.warn('Disabled tokens refresh already stopped')
    }
  }
}

module.exports = DisabledTokens
