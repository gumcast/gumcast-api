/* eslint-disable no-control-regex */
const { route } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getPurchaces, getPurchaceData } = require('../gumroad-client')
const { validationFailed, apiErrorHandler, writeJSON } = require('./helpers')
const { getFileFrom, getPurchace, getProductPermalink } = require('../product-jsonfeed')
const redirectChain = require('redirect-chain')({
  maxRedirects: 5
})
const httpProxy = require('http-proxy')
const promisify = require('util.promisify')
const { cache } = require('../cache.js')

/* eslint-disable camelcase */
function getCacheKey ({
  access_token,
  refresh_token,
  purchase_id,
  file_id
}) {
  return [access_token, refresh_token, purchase_id, file_id].join(';')
}

function getPurchacesCacheKey ({
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

function getPurchaceDataCacheKey ({
  access_token,
  refresh_token,
  mobile_token,
  mobileApiUrl,
  url_redirect_external_id
}) {
  return [
    access_token,
    refresh_token,
    mobile_token,
    mobileApiUrl,
    url_redirect_external_id
  ].join(';')
}
/* eslint-enable camelcase */

exports.fileProxy = cfg => route(fileProxy(cfg))
function fileProxy (cfg) {
  const proxy = httpProxy.createProxyServer()
  proxy.asyncProxy = promisify(proxy.web)

  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    if (!query.refresh_token) return 'Missing refresh_token'
    if (!query.purchase_id) return 'Missing purchase_id'
    if (!query.file_id) return 'Missing file_id'
    if (!query.strategey) return 'Missing strategey'
    return null
  }

  function paramValidate (params) {
    if (!params) return 'Missing all path params'
    if (!params.name) return 'Missing file \'name\' param'
    return null
  }

  return async (req, res, { params }, next) => {
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)
    if (invalidMsg) {
      return validationFailed(req, res, invalidMsg)
    }
    const invalidParamMsg = paramValidate(params)
    if (invalidParamMsg) {
      return validationFailed(req, res, invalidParamMsg)
    }

    const cacheKey = getCacheKey({
      access_token: query.access_token,
      refresh_token: query.refresh_token,
      purchase_id: query.purchase_id,
      file_id: query.file_id
    })

    const cachedItem = cache.get(cacheKey)

    if (cachedItem) {
      const {
        cachedURL,
        feedAuthor,
        feedTitle,
        feedHomePage,
        fileID,
        userID
      } = cachedItem
      if (userID) res.setHeader('X-Gumcast-User-Id', userID)
      if (feedAuthor) res.setHeader('X-Gumcast-Feed-Author', feedAuthor)
      if (feedTitle) res.setHeader('X-Gumcast-Feed-Title', feedTitle)
      if (feedHomePage) res.setHeader('X-Gumcast-Feed-Home-Page', feedHomePage)
      if (fileID) res.setHeader('X-Gumcast-File-ID', fileID)
      return strategeyResponse(query.strategey, cachedURL)
    }

    try {
      const purchacesCacheKey = getPurchacesCacheKey({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      let purchasedItems

      if (cache.get(purchacesCacheKey)) purchasedItems = cache.get(purchacesCacheKey)
      else {
        purchasedItems = await getPurchaces({
          access_token: query.access_token,
          refresh_token: query.refresh_token,
          mobile_token: cfg.mobile_token,
          mobileApiUrl: cfg.mobileApiUrl
        })
        cache.set(purchacesCacheKey, purchasedItems)
      }

      const userID = purchasedItems?.user_id
      if (userID) res.setHeader('X-Gumcast-User-Id', userID)

      const purchace = getPurchace(purchasedItems, query.purchase_id)
      if (!purchace) {
        return writeJSON(req, res, {
          error: `purchace_id ${query.purchace_id} not found`
        }, 404)
      }

      const feedAuthor = purchace?.creator_username?.replace(/[^\x00-\x7F]/g, '')
      const feedTitle = purchace?.name?.replace(/[^\x00-\x7F]/g, '')
      const feedHomePage = getProductPermalink(purchace)

      if (feedAuthor) res.setHeader('X-Gumcast-Feed-Author', feedAuthor)
      if (feedTitle) res.setHeader('X-Gumcast-Feed-Title', feedTitle)
      if (feedHomePage) res.setHeader('X-Gumcast-Feed-Home-Page', feedHomePage)

      const purchaceDataCacheKey = getPurchaceDataCacheKey({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl,
        url_redirect_external_id: purchace.url_redirect_external_id
      })

      let productData = purchace

      if (cfg.alternateProductLookup) {
        if (cache.get(purchaceDataCacheKey)) productData = cache.get(purchaceDataCacheKey)
        else {
          const purchaceData = await getPurchaceData({
            access_token: query.access_token,
            refresh_token: query.refresh_token,
            mobile_token: cfg.mobile_token,
            mobileApiUrl: cfg.mobileApiUrl,
            url_redirect_external_id: purchace.url_redirect_external_id
          })
          cache.set(purchaceDataCacheKey, purchaceData.product)
          productData = purchaceData.product
        }
      }

      if (!productData) {
        return writeJSON(req, res, {
          error: `url redirect purchase data not found ${purchace.url_redirect_external_id}`
        }, 404)
      }

      const file = getFileFrom(productData, query.file_id)
      if (!file) {
        return writeJSON(req, res, {
          error: `file_id ${query.file_id} not found`
        }, 404)
      }

      const fileID = file.id
      if (fileID) res.setHeader('X-Gumcast-File-ID', fileID)
      const tmpFileUrl = await redirectChain.destination(file.download_url)
      cache.set(cacheKey, {
        cachedURL: tmpFileUrl,
        feedAuthor,
        feedTitle,
        feedHomePage,
        fileID,
        userID
      })
      return strategeyResponse(query.strategey, tmpFileUrl)
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }

    function strategeyResponse (strategey, tmpFileUrl) {
      if (strategey === 'proxy') {
        return proxy.asyncProxy(req, res, {
          target: tmpFileUrl,
          changeOrigin: true,
          ignorePath: true
        })
      } else if (strategey === 'redirect') {
        res.statusCode = 302
        try {
          res.setHeader('Location', tmpFileUrl)
        } catch (err) {
          throw new Error(`Error setting location header: ${tmpFileUrl}`, { cause: err })
        }
        return res.end()
      } else {
        return writeJSON(req, res, {
          error: `unknown strategey param ${strategey}`
        }, 400)
      }
    }
  }
}
