#!/usr/bin/env node

if (
  process.env.NODE_ENV === 'production' &&
  process.env.DD_SITE &&
  process.env.DD_API_KEY) {
  const tracer = require('dd-trace').init({
    logInjection: true
  })
  exports.tracer = tracer
}

const minimist = require('minimist')
const cliOpts = require('cliclopts')
const pkg = require('../package.json')
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { createServer } = require('./server')

const allowedOptions = [
  {
    name: 'config',
    abbr: 'c',
    help: 'path to a config.json file'
  },
  {
    name: 'help',
    abbr: 'h',
    help: 'show help',
    boolean: true
  },
  {
    name: 'version',
    abbr: 'v',
    help: 'print the version of the program'
  }
]

const opts = cliOpts(allowedOptions)
const argv = minimist(process.argv.slice(2), opts.options())

if (argv.version) {
  console.log(`${pkg.name} v${pkg.version}`)
  process.exit()
}

if (argv.help) {
  console.log(`${pkg.name}: ${pkg.description}\n`)
  console.log('Usage: gumcast {options}')
  opts.print()
  process.exit()
}

const cfg = {
  // name: 'GumCast',
  oAuthUrl: 'https://gumroad.com/oauth',
  client_id: null,
  client_secret: null,
  port: 8080,
  nodeEnv: 'production'
}
if (argv.config) {
  const configFilePath = path.resolve(process.cwd(), argv.config)
  console.log(`Loading ${configFilePath}`)
  const configFile = fs.readFileSync(path.resolve(process.cwd(), argv.config), 'utf8')
  Object.assign(cfg, JSON.parse(configFile))
}

cfg.client_id = process.env.GUMCAST_CLIENT_ID || cfg.client_id
cfg.client_secret = process.env.GUMCAST_CLIENT_SECRET || cfg.client_secret
cfg.mobile_token = process.env.GUMCAST_MOBILE_TOKEN || cfg.mobile_token
cfg.oAuthUrl = process.env.GUMCAST_OAUTH_URL || cfg.oAuthUrl
cfg.mobileApiUrl = process.env.GUMCAST_MOBILE_API_URL || cfg.mobileApiUrl
cfg.port = process.env.PORT || cfg.port
cfg.nodeEnv = process.env.NODE_ENV || cfg.nodeEnv
cfg.hostname = process.env.GUMCAST_HOSTNAME || cfg.hostname
cfg.rootpath = process.env.GUMCAST_ROOTPATH || cfg.rootpath || ''
cfg.fileProxyHost = process.env.GUMCAST_FILE_PROXY_HOST || cfg.fileProxyHost || cfg.hostname + cfg.rootpath
cfg.corsWhitelist = process.env.GUMCAST_CORS_WHITELIST || cfg.corsWhitelist
cfg.alternateProductLookup = process.env.GUMCAST_ALTERNATE_PRODUCT_LOOKUP || cfg.alternateProductLookup

assert(cfg.client_id, 'client_id is required')
assert(cfg.client_secret, 'client_secret is required')
assert(cfg.mobile_token, 'mobile_token is required')
assert(cfg.oAuthUrl, 'oAuthUrl is required')
assert(cfg.mobileApiUrl, 'mobileApiUrl is required')
assert(cfg.port, 'port is required')
assert(cfg.rootpath != null, 'rootpath is required')
assert(cfg.fileProxyHost, 'fileProxyHost is required')
assert(cfg.corsWhitelist, 'corsWhitelist is required')

console.log(cfg.nodeEnv !== 'production' ? 'RUNNING IN DEBUG MODE' : 'RUNNING IN PRODUCTION MODE')

const server = createServer(cfg)

server.once('listening', () => {
  console.log(`listening on http://localhost:${server.address().port}`)
})

server.on('error', err => {
  if (err.statusCode !== 404) console.log(err)
})

server.listen(cfg.port)

process.once('SIGINT', quit)
process.once('SIGTERM', quit)

function quit () {
  server.close(() => {
    console.log('server gracefully shutdown')
    process.exit(0)
  })
}
