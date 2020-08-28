const
  request = require('request'),
  moment = require('moment'),
  slack = require('../slack'),
  envoyUsername = process.env.ENVOY_USERNAME,
  envoyPassword = process.env.ENVOY_PASSWORD,
  envoyClientID = process.env.ENVOY_CLIENT_ID,
  envoyClientSecret = process.env.ENVOY_CLIENT_SECRET,
  envoyUrl = 'https://app.envoy.com/api/v3/';

const helpers = {
  getToken () {
    return new Promise((resolve, reject) => {
      const b64auth = `Basic ${Buffer.from(`${envoyClientID}:${envoyClientSecret}`)
                      .toString('base64')}`
      const options = {
        'method': 'POST',
        'url': 'https://app.envoy.com/a/auth/v0/token',
        'headers': {
          'Authorization': `${b64auth}`,
        },
        formData: {
          'username': `${envoyUsername}`,
          'password': `${envoyPassword}`,
          'scope': 'public,token.refresh',
          'grant_type': 'password'
        }
      };
      request(options, function (error, response) {
        if (error) throw new Error(error);
        console.log(response.body);
        return resolve(JSON.parse(response.body))
      });
    })
  },
  getLocations (token) {
    return new Promise((resolve, reject) => {
      const params = 'page%5Blimit%5D=100&page%5Boffset%5D=0'
      const options = {
        'method': 'get',
        'url': `${envoyUrl}/locations?${params}`,
        'headers': {
          'Authorization': `Bearer ${token}`,
        }
      }
      request(options, function(error, response) {
        console.log('RESPONSE FOR LOCATIONS')
        console.log(JSON.parse(response.body))
        return resolve(JSON.parse(response.body))
      })
    })
  },
  getMostRecentInvitesUrl (token, locId) {
    /* sorting by expected arrival date seems broken in the API
       get the last page of results and search the last 100 for most recent */
    return new Promise((resolve, reject) => {
      const params = `filter%5Blocation%5D=${locId}&page%5Blimit%5D=100`
      const options = {
        'method': 'get',
        'url': `${envoyUrl}/invites?${params}`,
        'headers': {
          'Authorization': `Bearer ${token}`,
        }
      }
      request(options, function(error, response) {
        const respBody = JSON.parse(response.body)
        const lastPage = respBody.links.last
        console.log(lastPage)
        return resolve(lastPage)
      })
    })
  },
  getLocationInvites(token, locId, location) {
    return new Promise(async (resolve, reject) => {
      const page = await helpers.getMostRecentInvitesUrl(token, locId)

      const options = {
        'method': 'get',
        'url': `${page}`,
        'headers': {
          'Authorization': `Bearer ${token}`,
        }
      }
      request(options, function(error, response) {
        const respBody = JSON.parse(response.body)
        const invites = respBody.data
        const todaysInvites = invites.splice(0).filter(i => {
          if (!i.attributes['expected-arrival-time']) { return false }
          return moment(i.attributes['expected-arrival-time'])
                 .isSame(moment(), 'day')
        })
        console.log('of the ' + invites.length + ' invites, ' + todaysInvites.length + ' of them are for today')
        return resolve({
          location: location,
          invites: todaysInvites
        })
      })
    })
  }
}

module.exports = {
  getTodaysReport () {
    return new Promise(async (resolve, reject) => {
      const tokenResponse = await helpers.getToken()
      const accessToken = tokenResponse.access_token
      const locations = await helpers.getLocations(accessToken)
      const activeLocations = locations.data.filter(l => {
        return !l.attributes.disabled
      })
      console.log(activeLocations.length + ' of ' + locations.data.length + ' locations are active')
      let invitePromises = []
      for (location of activeLocations) {
        invitePromises.push(helpers.getLocationInvites(accessToken, location.id, location))
      }
      Promise.all(invitePromises)
      .then(values => {
        console.log('got all promises')
        console.log(values)
        return resolve(values)
      })
      .catch(err => {
        console.log('error getting promises')
        console.log(err)
      })
    })
  }
}
