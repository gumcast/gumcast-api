const { hashRoute } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getPurchaces } = require('../gumroad-client')
const { validationFailed, apiErrorHandler, writeBody } = require('./helpers')
const { getFileFrom, getPurchace } = require('../product-jsonfeed')
const redirectChain = require('redirect-chain')({ maxRedirects: 5 })
const simpleGet = require('simple-get')
const promisify = require('util.promisify')
const pump = promisify(require('pump'))

exports.fileProxy = cfg => hashRoute(fileProxy(cfg))
function fileProxy (cfg) {
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
    console.log('Request headers')
    console.log(req.headers)

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

      const fileProxyResponse = await get(tmpFileUrl, req.method, req.headers)
      console.log('Response headers')
      console.log(fileProxyResponse.headers)
      res.writeHead(fileProxyResponse.statusCode, fileProxyResponse.headers)
      if (req.method !== 'HEAD') {
        await pump(fileProxyResponse, res)
      } else {
        fileProxyResponse.destroy()
        return res.end()
      }
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}

async function get (url, method, headers) {
  return new Promise((resolve, reject) => {
    simpleGet({
      url,
      method,
      timeout: 10000 // 10 seconds
    }, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  })
}
