const 
  request = require('request'),
  slackAuthToken = process.env.SLACK_BOT_TOKEN;

module.exports = {
  /*
   * Send messages to slack channels
   * @param {array} urls - URLs (webhooks) to send slack messages to
   * @param {string} text - The text of the slack message
   * @param {array} attachments - Array of objects for slack attachments
  */
  sendMessage (payload) {
    return new Promise((resolve, reject) => {
      const { channel, text, blocks, attachments } = payload
      
      let postData = {
        channel: channel,
        text: text
      }
      
      blocks ? postData.blocks = blocks : false
      attachments ? postData.attachments = attachments : false
      
      let options = {
        method: 'post',
        body: postData,
        json: true,
        url: 'https://slack.com/api/chat.postMessage',
        headers: {
          'Authorization': `Bearer ${slackAuthToken}`,
          'Content-type': 'application/json',
          'charset': 'UTF-8'
        }
      }
      
      request(options, function(err, res, body) {
        if (err) { return reject(err) }
        return resolve(body)
      })
    })
  },
  getUserInfo (email) {
    return new Promise ((resolve, reject) => {
      console.log('looking up: ', email)

      const options = {
        method: 'get',
        url: `https://slack.com/api/users.lookupByEmail?email=${email}`,
        headers: {
          'Authorization': `Bearer ${slackAuthToken}`,
          'Content-type': 'application/json',
          'charset': 'UTF-8'
        }
      }
      
      request(options, function(err, res, body) {
        if (err) { return reject(err) }
        return resolve(JSON.parse(body))
      })
    })
  },
  updateMessage (payload) {
    return new Promise((resolve, reject) => {
      const { channel, text, blocks, messageTimestamp, attachments } = payload
      
      let postData = {
        channel: channel,
        text: text,
        ts: messageTimestamp
      }
      
      blocks ? postData.blocks = blocks : false
      attachments ? postData.attachments = attachments: false
      
      let options = {
        method: 'post',
        body: postData,
        json: true,
        url: 'https://slack.com/api/chat.update',
        headers: {
          'Authorization': `Bearer ${slackAuthToken}`,
          'Content-type': 'application/json',
          'charset': 'UTF-8'
        }
      }
      
      request(options, function(err, res, body) {
        if (err) { return reject(err) }
        return resolve(body)
      })
    })
  }
}
