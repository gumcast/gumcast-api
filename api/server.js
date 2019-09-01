const http = require('http')
const { createRouter } = require('./router')

const finalhandler = require('finalhandler')
const morgan = require('morgan')
const corsMw = require('cors')
const { pMiddleware, pHashMiddleware } = require('p-connect')
const url = require('url')

exports.createServer = function createServer (cfg) {
  const logger = pMiddleware(morgan('dev'))
  const cors = pMiddleware(corsMw({
    origin: corsFn
  }))
  const router = pHashMiddleware(createRouter(cfg))

  const server = http.createServer(handler)

  async function handler (req, res) {
    const done = finalhandler(req, res, {
      onerror: (err) => { if (err.statusCode !== 404) console.log(err) },
      env: cfg.nodeEnv
    })

    try {
      await logger(req, res)
      await cors(req, res)
      await router(req, res, {})
      done()
    } catch (e) {
      done(e)
    }
  }

  function corsFn (origin, cb) {
    if (!origin) return cb(null, true)
    try {
      const u = new url.URL(origin)
      if (cfg.corsWhitelist.indexOf(`${u.protocol}//${u.hostname}`) !== -1) {
        cb(null, true)
      } else {
        cb(null, false)
      }
    } catch (e) {
      cb(e)
    }
  }

  return server
}
