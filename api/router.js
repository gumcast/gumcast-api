const HttpHashRouter = require('http-hash-router')
const bent = require('bent')
const formurlencoded = require('form-urlencoded').default
const bodyParser = require('body-parser')
const qs = require('qs')

exports.createRouter = function createRouter (cfg) {
  const router = HttpHashRouter()

  router.set('/login', {
    POST: p(login(cfg))
  })
  router.set('/products', p(products(cfg)))
  router.set('/jsonfeed', p(jsonfeed(cfg)))
  router.set('/rss', p(rss(cfg)))

  return router
}

// Promise route
function p (route) {
  return (req, res, opts, done) => {
    route(req, res, opts).then(() => done(null)).catch(done)
  }
}

// Promise middleware
function pMw (mw) {
  return (req, res) => {
    return new Promise((resolve, reject) => {
      mw(req, res, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

const jsonBp = pMw(bodyParser.json())

function login (cfg) {
  const post = bent(cfg.oAuthUrl, 'POST', 'json', 200, {
    accept: 'application/json',
    'Content-Type': 'multipart/form-data'
  })

  function validate (body) {
    if (!body) return false
    if (!body.username) return false
    if (!body.password) return false
    return true
  }

  return async (req, res, opts) => {
    res.setHeader('content-type', 'application/json')
    await jsonBp(req, res)
    if (!validate(req.body)) {
      res.statusCode = 400
      res.write(JSON.stringify({
        error: 'Request didn\'t validate'
      }))
      return res.end()
    }

    const formData = formurlencoded({
      client_id: cfg.client_id,
      username: req.body.username,
      password: req.body.password,
      client_secret: cfg.client_secret,
      grant_type: 'password',
      scope: 'mobile_api'
    })

    try {
      const tokenBundle = await post('/token', formData)
      res.statusCode = 200
      res.end(JSON.stringify(tokenBundle))
    } catch (e) {
      return apiErroHandler(req, res, e)
    }
  }
}

function products (cfg) {
  function validate (query) {
    if (!query) return false
    if (!query.access_token) return false
    return true
  }

  return async (req, res) => {
    res.setHeader('content-type', 'application/json')
    // const query = qs.parse((new url.URL(req.url)).search, { ignoreQueryPrefix: true })
    await jsonBp(req, res)
    if (!validate(req.body)) {
      res.statusCode = 400
      res.write(JSON.stringify({
        error: 'Missing access_token in body'
      }))
      return res.end()
    }

    const get = bent('https://gumroad.com/api/mobile/', 'GET', 'json', 200, {
      accept: 'application/json',
      Authorization: 'Bearer ' + req.body.access_token
    })

    const params = {
      include_mobile_unfriendly_products: true,
      include_subscriptions: true,
      mobile_token: cfg.mobile_token
    }

    try {
      const purchacedItems = await get(`/purchases/index.json?${qs.stringify(params)}`)
      res.statusCode = 200
      res.end(JSON.stringify(purchacedItems))
    } catch (e) {
      return apiErroHandler(req, res, e)
    }
  }
}

async function apiErroHandler (req, res, e) {
  if (e.statusCode && e.message && e.responseBody) {
    res.statusCode = e.statusCode
    res.statusMessage = e.message
    const buf = await e.responseBody
    const body = buf.toString()
    res.end(body)
  } else {
    throw e
  }
}

function jsonfeed (cfg) {
  return async (req, res) => {
    res.end('hello world')
  }
}

function rss (cfg) {
  return async (req, res) => {
    res.end('hello world')
  }
}
