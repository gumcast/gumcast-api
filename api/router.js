const HttpHashRouter = require('http-hash-router')
const bent = require('bent')
const formurlencoded = require('form-urlencoded').default
const bodyParser = require('body-parser')
const qs = require('qs')
const { pMiddleware, hashRoute } = require('p-connect')
const parseurl = require('parseurl')

exports.createRouter = function createRouter (cfg) {
  const router = HttpHashRouter()

  router.set('/login', {
    POST: hashRoute(login(cfg))
  })
  router.set('/products', {
    GET: hashRoute(products(cfg))
  })
  router.set('/jsonfeed', {
    GET: hashRoute(jsonfeed(cfg))
  })
  router.set('/rss', {
    GET: hashRoute(rss(cfg))
  })

  return router
}

const json = pMiddleware(bodyParser.json())

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
    await json(req, res)
    if (!validate(req.body)) {
      res.statusCode = 400
      const errBody = JSON.stringify({
        error: 'Request didn\'t validate'
      })
      res.setHeader('Content-Length', Buffer.byteLength(errBody, 'utf8'))
      return res.end(errBody)
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
      const resBody = JSON.stringify(tokenBundle)
      res.setHeader('Content-Length', Buffer.byteLength(resBody, 'utf8'))
      res.end(resBody)
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}

function products (cfg) {
  function validate (query) {
    if (!query) return false
    if (!query.access_token) return false
    return true
  }

  return async (req, res, opts) => {
    res.setHeader('content-type', 'application/json')
    const url = parseurl(req)
    const query = qs.parse(url.query)
    if (!validate(query)) {
      res.statusCode = 400
      const errBody = JSON.stringify({
        error: 'Missing access_token in body'
      })
      res.setHeader('Content-Length', Buffer.byteLength(errBody, 'utf8'))
      return res.end(errBody)
    }

    const get = bent('https://gumroad.com/api/mobile/', 'GET', 'json', 200, {
      accept: 'application/json',
      Authorization: 'Bearer ' + query.access_token
    })

    const params = {
      include_mobile_unfriendly_products: true,
      include_subscriptions: true,
      mobile_token: cfg.mobile_token
    }

    try {
      const purchasedItems = await get(`/purchases/index.json?${qs.stringify(params)}`)
      res.statusCode = 200
      const resBody = JSON.stringify(purchasedItems)
      res.setHeader('Content-Length', Buffer.byteLength(resBody, 'utf8'))
      res.end(resBody)
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}

async function apiErrorHandler (req, res, e) {
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
