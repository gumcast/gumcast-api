const http = require('http')
const path = require('path')
const { createRouter } = require('./router')
const { randomUUID } = require('crypto')

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
    },
    transport: cfg.nodeEnv === 'production'
      ? {
          targets: [
            {
              target: path.join(__dirname, 'pino-datadog-logger.js'),
              options: {
                ddClientConf: {
                  authMethods: {
                    apiKeyAuth: process.env.DD_API_KEY
                  }
                },
                service: 'gumcast-api',
                ddsource: 'nodejs',
                ddtags: 'env:prod,hosting:fly'
              }
            },
            {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true
              }
            }
          ]
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
