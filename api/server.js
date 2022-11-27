const http = require('http')
const { createRouter } = require('./router')
const { randomUUID } = require('crypto')

const finalhandler = require('finalhandler')
const pino = require('pino-http')
const corsMw = require('cors')
const { pMiddleware } = require('p-connect')

exports.createServer = function createServer (cfg, serverLogger) {
  const logger = pMiddleware(pino({
    logger: serverLogger,
    genReqId: function (req, res) {
      if (req.id) return req.id
      let id = req?.headers?.['X-Request-Id']
      if (id) return id
      id = randomUUID()
      res.setHeader('X-Request-Id', id)
      return id
    },
    customLogLevel: function (req, res, err) {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn'
      } else if (res.statusCode >= 500 || err) {
        return 'error'
      }
      return 'info'
    }
  }))
  const cors = pMiddleware(corsMw({
    origin: ['https://gumcast.com', /http:\/\/localhost/, /\.local(:[0-9])?/]
  }))
  const router = pMiddleware(createRouter(cfg))

  const server = http.createServer(handler)

  async function handler (req, res) {
    const done = finalhandler(req, res, {
      onerror: (err) => { if (err.statusCode !== 404) req.log.error(err, 'Request error') },
      env: cfg.nodeEnv
    })

    try {
      await logger(req, res)
      await cors(req, res)
      if (['production'].indexOf(process.env.NODE_ENV) >= 0 && req.headers['x-forwarded-proto'] !== 'https') {
        res.writeHead(301, {
          Location: 'https://' + req.headers.host + req.url
        })
        res.end()
      } else {
        await router(req, res, {})
      }
      done()
    } catch (e) {
      done(e)
    }
  }

  return server
}
