/* eslint-disable camelcase */
const { hashRoute } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getPurchaces } = require('../gumroad-client.js')

const { apiErrorHandler, validationFailed, writeBody } = require('./helpers.js')

module.exports = cfg => hashRoute(products(cfg))
function products (cfg) {
  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    return null
  }

  return async (req, res, opts) => {
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)

    if (invalidMsg) return validationFailed(req, res, invalidMsg)

    try {
      const purchasedItems = await getPurchaces({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      return writeBody(res, JSON.stringify(purchasedItems))
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
