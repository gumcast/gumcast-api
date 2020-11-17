/* eslint-disable camelcase */
const qs = require('qs')
const bent = require('bent')
const formurlencoded = require('form-urlencoded').default
const assert = require('nanoassert')

exports.getPurchaceData = getPurchaceData
async function getPurchaceData ({
  access_token,
  refresh_token,
  mobile_token,
  url_redirect_external_id,
  mobileApiUrl
}) {
  assert(access_token, 'access_token required')
  assert(refresh_token, 'refresh_token required')
  assert(mobile_token, 'mobile_token required')
  assert(url_redirect_external_id, 'url_redirect_external_id required')
  assert(mobileApiUrl, 'mobileApiUrl required')

  const get = bent(mobileApiUrl, 'GET', 'json', 200, {
    accept: 'application/json',
    Authorization: 'Bearer ' + access_token
  })

  const params = {
    mobile_token: mobile_token
  }

  return get(`/url_redirects/get_url_redirect_attributes/${url_redirect_external_id}.json/?${qs.stringify(params)}`)
}

exports.getPurchaces = getPurchaces
async function getPurchaces ({
  access_token,
  refresh_token,
  mobile_token,
  mobileApiUrl
}) {
  assert(access_token, 'access_token required')
  assert(refresh_token, 'refresh_token required')
  assert(mobile_token, 'mobile_token required')
  assert(mobileApiUrl, 'mobileApiUrl required')

  const get = bent(mobileApiUrl, 'GET', 'json', 200, {
    accept: 'application/json',
    Authorization: 'Bearer ' + access_token
  })

  const params = {
    include_mobile_unfriendly_products: true,
    include_subscriptions: true,
    mobile_token: mobile_token
  }

  return get(`/purchases/index.json?${qs.stringify(params)}`)
}

exports.getAccessTokenFromPassword = getAccessTokenFromPassword
async function getAccessTokenFromPassword ({
  oAuthUrl,
  client_id,
  username,
  password,
  client_secret
}) {
  assert(oAuthUrl, 'oAuthUrl required')
  assert(client_id, 'client_id required')
  assert(username, 'username required')
  assert(password, 'password required')
  assert(client_secret, 'client_secret required')

  const post = bent(oAuthUrl, 'POST', 'json', 200, {
    accept: 'application/json',
    'Content-Type': 'multipart/form-data'
  })

  const formData = formurlencoded({
    client_id: client_id,
    username: username,
    password: password,
    client_secret: client_secret,
    grant_type: 'password',
    scope: 'mobile_api'
  })

  return post('/token', formData)
}
