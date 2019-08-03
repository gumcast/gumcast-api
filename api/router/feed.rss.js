const { hashRoute } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getRssFeed } = require('../product-jsonfeed')
const { getProducts } = require('../gumroad-client')
const { validationFailed, apiErrorHandler } = require('./helpers')

module.exports = cfg => hashRoute(rssFeed(cfg))
function rssFeed (cfg) {
  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    if (!query.refresh_token) return 'Missing refresh_token'
    if (!query.purchase_id) return 'Missing purchase_id'
    return null
  }

  return async (req, res) => {
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)
    if (invalidMsg) {
      res.setHeader('content-type', 'application/json')
      return validationFailed(res, invalidMsg)
    }

    try {
      const purchasedItems = await getProducts({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      const params = qs.stringify({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        purchase_id: query.purchase_id
      })

      const rss = getRssFeed(purchasedItems, {
        purchase_id: query.purchase_id,
        feed_url: `https://${cfg.hostname}/feed.json?${params}`
      })
      res.setHeader('content-type', 'application/rss+xml')
      res.statusCode = 200

      res.setHeader('Content-Length', Buffer.byteLength(rss, 'utf8'))
      return res.end(rss)
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
