/* eslint-disable no-control-regex */
const { route } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getJsonfeed, getPurchace } = require('../product-jsonfeed')
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

    const cachedItem = cache.get(cacheKey)

    if (cachedItem) {
      const {
        jsonString,
        feedAuthor,
        feedTitle,
        feedHomePage,
        userID
      } = cachedItem
      if (userID) res.setHeader('X-Gumcast-User-Id', userID)
      if (feedAuthor) res.setHeader('X-Gumcast-Feed-Author', feedAuthor)
      if (feedTitle) res.setHeader('X-Gumcast-Feed-Title', feedTitle)
      if (feedHomePage) res.setHeader('X-Gumcast-Feed-Home-Page', feedHomePage)
      return writeBody(req, res, jsonString)
    }

    try {
      const purchasedItems = await getPurchaces({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      const userID = purchasedItems?.user_id

      if (userID) res.setHeader('X-Gumcast-User-Id', userID)

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

      const purchace = getPurchace(purchasedItems, query.purchase_id)

      const feedAuthor = purchace?.creator_username?.replace(/[^\x00-\x7F]/g, '')
      const feedTitle = purchace?.name?.replace(/[^\x00-\x7F]/g, '')
      const feedHomePage = jf?.home_page_url

      if (feedAuthor) res.setHeader('X-Gumcast-Feed-Author', feedAuthor)
      if (feedTitle) res.setHeader('X-Gumcast-Feed-Title', feedTitle)
      if (feedHomePage) res.setHeader('X-Gumcast-Feed-Home-Page', feedHomePage)

      const jsonString = JSON.stringify(jf, null, ' ')
      cache.set(cacheKey, {
        jsonString,
        feedAuthor,
        feedTitle,
        feedHomePage,
        userID
      })
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
