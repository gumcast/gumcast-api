const pino = require('pino')

const tokenPreview = 15
const obscure = ['access_token', 'refresh_token']

function obscureQs (url, obsureFields) {
  for (const field of obsureFields) {
    const original = url?.searchParams.get(field)
    let obscured = `${original.substring(0, tokenPreview)}`
    for (const _ of original.substring(tokenPreview, original.length - 1)) { // eslint-disable-line no-unused-vars
      obscured += 'x'
    }
    url?.searchParams.set(field, obscured)
  }
}

module.exports = function getPinoLogger (cfg) {
  const logger = pino({
    level: cfg.logLevel ?? 'info',
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
          targets: [
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
  })

  return logger
}
