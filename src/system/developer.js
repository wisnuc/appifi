const child = require('child_process')

const setting = {}

process.argv.forEach((val, index, array) => {

  if (val === '--no-fruitmix') setting.noFruitmix = true
  if (val === '--appstore-master') setting.appstoreMaster = true
  if (val === '--fake-bootstrap') {

    console.log('fake bootsrap advertising')
    setting.fakeBootstrap = true
    child.exec('avahi-set-host-name wisnuc-generic-deadbeef')    
    child.spawn('avahi-publish-service', ['fakeBootstrap', '_http._tcp', 3002], { stdio: 'ignore' })
  }
})

module.exports = setting

