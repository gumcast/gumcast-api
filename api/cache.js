const { LRUCache } = require('lru-cache')

const cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 20, // 20 mins,
  updateAgeOnGet: false,
  ttlAutopurge: true
})

exports.cache = cache
