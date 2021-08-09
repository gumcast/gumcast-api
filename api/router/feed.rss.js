const { route } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getRssFeed } = require('../product-jsonfeed')
const { getPurchaces } = require('../gumroad-client')
const { validationFailed, apiErrorHandler, writeBody, writeJSON } = require('./helpers')
const { cache } = require('../cache')

/* eslint-disable camelcase */
function getCacheKey ({
  access_token,
  refresh_token,
  purchase_id,
  proxyFiles,
  incomingHost
}) {
  return ['rss', access_token, refresh_token, purchase_id, proxyFiles, incomingHost].join(';')
}
/* eslint-enable camelcase */

module.exports = cfg => route(rssFeed(cfg))
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
      return validationFailed(req, res, invalidMsg)
    }

    const cacheKey = getCacheKey({
      access_token: query.access_token,
      refresh_token: query.refresh_token,
      purchase_id: query.purchase_id,
      proxyFiles: query.proxyFiles,
      incomingHost: req.headers.host
    })

    const cachedRss = cache.get(cacheKey)

    if (cachedRss) {
      return writeBody(req, res, cachedRss, 200, 'application/rss+xml')
    }

    try {
      const purchasedItems = await getPurchaces({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      const rss = await getRssFeed(purchasedItems, {
        purchase_id: query.purchase_id,
        access_token: query.access_token,
        refresh_token: query.access_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl,
        proxyFiles: query.proxyFiles,
        hostname: cfg.hostname,
        rootpath: cfg.rootpath,
        fileProxyHost: cfg.fileProxyHost,
        incomingHost: req.headers.host
      })
      cache.set(cacheKey, rss)
      return writeBody(req, res, rss, 200, 'application/rss+xml')
    } catch (e) {
      if (e.message === 'purchace_id not found') {
        return writeJSON(req, res, {
          error: `purchace_id ${query.purchase_id} not found`
        }, 404)
      } else {
        return apiErrorHandler(req, res, e)
      }
    }
  }
}
