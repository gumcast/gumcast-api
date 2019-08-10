const { hashRoute } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')
const { getPurchaces } = require('../gumroad-client')
const { validationFailed, apiErrorHandler, writeBody } = require('./helpers')
const { getFileFrom, getPurchace } = require('../product-jsonfeed')
const redirectChain = require('redirect-chain')({ maxRedirects: 5 })
const simpleGet = require('simple-get')

exports.getFile = cfg => hashRoute(getFile(cfg))
function getFile (cfg) {
  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    if (!query.refresh_token) return 'Missing refresh_token'
    if (!query.purchase_id) return 'Missing purchase_id'
    if (!query.file_id) return 'Missing file_id'
    return null
  }

  return async (req, res) => {
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)
    if (invalidMsg) {
      return validationFailed(req, res, invalidMsg)
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
        return writeBody(res, JSON.stringify({
          error: `purchace_id ${query.purchace_id} not found`
        }), 404)
      }

      const file = getFileFrom(purchace, query.file_id)
      if (!file) {
        return writeBody(res, JSON.stringify({
          error: `file_id ${query.file_id} not found`
        }), 404)
      }

      const tmpFileUrl = await redirectChain.destination(file.download_url)

      res.writeHead(302, { Location: tmpFileUrl })
      res.end()
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}

async function get (url) {
  return new Promise((resolve, reject) => {
    simpleGet({
      url,
      method: 'HEAD',
      timeout: 10000 // 10 seconds
    }, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  })
}

exports.headFile = cfg => hashRoute(headFile(cfg))
function headFile (cfg) {
  function validate (query) {
    if (!query) return 'Missing querystring'
    if (!query.access_token) return 'Missing access_token'
    if (!query.refresh_token) return 'Missing refresh_token'
    if (!query.purchase_id) return 'Missing purchase_id'
    if (!query.file_id) return 'Missing file_id'
    return null
  }

  return async (req, res) => {
    const url = parseurl(req)
    const query = qs.parse(url.query)
    const invalidMsg = validate(query)
    if (invalidMsg) {
      return validationFailed(req, res, invalidMsg)
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
        return writeBody(res, JSON.stringify({
          error: `purchace_id ${query.purchace_id} not found`
        }), 404)
      }

      const file = getFileFrom(purchace, query.file_id)
      if (!file) {
        return writeBody(res, JSON.stringify({
          error: `file_id ${query.file_id} not found`
        }), 404)
      }

      const tmpFileUrl = await redirectChain.destination(file.download_url)

      const response = await get(tmpFileUrl)

      res.writeHead(response.statusCode, response.headers)
      res.end()
    } catch (e) {
      return apiErrorHandler(req, res, e)
    }
  }
}
