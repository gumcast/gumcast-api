/* eslint-disable camelcase */
const url = require('url')
const jsonfeedToRSS = require('jsonfeed-to-rss')
const striptags = require('striptags')
const assert = require('nanoassert')
const pMap = require('p-map')
const qs = require('qs')
const cleanDeep = require('clean-deep')
const get = require('lodash.get')
const redirectChain = require('redirect-chain')({
  maxRedirects: 5
})
const { getPurchaseData } = require('../gumroad-client')

exports.getPurchase = getPurchase
function getPurchase (data, purchaseId) {
  return data.products.find(p => p.purchase_id === purchaseId)
}

exports.purchasesWithFileData = purchasesWithFileData
function purchasesWithFileData (data) {
  return data.products.filter(p => p.file_data.length > 0)
}

exports.getPurchasePermalink = getPurchasePermalink
function getPurchasePermalink (purchase) {
  const downloadURL = get(purchase, 'file_data.0.download_url')
  if (!downloadURL) return null
  const u = new url.URL(downloadURL)

  const permalinkId = u.pathname.split('/')[5]
  return `https://gumroad.com/d/${permalinkId}`
}

exports.getProductPermalink = getProductPermalink
function getProductPermalink (purchase) {
  const uniquePermalink = get(purchase, 'unique_permalink')
  return `https://gumroad.com/l/${uniquePermalink}`
}

const gumroadFaviconSvg = 'https://assets.gumroad.com/assets/logo-70cc6d4c5ab29be1bae97811585bc664524cd99897327ec47a67a76a6f69be91.svg'
// const gumroadFavicon = 'https://gumroad.com/favicon.ico'

exports.getFileFrom = getFileFrom
function getFileFrom (purchase, fileId) {
  return purchase.file_data && purchase.file_data.find(f => f.id === fileId)
}

exports.getRedirectURL = getRedirectURL
async function getRedirectURL (file, mobile_token) {
  if (file?.download_url) {
    const tmpFileURL = await redirectChain.destination(file.download_url)
    return tmpFileURL
  }
  if (file?.streaming_url) {
    const redirectTarget = `${file.streaming_url}.json?mobile_token=${mobile_token}`
    const response = await fetch(redirectTarget)
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json()
      return body.playlist_url
    } else {
      const body = await response.text()
      throw new Error(`${response.status} ${body}`)
    }
  }
  return null
}

function mimeType (item) {
  if (item.filetype === 'm4a' && item.filegroup === 'audio') return 'audio/m4a'
  if (item.filetype === 'mp3' && item.filegroup === 'audio') return 'audio/mpeg '
  return `${item.filegroup}/${item.filetype}`
}

function getFileUrl ({
  purchase_id,
  access_token,
  refresh_token,
  file_id,
  fileProxyHost,
  transport,
  name,
  strategey
}) {
  const query = qs.stringify({ purchase_id, access_token, refresh_token, file_id, strategey })
  const base = `${transport}://${fileProxyHost}` + `/file/${encodeURIComponent(name)}?${query}`
  const u = new url.URL(base)
  return u.toString()
}

function getJsonFeedUrl ({
  purchase_id,
  access_token,
  refresh_token,
  hostname,
  rootpath
}) {
  const query = qs.stringify({ access_token, refresh_token, purchase_id })
  return `https://${hostname}${rootpath}/feed.json?${query}`
}

const disabledCopy = ['This feed has been disabled because too many people were subscribed to it.',
  'If this is your subscription, please log into gumcast.com and re-create a new feed URL to continue subscribing.',
  'Ensure that you don\'t add it to a globally available podcast directory or share it with anyone else.',
  'If you are not the subscription owner, please create your own personal subscription and create your own gumcast.com podcast feed.'].join(' ')

