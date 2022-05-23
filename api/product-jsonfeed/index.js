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
const { getPurchaceData } = require('../gumroad-client')

exports.getPurchace = getPurchace
function getPurchace (data, purchaseId) {
  return data.products.find(p => p.purchase_id === purchaseId)
}

exports.purchacesWithFileData = purchacesWithFileData
function purchacesWithFileData (data) {
  return data.products.filter(p => p.file_data.length > 0)
}

exports.getPurchacePermalink = getPurchacePermalink
function getPurchacePermalink (purchace) {
  const downloadURL = get(purchace, 'file_data.0.download_url')
  if (!downloadURL) return null
  const u = new url.URL(downloadURL)

  const permalinkId = u.pathname.split('/')[5]
  return `https://gumroad.com/d/${permalinkId}`
}

exports.getProductPermalink = getProductPermalink
function getProductPermalink (purchace) {
  const uniquePermalink = get(purchace, 'unique_permalink')
  return `https://gumroad.com/l/${uniquePermalink}`
}

const gumroadFaviconSvg = 'https://assets.gumroad.com/assets/logo-70cc6d4c5ab29be1bae97811585bc664524cd99897327ec47a67a76a6f69be91.svg'
// const gumroadFavicon = 'https://gumroad.com/favicon.ico'

exports.getFileFrom = getFileFrom
function getFileFrom (purchace, fileId) {
  return purchace.file_data && purchace.file_data.find(f => f.id === fileId)
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
  name,
  strategey
}) {
  const query = qs.stringify({ purchase_id, access_token, refresh_token, file_id, strategey })
  const base = `https://${fileProxyHost}` + `/file/${encodeURIComponent(name)}?${query}`
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

exports.getJsonfeed = getJsonfeed
async function getJsonfeed (data, opts = {}) {
  const {
    purchase_id,
    access_token,
    refresh_token,
    mobile_token,
    mobileApiUrl,
    hostname,
    rootpath,
    proxyFiles,
    fileProxyHost,
    incomingHost,
    alternateProductLookup
  } = opts
  assert(purchase_id)
  assert(access_token)
  assert(refresh_token)
  assert(mobile_token)
  assert(mobileApiUrl)
  assert(hostname)
  assert(rootpath != null)
  const purchace = getPurchace(data, purchase_id)
  if (!purchace) throw new Error('purchace_id not found')
  const home_page_url = getProductPermalink(purchace) || 'https://gumroad.com'

  let fileData = purchace.file_data

  if (alternateProductLookup) {
    const purchaceData = await getPurchaceData({
      access_token,
      refresh_token,
      mobile_token,
      mobileApiUrl,
      url_redirect_external_id: purchace.url_redirect_external_id
    })

    fileData = purchaceData.product.file_data
  }

  const jsonfeed = {
    version: 'https://jsonfeed.org/version/1',
    title: purchace.name,
    home_page_url,
    feed_url: getJsonFeedUrl({ purchase_id, access_token, refresh_token, hostname, rootpath }),
    description: striptags(purchace.description).trim(),
    user_comment: 'Feed generated and delivered by gumcast.com',
    icon: purchace.preview_url || gumroadFaviconSvg,
    favicon: gumroadFaviconSvg,
    author: {
      name: purchace.creator_name,
      avatar: purchace.preview_url
    },
    _itunes: cleanDeep({
      // expired: !purchace.subscription_data TODO: No longer available
      new_feed_url: incomingHost !== hostname ? getJsonFeedUrl({ purchase_id, access_token, refresh_token, hostname, rootpath }) : null
      // new_feed_url, TODO: for refresh token?,
    }),
    // expired: !purchace.subscription_data,
    items: await pMap(fileData || [], async (item, i) => {
      const feedItem = {
        id: item.id,
        title: item.name_displayable,
        content_text: item.name_displayable,
        image: purchace.preview_url,
        banner_image: purchace.preview_url,
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
          strategey: null
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
  return jsonfeedToRSS(jf, {
    feedURLFn: (feedURL, jf) => feedURL.replace(/\.json\b/, '.rss')
  })
}
