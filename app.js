const
  express = require('express'),
  bodyParser = require('body-parser'),
  envoy = require('./envoy'),
  slack = require('./slack'),
  utilities = require('./utilities'),
  request = require('request');

var app = express();
app.set('port', process.env.PORT || 5000);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

let payloadsProcessed= []

app.post('/', async (req, res) => {
  // dont send duplicate slack messages if we've seen this payload already
  if (payloadsProcessed.includes(req.body.payload.id)) {
    return res.send(200)
  }
  const blocks = await utilities.createRegistrationMessageBlocks(req.body)
  console.log(JSON.stringify(blocks))
  slack.sendMessage({
    channel: process.env.SLACK_CHANNEL,
    text: `New Envoy Registration`,
    blocks: blocks
  }).then(response => {
    console.log(response)
    payloadsProcessed.push(req.body.payload.id)
    res.send(200)
  }).catch(err => {
    console.log(err)
    res.send(500)
  })
})

app.post('/slack-interactivity', async (req, res) => {
  const payload = JSON.parse(req.body.payload)
  console.log('payload', JSON.stringify(payload))

  switch (payload.type) {
    case 'block_actions':
      if (payload.actions[0].value === 'todays_report') {
        slack.sendMessage({
          channel: payload.channel.id,
          text: `:spinner: Loading Today's Report :spinner2:`,
          blocks: [
            {
              "type": "section",
              "text": {
        				"type": "mrkdwn",
        				"text": `:spinner: Loading Today's Report :spinner2:`
        			}
            },
            {
        			"type": "context",
        			"elements": [{
        				"type": "plain_text",
        				"emoji": true,
        				"text": "this could take up to a minute"
        			}]
      		  }
          ],
        })
        .then(async slackRes => {
          console.log("SLACK RES")
          console.log(slackRes)
          const todaysReport = await envoy.getTodaysReport()
          console.log('TODAYS REPORT')
          console.log(todaysReport[0])
          const blocks = await utilities.createTodaysReportBlocks(todaysReport)
          slack.updateMessage({
            channel: payload.channel.id,
            text: `*Today's Report*`,
            blocks: blocks,
            messageTimestamp: slackRes.ts
          }).then(response => {
            console.log(response)
            // res.send(200)
          }).catch(err => {
            console.log(err)
            // res.send(500)
          })
        })
      } else if (payload.actions[0].value.includes('show_visitors')) {
        slack.sendMessage({
          channel: payload.channel.id,
          text: `:spinner: Loading Visitor Report :spinner2:`,
          blocks: [
            {
              "type": "section",
              "text": {
        				"type": "mrkdwn",
        				"text": `:spinner: Loading Visitor Report :spinner2:`
        			}
            },
            {
        			"type": "context",
        			"elements": [{
        				"type": "plain_text",
        				"emoji": true,
        				"text": "this could take up to a minute"
        			}]
      		  }
          ],
        })
        .then(async slackRes => {
          const locId = payload.actions[0].value.split('show_visitors_')[1]
          const visitorReport = await envoy.getLocationVisitors(locId)
          console.log('VISITORS REPORT')
          console.log(visitorReport)
          const blocks = await utilities.createVisitorReportBlocks(visitorReport)
          slack.updateMessage({
            channel: payload.channel.id,
            text: `*${visitorReport.location.attributes.name} Visitors Today*`,
            blocks: blocks,
            messageTimestamp: slackRes.ts
          }).then(response => {
            console.log(response)
            // res.send(200)
          }).catch(err => {
            console.log(err)
            // res.send(500)
          })
        })
      }
      break
    default:
      `got a payload type that we didnt prepare for: ${payload.type}`
  }
  // slack will post OK in the channel if you just return 200
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(':spinner::sunglasses::spinner2:')
})

app.post('/slack-menu-options', function (req, res) {
  const payload = JSON.parse(req.body.payload)
  console.log(payload.type)
  switch (payload.type) {
    case 'block_suggestion':
      utilities.getPossibleJiraAssignees(payload.container.message_ts, payload.value)
      .then(users => {
        let options = users.map(user => {
          return {
            text: {
              type: 'plain_text',
              text: user.displayName
            },
            value: user.name
          }
        })
        res.status(200)
        res.json({ options: options })
      })
      break
    default:
      console.log(`Got a payload type that we didnt prepare for: ${payload.type}`)
  }
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})

module.exports = app;
