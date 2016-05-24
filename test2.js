var request = require('superagent')

let appsUrl = 'https://raw.githubusercontent.com/wisnuc/appifi/master/hosted/apps.json'

request.get(appsUrl)
  .set('Accept', 'text/plain')
  .end((err, res) => {
    console.log(res.text)
  })
