const bodyParser = require('body-parser')
const { pMiddleware, hashRoute } = require('p-connect')

const { apiErrorHandler, validationFailed } = require('./helpers.js')
const { getAccessTokenFromPassword } = require('../gumroad-client.js')

const json = pMiddleware(bodyParser.json())

module.exports = cfg => hashRoute(login(cfg))
function login (cfg) {
  function validate (body) {
    if (!body) return 'Missing body'
    if (!body.username) return 'Missing username'
    if (!body.password) return 'Missing password'
    return true
  }

  return async (req, res, opts) => {
    res.setHeader('content-type', 'application/json')
    await json(req, res)

    const invalidMsg = validate(req.body)
    if (invalidMsg) return validationFailed(req, invalidMsg)

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
