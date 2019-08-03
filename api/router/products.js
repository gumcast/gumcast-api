/* eslint-disable camelcase */
const { hashRoute } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getProducts } = require('../gumroad-client.js')

const { apiErrorHandler, validationFailed } = require('./helpers.js')

module.exports = cfg => hashRoute(products(cfg))
function products (cfg) {
  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    return null
  }

  return async (req, res, opts) => {
    res.setHeader('content-type', 'application/json')
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)
    if (invalidMsg) return validationFailed(res, invalidMsg)

    try {
      const purchasedItems = await getProducts({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })
      res.statusCode = 200
      const resBody = JSON.stringify(purchasedItems)
      res.setHeader('Content-Length', Buffer.byteLength(resBody, 'utf8'))
      res.end(resBody)
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