exports.getJsonfeed = getJsonfeed
async function getJsonfeed (data, opts = {}) {
  const {
    disabledToken,
    purchase_id,
    access_token,
    refresh_token,
    mobile_token,
    mobileApiUrl,
    hostname,
    transport,
    rootpath,
    proxyFiles,
    fileProxyHost,
    // incomingHost,
    alternateProductLookup
  } = opts
  assert(purchase_id)
  assert(access_token)
  assert(refresh_token)
  assert(mobile_token)
  assert(mobileApiUrl)
  assert(hostname)
  assert(rootpath != null)
  const purchase = getPurchase(data, purchase_id)
  if (!purchase) throw new Error('purchase_id not found')
  const home_page_url = getProductPermalink(purchase) || 'https://gumroad.com'

  let fileData = purchase.file_data

  if (alternateProductLookup) {
    const purchaseData = await getPurchaseData({
      access_token,
      refresh_token,
      mobile_token,
      mobileApiUrl,
      url_redirect_external_id: purchase.url_redirect_external_id
    })

    fileData = purchaseData.product.file_data
  }

  if (typeof fileData?.sort === 'function') {
    fileData.sort((item1, item2) => {
      return (new Date(item1.created_at)) - (new Date(item2.created_at))
    })
  }

  const jsonfeed = {
    version: 'https://jsonfeed.org/version/1',
    title: disabledToken ? `[FEED DISABLED. TOO MANY SUBSCRIBERS. PLEASE MAKE A NEW FEED AT GUMCAST.COM] ${purchase.name}` : purchase.name,
    home_page_url,
    feed_url: getJsonFeedUrl({ purchase_id, access_token, refresh_token, hostname, rootpath }),
    description: disabledToken
      ? disabledCopy
      : striptags(purchase.description).trim(),
    user_comment: 'Feed generated and delivered by gumcast.com',
    icon: purchase.preview_url || gumroadFaviconSvg,
    favicon: gumroadFaviconSvg,
    author: {
      name: purchase.creator_name,
      avatar: purchase.preview_url
    },
    _itunes: cleanDeep({
      block: true
    }),
    // expired: !purchase.subscription_data,
    items: await pMap(fileData || [], async (item, i) => {
      const feedItem = {
        id: item.id,
        title: isStream(item) ? `[Stream only] ${item.name_displayable}` : item.name_displayable,
        content_text: disabledToken ? disabledCopy : item.name_displayable,
        image: purchase.preview_url,
        banner_image: purchase.preview_url,
        date_published: item.created_at,
        attachments: [{
          url: item.download_url,
          mime_type: mimeType(item),
          title: item.name_displayable,
          size_in_bytes: item.size
        }],
        _itunes: {
          episode: i + 1
        }
      }

      if (proxyFiles === 'redirect-chain') {
        // resolve the final file URL.  These appear short lived at times.
        feedItem.attachments[0].url = await redirectChain.destination(feedItem.attachments[0].url)
        return feedItem
      } else if (proxyFiles === 'raw') {
        // No file URL processing
        return feedItem
      } else {
        const params = {
          purchase_id,
          access_token,
          refresh_token,
          file_id: item.id,
          fileProxyHost,
          name: item.name,
          strategey: null,
          transport
        }

        if (['proxy'].some(i => proxyFiles === i)) params.strategey = 'proxy'
        else if (['true', 'redirect'].some(i => proxyFiles === i)) params.strategey = 'redirect'
        else params.strategey = 'redirect'
        feedItem.attachments[0].url = getFileUrl(params)
        return feedItem
      }
    }, { concurrency: 2 })
  }

  jsonfeed.items = jsonfeed.items.reverse()

  return jsonfeed
}

exports.getRssFeed = getRssFeed
async function getRssFeed (data, opts = {}) {
  const jf = await getJsonfeed(data, opts)
  return {
    rss: jsonfeedToRSS(jf, {
      feedURLFn: (feedURL, jf) => feedURL.replace(/\.json\b/, '.rss')
    }),
    jf
  }
}

function isStream (file) {
  return file?.streaming_url && !file?.download_url
}
