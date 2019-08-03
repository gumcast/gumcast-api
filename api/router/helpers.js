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
async function validationFailed (res, msg) {
  res.statusCode = 400
  const errBody = JSON.stringify({
    error: msg
  })
  res.setHeader('Content-Length', Buffer.byteLength(errBody, 'utf8'))
  return res.end(errBody)
}
