const HttpHashRouter = require('http-hash-router')

const login = require('./login')
const products = require('./products')
const jsonFeed = require('./feed.json.js')
const rss = require('./feed.rss.js')
const { fileProxy } = require('./file')
const { writeJSON } = require('./helpers')
const pkg = require('../../package.json')
const { cache } = require('../cache')

exports.createRouter = function createRouter (cfg) {
  const router = HttpHashRouter()

  router.set('/', (req, res, opts) => {
    writeJSON(req, res, {
      name: pkg.name,
      version: pkg.version,
      hello: 'world'
    })
  })
  router.set('/cache', (req, res, opts) => {
    writeJSON(req, res, {
      cacheSize: cache.size,
      cacheMax: cache.max
    })
  })
  router.set('/login', { POST: login(cfg) })
  router.set('/products', { GET: products(cfg) })
  router.set('/feed.json', { GET: jsonFeed(cfg), HEAD: jsonFeed(cfg) })
  router.set('/feed.rss', { GET: rss(cfg), HEAD: rss(cfg) })
  router.set('/file/:name', fileProxy(cfg))

  return router
}
