/* eslint-disable camelcase */
const { hashRoute } = require('p-connect')
const bent = require('bent')
const parseurl = require('parseurl')
const qs = require('qs')

const { apiErrorHandler } = require('./helpers.js')

module.exports = cfg => hashRoute(products(cfg))
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

    const get = bent(cfg.mobileApiUrl, 'GET', 'json', 200, {
      accept: 'application/json',
      Authorization: 'Bearer ' + query.access_token
    })

    const params = {
      include_mobile_unfriendly_products: true,
      include_subscriptions: true,
      mobile_token: cfg.mobile_token
    }

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

async function getProducts ({
  access_token,
  refresh_token,
  mobile_token,
  mobileApiUrl
}) {
  const get = bent(mobileApiUrl, 'GET', 'json', 200, {
    accept: 'application/json',
    Authorization: 'Bearer ' + access_token
  })

  const params = {
    include_mobile_unfriendly_products: true,
    include_subscriptions: true,
    mobile_token: mobile_token
  }

  return get(`/purchases/index.json?${qs.stringify(params)}`)
}
