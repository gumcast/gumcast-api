const HttpHashRouter = require('http-hash-router')

const login = require('./login')
const products = require('./products')
const jsonFeed = require('./feed.json.js')
const rss = require('./feed.rss.js')

exports.createRouter = function createRouter (cfg) {
  const router = HttpHashRouter()

  router.set('/login', { POST: login(cfg) })
  router.set('/products', { GET: products(cfg) })
  router.set('/feed.json', { GET: jsonFeed(cfg) })
  router.set('/feed.rss', { GET: rss(cfg) })

  return router
}
