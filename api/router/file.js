const { hashRoute } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getPurchaces } = require('../gumroad-client')
const { validationFailed, apiErrorHandler, writeBody } = require('./helpers')
const { getFileFrom, getPurchace } = require('../product-jsonfeed')
const redirectChain = require('redirect-chain')({ maxRedirects: 5 })
const httpProxy = require('http-proxy')
const promisify = require('util.promisify')

exports.fileProxy = cfg => hashRoute(fileProxy(cfg))
function fileProxy (cfg) {
  const proxy = httpProxy.createProxyServer()
  proxy.asyncProxy = promisify(proxy.web)
  proxy.on('proxyRes', function (proxyRes, req, res) {
    console.log('RAW Response from the target', JSON.stringify(proxyRes.headers, true, 2))
  })

  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    if (!query.refresh_token) return 'Missing refresh_token'
    if (!query.purchase_id) return 'Missing purchase_id'
    if (!query.file_id) return 'Missing file_id'
    return null
  }

  function paramValidate (params) {
    if (!params) return 'Missing all path params'
    if (!params.name) return 'Missing file \'name\' param'
    return null
  }

  return async (req, res, { params }) => {
    console.log('REQUEST HEADERS')
    console.log(req.method)
    console.log(req.headers)
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

    try {
      const purchasedItems = await getPurchaces({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      const purchace = getPurchace(purchasedItems, query.purchase_id)
      if (!purchace) {
        return writeBody(req, res, JSON.stringify({
          error: `purchace_id ${query.purchace_id} not found`
        }), 404)
      }

      const file = getFileFrom(purchace, query.file_id)
      if (!file) {
        return writeBody(req, res, JSON.stringify({
          error: `file_id ${query.file_id} not found`
        }), 404)
      }

      const tmpFileUrl = await redirectChain.destination(file.download_url)

      return proxy.asyncProxy(req, res, {
        target: tmpFileUrl,
        changeOrigin: true
      })
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
