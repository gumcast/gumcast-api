const http = require('http')
const { createRouter } = require('./router')
const finalhandler = require('finalhandler')
const morgan = require('morgan')

exports.createServer = function createServer (cfg) {
  const logger = morgan('dev')
  const router = createRouter(cfg)
  const server = http.createServer(handler)

  function handler (req, res) {
    const done = finalhandler(req, res, {
      onerror: errorHandler,
      env: cfg.nodeEnv
    })

    logger(req, res, runRouter)

    function runRouter (err) {
      if (err) return done(err)
      try {
        router(req, res, {}, done)
      } catch (e) {
        done(e)
      }
    }
  }

  return server
}

function errorHandler (err) {
  if (err.statusCode !== 404) console.error(err)
}

// CORS
// https://gist.github.com/balupton/3696140
