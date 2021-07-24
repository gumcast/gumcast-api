const LRU = require('lru-cache')

const cache = new LRU({
  max: 10000,
  maxAge: 1000 * 60 * 20, // 20 mins,
  updateAgeOnGet: false
})

exports.cache = cache
