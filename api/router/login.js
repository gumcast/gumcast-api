const bodyParser = require('body-parser')
const { pMiddleware, hashRoute } = require('p-connect')

const { apiErrorHandler } = require('./helpers.js')
const { getAccessTokenFromPassword } = require('../gumroad-client.js')

const json = pMiddleware(bodyParser.json())

module.exports = cfg => hashRoute(login(cfg))
function login (cfg) {
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

    try {
      const tokenBundle = getAccessTokenFromPassword({
        oAuthUrl: cfg.oAuthUrl,
        client_id: cfg.client_id,
        username: req.body.username,
        password: req.body.password,
        client_secret: cfg.client_secret
      })

      res.statusCode = 200
      const resBody = JSON.stringify(tokenBundle)
      res.setHeader('Content-Length', Buffer.byteLength(resBody, 'utf8'))
      return res.end(resBody)
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
