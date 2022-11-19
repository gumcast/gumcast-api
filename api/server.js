const http = require('http')
const { createRouter } = require('./router')

const finalhandler = require('finalhandler')
const pino = require('pino-http')
const corsMw = require('cors')
const { pMiddleware } = require('p-connect')

const obscure = ['access_token', 'refresh_token']

function obscureQs (url, obsureFields) {
  for (const field of obsureFields) {
    const original = url?.searchParams.get(field)
    let obscured = `${original.substring(0, 5)}`
    for (const _ of original.substring(5, original.length - 1)) { // eslint-disable-line no-unused-vars
      obscured += 'x'
    }
    url?.searchParams.set(field, obscured)
  }
}

exports.createServer = function createServer (cfg) {
  const logger = pMiddleware(pino({
    redact: {
      paths: ['req.url'],
      censor: (value, path) => {
        try {
          const url = new URL(`https://example.com${value}`)
          obscureQs(url, obscure)
          return `${url.pathname}${url.search}`
        } catch (e) { return value }
      }
    },
    transport: cfg.nodeEnv === 'production'
      ? {
          target: 'pino-datadog-transport',
          options: {
            ddClientConf: {
              authMethods: {
                apiKeyAuth: process.env.DD_API_KEY
              }
            }
          },
          level: 'error' // minimum log level that should be sent to datadog
        }
      : {
          target: 'pino-pretty',
          options: {
            colorize: true
          }
        }
  }))
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
