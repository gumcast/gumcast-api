const assert = require('nanoassert')

exports.apiErrorHandler = apiErrorHandler
async function apiErrorHandler (req, res, e) {
  if (e.statusCode && e.message && e.responseBody) {
    res.statusCode = e.statusCode
    res.statusMessage = e.message
    const buf = await e.responseBody
    const body = buf.toString()
    res.end(body)
  } else {
    throw e
  }
}

exports.validationFailed = validationFailed
async function validationFailed (req, res, msg) {
  res.setHeader('content-type', 'application/json')
  res.statusCode = 400
  const errBody = JSON.stringify({
    error: msg
  })
  res.setHeader('Content-Length', Buffer.byteLength(errBody, 'utf8'))
  return res.end(errBody)
}

exports.writeBody = writeBody
function writeBody (req, res, body, statusCode = 200, contentType = 'application/json') {
  assert(req)
  assert(res)
  assert(body)
  assert(statusCode)
  assert(contentType)

  res.setHeader('content-type', contentType)
  res.statusCode = statusCode
  res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'))
  return res.end(req.method === 'HEAD' ? null : body)
}
