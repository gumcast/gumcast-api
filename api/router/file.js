const { route } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getPurchaces } = require('../gumroad-client')
const { validationFailed, apiErrorHandler, writeJSON } = require('./helpers')
const { getFileFrom, getPurchace } = require('../product-jsonfeed')
const redirectChain = require('redirect-chain')({ maxRedirects: 5 })
const httpProxy = require('http-proxy')
const promisify = require('util.promisify')

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

    try {
      const purchasedItems = await getPurchaces({
        access_token: query.access_token,
        refresh_token: query.refresh_token,
        mobile_token: cfg.mobile_token,
        mobileApiUrl: cfg.mobileApiUrl
      })

      const purchace = getPurchace(purchasedItems, query.purchase_id)
      if (!purchace) {
        return writeJSON(req, res, {
          error: `purchace_id ${query.purchace_id} not found`
        }, 404)
      }

      const file = getFileFrom(purchace, query.file_id)
      if (!file) {
        return writeJSON(req, res, {
          error: `file_id ${query.file_id} not found`
        }, 404)
      }

      const tmpFileUrl = await redirectChain.destination(file.download_url)

      if (query.strategey === 'proxy') {
        return proxy.asyncProxy(req, res, {
          target: tmpFileUrl,
          changeOrigin: true,
          ignorePath: true
        })
      } else if (query.strategey === 'redirect') {
        res.statusCode = 302
        res.setHeader('Location', tmpFileUrl)
        return res.end()
      } else {
        return writeJSON(req, res, {
          error: `unknown strategey param ${query.strategey}`
        }, 400)
      }
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
