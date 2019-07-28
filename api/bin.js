#!/usr/bin/env node
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
  console.log(`Usage: gumcast {options}`)
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
cfg.oAuthUrl = process.env.GUMCAST_OAUTH_URL || cfg.oAuthUrl
cfg.port = process.env.GUMCAST_port || cfg.port
cfg.nodeEnv = process.env.NODE_ENV || cfg.nodeEnv

assert(cfg.client_id, 'client_id is required')
assert(cfg.client_secret, 'client_secret is required')
assert(cfg.oAuthUrl, 'oAuthUrl is required')
assert(cfg.port, 'port is required')

const server = createServer(cfg)

server.once('listening', () => {
  console.log(`listening on http://localhost:${server.address().port}`)
})

server.on('error', err => {
  if (err.statusCode !== 404) console.error(err)
})

server.listen(cfg.port)

process.once('SIGINT', function () {
  server.close(() => process.exit())
})
