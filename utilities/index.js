const
  slack = require('../slack'),
  envoy = require('../envoy'),
  airtable = require('../airtable'),
  request = require('request'),
  moment = require('moment');

module.exports = {
  async createVisitorReportBlocks (visitorReport) {
    return new Promise(async (resolve, reject) => {
      let blocks = [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*${visitorReport.location.attributes.name} Visitors Today*`
          }
        },
        {
          "type": "divider"
        }
      ]
      for (const visitor of visitorReport.visitors) {
        const userName = visitor.attributes['full-name']
        const userInfo = await slack.getUserInfo(visitor.attributes.email)
        let imgUrl, userLink;
        if (userInfo.ok) {
          imgUrl = userInfo.user.profile.image_512
          userLink = `<https://groupninemedia.slack.com/team/${userInfo.user.id}|${userName}>`
        } else {
          imgUrl = `https://ui-avatars.com/api/?name=${userName}&background=ef3934&color=fff`
          userLink = userName
        }
        let description = `*${userLink}*\nPurpose of visit: ${visitor.attributes['user-data']['Purpose of visit']}\n`
        if (visitor.attributes['user-data']['Your Company']) {
          description += `Company: ${visitor.attributes['user-data']['Your Company']}\n`
        }
        if (visitor.attributes['user-data']['Host']) {
          description += `Host: ${visitor.attributes['user-data']['Host']}`
        }
        blocks.push(
          {
      			"type": "section",
      			"text": {
      				"type": "mrkdwn",
      				"text": `${description}`
      			},
      			"accessory": {
      				"type": "image",
      				"image_url": `${imgUrl}`,
      				"alt_text": `${userName}`
      			}
    		  }
        )
      }
      return resolve(blocks)
    })
  },
  async createTodaysReportBlocks (todaysReport) {
    return new Promise (async (resolve, reject) => {
      let blocks = [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*Today's Report*`
          }
        },
        {
          "type": "divider"
        }
      ]
      for (const report of todaysReport) {
        const hasInvites = report.invites.length > 0
        let locBlock = {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*${report.location.attributes.name}*\n${report.location.attributes.city}`
          }
        }
        if (hasInvites) {
          locBlock["accessory"] = {
            "type": "button",
            "text": {
              "type": "plain_text",
              "emoji": true,
              "text": "View Visitors"
            },
            "value": `show_visitors_${report.location.id}`
          }
        }
        blocks.push(locBlock)
        if (hasInvites) {
          let contextElements = []
          const inviteContextLimit = 9
          for (const [i, invite] of report.invites.entries()) {
            if (i < inviteContextLimit) {
              const userName = invite.attributes['full-name']
              const userInfo = await slack.getUserInfo(invite.attributes.email)
              const imgUrl = userInfo.ok ? userInfo.user.profile.image_512 : `https://ui-avatars.com/api/?name=${userName}&background=ef3934&color=fff`
              contextElements.push({
                "type": "image",
                "image_url": imgUrl,
                "alt_text": userName
              })
            }
          }
          contextElements.push({
            "type": "mrkdwn",
            "text": `${report.invites.length} visitors`
          })
          blocks.push({
            "type": "context",
            "elements": contextElements
          })
        } else {
          blocks.push({
      			"type": "context",
      			"elements": [{
      				"type": "mrkdwn",
      				"text": "No visitors"
      			}]
      		})
        }
      }
      return resolve(blocks)
    })
  },
  async createRegistrationMessageBlocks (registration) {
    return new Promise (async (resolve, reject) => {
      const userName = registration.payload.attributes['full-name']
      const userInfo = await slack.getUserInfo(registration.payload.attributes.email)
      const userIsTrained = await airtable.receivedCovidTraining(registration.payload.attributes.email)

      let imgUrl, userLink;
      
      if (userInfo.ok) {
        imgUrl = userInfo.user.profile.image_512
        userLink = `<https://groupninemedia.slack.com/team/${userInfo.user.id}|${userName}>`
      } else {
        imgUrl = `https://ui-avatars.com/api/?name=${userName}&background=ef3934&color=fff`
        userLink = userName
      }
      
      let registrationBlocks = [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*${userLink} registered to come into the office*`
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*Where:*\n${registration.meta.location.attributes.name}\n\n*When:*\n${moment(registration.payload.attributes['expected-arrival-time']).format('LL')}`
          },
          "accessory": {
            "type": "image",
            "image_url": `${imgUrl}`,
            "alt_text": "computer thumbnail"
          }
        },
        {
    			"type": "actions",
    			"elements": [
    				{
    					"type": "button",
    					"text": {
    						"type": "plain_text",
    						"text": "Get today's report",
    						"emoji": true
    					},
    					"value": "todays_report"
    				}
    			]
    		}
      ]
      
      let trainingBlock
      if (userIsTrained) {
        trainingBlock = {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": `:white_check_mark: ${userName} is trained on COVID-19 safety protocols`
            }
          ]
        }
      } else {
        trainingBlock = {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": ":warning: No record of COVID-19 safety training"
            }
          ]
        }
      }
      
      registrationBlocks.push(trainingBlock)
      
      return resolve(registrationBlocks)
    })
  }
}
