const { hashRoute } = require('p-connect')
const parseurl = require('parseurl')
const qs = require('qs')

module.exports = cfg => hashRoute(rss(cfg))
function rss (cfg) {
  function validate (query) {
    if (!query) return false
    if (!query.access_token) return false
    if (!query.refresh_token) return false
    return true
  }

  return async (req, res) => {
    res.setHeader('content-type', 'application/json')
    const url = parseurl(req)
    const query = qs.parse(url.query)
    if (!validate(query)) {
      res.statusCode = 400
      const errBody = JSON.stringify({
        error: 'Missing access_token in body'
      })
      res.setHeader('Content-Length', Buffer.byteLength(errBody, 'utf8'))
      return res.end(errBody)
    }
    res.end('hello world')
  }
}
