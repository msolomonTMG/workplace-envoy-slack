const
  slack = require('../slack'),
  envoy = require('../envoy'),
  request = require('request'),
  moment = require('moment'),
  pplSlackChannel = process.env.SLACK_CHANNEL;

const helpers = {
  supplementStatusWithEmoji (status) {
    // put an emoji next to the status depedning on what it is
    switch (status) {
      case 'Waiting for support':
        return ':new: ' + status
        break
      case 'In Progress':
        return ':arrow_forward: ' + status
        break
      case 'Waiting for customer':
      case 'Waiting on Third Party':
        return ':double_vertical_bar: ' + status
        break
      case 'Resolved':
      case 'Cancelled':
        return ':white_check_mark: ' + status
        break
      default:
        console.log(`No emoji for ${status}`)
        return status
    }
  },
  formatBlocks (payload) {
    const { 
      text,
      issueKey,
      rating,
      summary, 
      reporter, 
      assignee, 
      status, 
      description 
    } = payload
    
    let shortDescription = ''
    //slack allows blocks to be 3000 chars but we use 500 to keep things short
    const maxDescriptionLength = 500
    if (description.length >= maxDescriptionLength) {
      shortDescription = `${description.substring(0, 500)}...`
    } else {
      shortDescription = description
    }
    
    let blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${text}`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*<${jiraUrl}/browse/${issueKey}|${summary}>*`
        }
      },
      {
        type: 'context',
        elements: [{
          type: 'plain_text',
          text: `${reporter}`,
          emoji: true
        }]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status*\n${status}`
          }
        ]
      },
      {
        type: 'section',
        block_id: `${issueKey}`,
        text: {
          type: 'mrkdwn',
          text: `*Assignee*\n${assignee}`
        },
        accessory: {
          action_id: 'assign_issue',
          type: 'external_select',
          placeholder: {
            type: 'plain_text',
            text: 'Assign to...'
          },
          min_query_length: 0
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Description*\n${shortDescription}`
        }
      }
    ]
    if (rating) {
      let starRating = ''
      let i = 0
      while (i < rating) {
        starRating += ':star: '
        if (i + 1 === rating) {
          blocks = blocks.concat([
            {
              type: 'divider'
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Rating:* ${starRating}`
              }
            }
          ])
          return blocks
        }
        i++
      }
    } else {
      return blocks
    }
  }
}

module.exports = {
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
      for (const location of todaysReport) {
        console.log('LOCATioN')
        console.log(location)
        let locBlock = {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*${location.name}*\n${location.location.attributes.city}`
          },
          "accessory": {
            "type": "button",
            "text": {
              "type": "plain_text",
              "emoji": true,
              "text": "View Visitors"
            },
            "value": "click_me_123"
          }
        }
        // const userInfo = await slack.getUserInfo(invite.attributes.email)
        // const imgUrl = userInfo.ok ? userInfo.user.profile.image_512 : `https://ui-avatars.com/api/?name=${invite.attributes['full-name']}&background=ef3934&color=fff`
        // invite.profileImg = imgUrl
        blocks.push(locBlock)
        if (location.invites.length > 0) {
          console.log('first invite...')
          console.log(location.invites[0])
          let contextElements = []
          for (const invite of location.invites) {
            console.log('INVITE')
            console.log(JSON.stringify(invite))
            const userName = invite.attributes['full-name']
            const userInfo = await slack.getUserInfo(invite.attributes.email)
            const imgUrl = userInfo.ok ? userInfo.user.profile.image_512 : `https://ui-avatars.com/api/?name=${userName}&background=ef3934&color=fff`
            contextElements.push({
              "type": "image",
					    "image_url": imgUrl,
					    "alt_text": userName
            })
          }
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
      console.log(blocks)
      
      return resolve(blocks)
    })
  },
  async createRegistrationMessageBlocks (registration) {
    return new Promise (async (resolve, reject) => {
      const userName = registration.payload.attributes['full-name']
      const userInfo = await slack.getUserInfo(registration.payload.attributes.email)
      console.log('USER INFO')
      console.log(userInfo)
      console.log('Show Avatar is:', userInfo.ok )
      let imgUrl, userLink;
      
      if (userInfo.ok) {
        imgUrl = userInfo.user.profile.image_512
        userLink = `<https://groupninemedia.slack.com/team/${userInfo.user.id}|${userName}>`
      } else {
        imgUrl = `https://ui-avatars.com/api/?name=${userName}&background=ef3934&color=fff`
        userLink = userName
      }
      
      return resolve([
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
      ])
    })
  },
  // nothing used below here
  sendIssueCreatedNotification (jiraIssue) {
    return new Promise ((resolve, reject) => {
      slack.sendMessage({
        channel: pplSlackChannel,
        text: 'A new request has been made!',
        blocks: helpers.formatBlocks({
          issueKey: `${jiraIssue.key}`,
          text: 'A new request has been made!',
          summary: `${jiraIssue.fields.summary}`,
          reporter: jiraIssue.fields.reporter.displayName ? `${jiraIssue.fields.reporter.displayName}` : `${jiraIssue.fields.reporter.emailAddress}`,
          assignee: jiraIssue.fields.assignee ? `${jiraIssue.fields.assignee.displayName}` : '',
          status: helpers.supplementStatusWithEmoji(jiraIssue.fields.status.name),
          description: `${jiraIssue.fields.description.replace(/({color[:#a-zA-z0-9]*})/g, '')}`
        })
      })
      .then(message => {
        return resolve(message)
      })
      .catch(error => {
        return reject(error)
      })
    })
  },
  updateIssueSlackMessageFromJiraWebhook (jiraWebhook) {
    return new Promise((resolve, reject) => {
      const jiraIssue = jiraWebhook.issue
      // user who updated the issue
      let updater = jiraWebhook.user.displayName ? jiraWebhook.user.displayName : jiraWebhook.user.name
      // user who has been assigned the issue
      let assignee = jiraIssue.assignee ? jiraIssue.fields.assignee.displayName ? jiraIssue.fields.assignee.displayName : jiraIssue.fields.assignee.name : 'Not assigned'
      // determine text of slack message based on latest changes
      let text = ''
      for (const change of jiraWebhook.changelog.items) {
        text += `${updater} updated the ${change.field} of this request from "${change.fromString}" to "${change['toString']}." `
      }
      
      slack.updateMessage({
        channel: pplSlackChannel,
        messageTimestamp: jiraIssue.fields[`${jiraSlackMessageField}`],
        text: text,
        blocks: helpers.formatBlocks({
          issueKey: `${jiraIssue.key}`,
          text: `${text}`,
          rating: jiraIssue.fields[`${jiraRatingField}`] ? jiraIssue.fields[`${jiraRatingField}`].rating : undefined,
          summary: `${jiraIssue.fields.summary}`,
          reporter: jiraIssue.fields.reporter.displayName ? `${jiraIssue.fields.reporter.displayName}` : `${jiraIssue.fields.reporter.emailAddress}`,
          assignee: jiraIssue.fields.assignee ? `${jiraIssue.fields.assignee.displayName}` : '',
          status: helpers.supplementStatusWithEmoji(jiraIssue.fields.status.name),
          description: `${jiraIssue.fields.description.replace(/({color[:#a-zA-z0-9]*})/g, '')}`
        })
      })
      .then(message => {
        return resolve(message)
      })
      .catch(error => {
        return reject(error)
      })
    })
  },
  updateIssueSlackMessageFromSlackInteractivity (slackInteractivity, jiraIssue) {
    return new Promise((resolve, reject) => {
      let assignee = jiraIssue.fields.assignee.displayName ? jiraIssue.fields.assignee.displayName : jiraIssue.fields.assignee.name
      let text = ''
      switch (slackInteractivity.actions[0].action_id) {
        case 'assign_issue':
          text += `${slackInteractivity.user.username} updated the assignee of this request to ${assignee}`
          break
        default:
          console.log(`something happened in slack that we werent prepared for: ${slackInteractivity.actions[0].name}`)
      }
      slack.updateMessage({
        channel: pplSlackChannel,
        messageTimestamp: slackInteractivity.message.ts,
        text: text,
        blocks: helpers.formatBlocks({
          issueKey: `${jiraIssue.key}`,
          text: `${text}`,
          summary: `${jiraIssue.fields.summary}`,
          reporter: jiraIssue.fields.reporter.displayName ? `${jiraIssue.fields.reporter.displayName}` : `${jiraIssue.fields.reporter.emailAddress}`,
          assignee: jiraIssue.fields.assignee ? `${jiraIssue.fields.assignee.displayName}` : '',
          status: helpers.supplementStatusWithEmoji(jiraIssue.fields.status.name),
          description: `${jiraIssue.fields.description.replace(/({color[:#a-zA-z0-9]*})/g, '')}`
        })
      })
      .then(message => {
        return resolve(message)
      })
      .catch(error => {
        return reject(error)
      })
    })
  },
}
