const http = require('http')
const { createRouter } = require('./router')

const finalhandler = require('finalhandler')
const morgan = require('morgan')
const corsMw = require('cors')
const { pMiddleware } = require('p-connect')

exports.createServer = function createServer (cfg) {
  const logger = pMiddleware(morgan(cfg.nodeEnv === 'production' ? 'combined' : 'dev'))
  const cors = pMiddleware(corsMw({
    origin: ['https://gumcast.com', /http:\/\/localhost/, /\.local(:[0-9])?/]
  }))
  const router = pMiddleware(createRouter(cfg))

  const server = http.createServer(handler)

  async function handler (req, res) {
    const done = finalhandler(req, res, {
      onerror: (err) => { if (err.statusCode !== 404) console.log(err) },
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
