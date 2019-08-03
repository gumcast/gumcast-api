const test = require('tape')
const data = require('./test-data.json')
const { productsWithFileData, getPurchace, getProductPermalink, getJsonfeed, getRssFeed } = require('./index.js')

test('getProductsWithFiles', t => {
  const productsWithFiles = productsWithFileData(data)

  for (const product of productsWithFiles) {
    t.true(product['file_data'].length > 0, `${product.name} has file_data`)
  }
  t.end()
})

test('Get specific purchase', t => {
  const uberBook = getPurchace(data, '7vvS02eBjHXfPeUhKxjq8A==')
  t.equal(uberBook.name, "Uber's Undoing eBook", 'retrieved correct product')
  t.end()
})

test('Get permalink', t => {
  const uberBook = getPurchace(data, '7vvS02eBjHXfPeUhKxjq8A==')
  const permalink = getProductPermalink(uberBook)
  t.equal(permalink, 'https://gumroad.com/d/redacted', 'retrieved correct permalink')
  t.end()
})

test('Generate jsonfeed', t => {
  const jf = getJsonfeed(data, {
    purchaseId: '7vvS02eBjHXfPeUhKxjq8A==',
    feed_url: `https://gumcast.com/feed.json?authToken=1234&refreshToken=1234&productId=1234`
  })

  console.dir(jf, {
    colors: true,
    depth: null
  })
  t.end()
})

test('Generate rss feed', t => {
  const rss = getRssFeed(data, {
    purchaseId: '7vvS02eBjHXfPeUhKxjq8A==',
    feed_url: `https://gumcast.com/feed.rss?authToken=1234&refreshToken=1234&productId=1234`
  })

  console.log(rss)
  t.end()
})
