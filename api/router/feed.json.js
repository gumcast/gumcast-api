const { route } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getJsonfeed } = require('../product-jsonfeed')
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
  return ['json', access_token, refresh_token, purchase_id, proxyFiles, incomingHost].join(';')
}
/* eslint-enable camelcase */

module.exports = cfg => route(jsonfeed(cfg))
function jsonfeed (cfg) {
  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    if (!query.refresh_token) return 'Missing refresh_token'
    if (!query.purchase_id) return 'Missing purchase_id'
    return null
  }

  return async (req, res, opts, next) => {
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)
    if (invalidMsg) return validationFailed(req, res, invalidMsg)

    const cacheKey = getCacheKey({
      access_token: query.access_token,
      refresh_token: query.refresh_token,
      purchase_id: query.purchase_id,
      proxyFiles: query.proxyFiles,
      incomingHost: req.headers.host
    })

    const cachedJSON = cache.get(cacheKey)

    if (cachedJSON) {
      return writeBody(req, res, cachedJSON)
    }

    try {
      const purchasedItems = await getPurchaces({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      const jf = await getJsonfeed(purchasedItems, {
        purchase_id: query.purchase_id,
        access_token: query.access_token,
        refresh_token: query.access_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl,
        proxyFiles: query.proxyFiles,
        hostname: cfg.hostname,
        rootpath: cfg.rootpath,
        fileProxyHost: cfg.fileProxyHost,
        incomingHost: req.headers.host,
        alternateProductLookup: cfg.alternateProductLookup
      })

      const jsonString = JSON.stringify(jf, null, ' ')
      cache.set(cacheKey, jsonString)
      return writeBody(req, res, jsonString)
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
