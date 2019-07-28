const HttpHashRouter = require('http-hash-router')

exports.createRouter = function createRouter (cfg) {
  const router = HttpHashRouter()

  router.set('/login', login)
  router.set('/products', products)
  router.set('/jsonfeed', jsonfeed)
  router.set('/rss', rss)

  return router
}

function login (req, res) {
  throw new Error('Foo bar')
}

function products (req, res) {
  res.end('hello world')
}

function jsonfeed (req, res) {
  res.end('Hello world')
}

function rss (req, res) {
  res.end('Hello world')
}
