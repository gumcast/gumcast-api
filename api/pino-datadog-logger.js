module.exports = (opts) => {
  return require('pino-datadog-transport')({
    ...opts,
    onError: (data, logItems) => {
      console.error({
        data,
        logItems
      })
    }
  })
}
