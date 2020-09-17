const Airtable = require('airtable')

const helpers = {
  getRecordsFromView (data) {
    return new Promise((resolve, reject) => {
      console.log('getting records from view...', data)
      const base = new Airtable({
        apiKey: process.env.AIRTABLE_API_KEY
      }).base(data.base)
      
      let results = []
      let retrievalOptions = {
        view: data.view
      }
      if (data.filter) {
        retrievalOptions.filterByFormula = data.filter
      }
      base(data.table).select(retrievalOptions)
      .eachPage((records, fetchNextPage) => {
        console.log('RECORDS', records)
        records.forEach(record => {
          results.push(record)
        })
        fetchNextPage()
      }, (err) => {
        console.log(err) 
        if (err) { return reject(err) }
        return resolve({
          records: results
        })
      })
    })
  }
}

module.exports = {
  async receivedCovidTraining (email) {
    return new Promise(async (resolve, reject) => {
      const employeeResults = await helpers.getRecordsFromView({
        base: 'appBVp8sxaqI2NZ6j',
        table: 'Employees',
        view: 'All Employees',
        filter: `{Email} = "${email}"`
      })
      const employee = employeeResults.records[0]
      if (!employee) {
        return resolve(false)
      } else if (employee.fields['Latest COVID-19 Training']) {
        return resolve(true)
      } else {
        return resolve(false)
      }
    })
  }
}
