const { route } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getPurchases } = require('../gumroad-client.js')
const get = require('lodash.get')

const { apiErrorHandler, validationFailed, writeBody } = require('./helpers.js')
const { cache } = require('../cache.js')

/* eslint-disable camelcase */
function getPurchasesCacheKey ({
  access_token,
  refresh_token,
  mobile_token,
  mobileApiUrl
}) {
  return [
    access_token,
    refresh_token,
    mobile_token,
    mobileApiUrl
  ].join(';')
}
/* eslint-enable camelcase */

module.exports = cfg => route(products(cfg))
function products (cfg) {
  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    if (!query.refresh_token) return 'Missing refresh_token'
    return null
  }

  return async (req, res, opts, next) => {
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)

    if (invalidMsg) return validationFailed(req, res, invalidMsg)

    try {
      const purchasesCacheKey = getPurchasesCacheKey({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      let purchasedItems

      if (cache.get(purchasesCacheKey)) purchasedItems = cache.get(purchasesCacheKey)
      else {
        purchasedItems = await getPurchases({
          access_token: query.access_token,
          refresh_token: query.refresh_token,
          mobile_token: cfg.mobile_token,
          mobileApiUrl: cfg.mobileApiUrl
        })
        cache.set(purchasesCacheKey, purchasedItems)
      }

      if (purchasedItems?.user_id) res.setHeader('X-Gumcast-User-Id', purchasedItems?.user_id)
      console.log({ purchasedItems })
      const filteredProductData = { ...purchasedItems }
      filteredProductData.products = filteredProductData.products.filter(p => Array.isArray(p.file_data))

      const productPurchaseMap = {}

      for (const p of filteredProductData.products) {
        const purchaseArray = get(productPurchaseMap, p.unique_permalink) || []
        purchaseArray.push(p)
        productPurchaseMap[p.unique_permalink] = purchaseArray
      }

      for (const [uniqePermalink, purchaseArray] of Object.entries(productPurchaseMap)) {
        productPurchaseMap[uniqePermalink] = purchaseArray.sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at))
      }

      const latestPurchaseList = new Set()

      for (const sortedPurchaseArray of Object.values(productPurchaseMap)) {
        latestPurchaseList.add(sortedPurchaseArray[0].purchase_id)
      }

      filteredProductData.products = filteredProductData.products.filter(p => latestPurchaseList.has(p.purchase_id)).filter((item) => !item.is_archived)

      return writeBody(req, res, JSON.stringify(filteredProductData))
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
