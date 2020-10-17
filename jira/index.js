const 
  request = require('request'),
  jiraUrl = process.env.JIRA_URL,
  jiraAccessToken = process.env.JIRA_ACCESS_TOKEN,
  jiraUsername = process.env.JIRA_USERNAME;

const helpers = {
  getAccountIdByEmail (email) {
    return new Promise ((resolve, reject) => {
      const options = {
        method: 'GET',
        url: `${jiraUrl}/rest/api/3/user/search?query=${email}`,
        headers: {
          'Authorization': 'Basic ' + 
                           Buffer.from(jiraUsername + ':' + jiraAccessToken)
                           .toString('base64'),
          'Accept': 'application/json'
        }
      }
      request(options, function(err, res, body) {
        if (err) { return reject(err) }
        const firstResult = JSON.parse(body)[0]
        if (!firstResult) { return null }
        return resolve(firstResult.accountId)
      })
    })
  },
  searchIssues (jql) {
    return new Promise ((resolve, reject) => {
      const options = {
        method: 'GET',
        url: `${jiraUrl}/rest/api/3/search?jql=${encodeURI(jql)}`,
        headers: {
          'Authorization': 'Basic ' + 
                           Buffer.from(jiraUsername + ':' + jiraAccessToken)
                           .toString('base64'),
          'Accept': 'application/json'
        }
      }
      request(options, function(err, res, body) {
        if (err) { return reject(err) }
        const issues = JSON.parse(body).issues
        return resolve(issues)
      })
    })
  }
}

module.exports = {
  async getRecentTickets (email) {
    const accountId = await helpers.getAccountIdByEmail(email)
    let jql = 'project = WKPLC and ('
    if (accountId) {
      jql += `reporter = ${accountId} or "Request participants" = ${accountId} or `
    }
    jql += `text ~ "${email}") and createdDate > endOfDay(-7)`
    const issues = await helpers.searchIssues(jql)
    return issues
  }
}
