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

app.post('/', async (req, res) => {
  const blocks = await utilities.createRegistrationMessageBlocks(req.body)
  console.log(JSON.stringify(blocks))
  slack.sendMessage({
    channel: process.env.SLACK_CHANNEL,
    text: `New Envoy Registration`,
    blocks: blocks
  }).then(response => {
    console.log(response)
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
        const todaysReport = await envoy.getTodaysReport()
        console.log('TODAYS REPORT')
        console.log(todaysReport[0])
        const blocks = await utilities.createTodaysReportBlocks(todaysReport)
        slack.sendMessage({
          channel: payload.channel.id,
          text: `*Today's Report*`,
          blocks: blocks
        }).then(response => {
          console.log(response)
          // res.send(200)
        }).catch(err => {
          console.log(err)
          // res.send(500)
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
