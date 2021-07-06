const
  express = require('express'),
  bodyParser = require('body-parser'),
  envoy = require('./envoy'),
  slack = require('./slack'),
  airtable = require('./airtable'),
  utilities = require('./utilities'),
  request = require('request');

var app = express();
app.set('port', process.env.PORT || 5000);

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

let payloadsProcessed = []

app.post('/', async (req, res) => {
  // dont send duplicate slack messages if we've seen this payload already
  if (payloadsProcessed.includes(req.body.payload.id)) {
    return res.send(200)
  }
  const blocks = await utilities.createRegistrationMessageBlocks(req.body)
  slack.sendMessage({
    channel: process.env.SLACK_CHANNEL,
    text: `New Envoy Registration`,
    blocks: blocks
  }).then(response => {
    payloadsProcessed.push(req.body.payload.id)
    // res.send(200)
  }).catch(err => {
    console.log('err', err)
    // res.send(500)
  })

  // send a private slack if someone is not eligible for voluntary returns but is showing up to an office with returns
  const officesWithReturns = ['568 Broadway']
  const isComingToOfficeWithReturns = officesWithReturns.includes(req.body.meta.location.attributes.name)
  console.log('req.body.meta.location.attributes.name', req.body.meta.location.attributes.name)
  console.log('isComingToOfficeWithReturns', isComingToOfficeWithReturns)
  if (!isComingToOfficeWithReturns) return res.send(200)

  const voluntaryReturnAccess = await airtable.eligibleForVoluntaryReturns(req.body.payload.attributes.email)
  console.log('voluntaryReturnAccess', JSON.stringify(voluntaryReturnAccess))
  const employeeCanVoluntarilyReturn = voluntaryReturnAccess.eligible
  const employee = voluntaryReturnAccess.employee
  
  if (!employeeCanVoluntarilyReturn) {
    slack.sendMessage({
      channel: 'C0271TMHC22',
      text: `${employee.Name} (${employee.email}) is attempting to come to ${req.body.meta.location.attributes.name} but they are not eligible for voluntary returns`,
    }).then(response => {
      console.log('sent slack msg', JSON.stringify(response))
      return res.send(200)
    }).catch(err => {
      console.log('got an error sending slack msg', JSON.stringify(err))
      return res.send(500)
    })
  }
})

app.post('/slack-interactivity', async (req, res) => {
  const payload = JSON.parse(req.body.payload)

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
          const todaysReport = await envoy.getTodaysReport()
          const blocks = await utilities.createTodaysReportBlocks(todaysReport)
          slack.updateMessage({
            channel: payload.channel.id,
            text: `*Today's Report*`,
            blocks: blocks,
            messageTimestamp: slackRes.ts
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
          const blocks = await utilities.createVisitorReportBlocks(visitorReport)
          slack.updateMessage({
            channel: payload.channel.id,
            text: `*${visitorReport.location.attributes.name} Visitors Today*`,
            blocks: blocks,
            messageTimestamp: slackRes.ts
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

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})

module.exports = app;
