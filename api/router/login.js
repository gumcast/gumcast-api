const bodyParser = require('body-parser')
const { pMiddleware, hashRoute } = require('p-connect')

const { apiErrorHandler, validationFailed, writeBody } = require('./helpers.js')
const { getAccessTokenFromPassword } = require('../gumroad-client.js')

const json = pMiddleware(bodyParser.json())

module.exports = cfg => hashRoute(login(cfg))
function login (cfg) {
  function validate (body) {
    if (!body) return 'Missing body'
    if (!body.username) return 'Missing username'
    if (!body.password) return 'Missing password'
    return null
  }

  return async (req, res, opts) => {
    await json(req, res)

    const invalidMsg = validate(req.body)
    if (invalidMsg) return validationFailed(req, res, invalidMsg)

    try {
      const tokenBundle = await getAccessTokenFromPassword({
        oAuthUrl: cfg.oAuthUrl,
        client_id: cfg.client_id,
        username: req.body.username,
        password: req.body.password,
        client_secret: cfg.client_secret
      })

      return writeBody(req, res, JSON.stringify(tokenBundle))
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
