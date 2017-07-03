const child = require('child_process')
const UUID = require('uuid')

/**
This module is responsible for parsing command line arguments and set developer settings accordingly

@module Developer
*/
const setting = {}
const hostname = `wisnuc-generic-deadbeef${UUID.v4().split('-').join('').slice(0, 16)}`

process.argv.forEach((val, index, array) => {

  if (val === '--no-fruitmix') setting.noFruitmix = true
  if (val === '--appstore-master') setting.appstoreMaster = true
  if (val === '--fake-bootstrap') {

    console.log('fake bootsrap advertising')
    setting.fakeBootstrap = true
    child.exec(`avahi-set-host-name ${hostname}`)    
    child.spawn('avahi-publish-service', ['fakeBootstrap', '_http._tcp', 3000], { stdio: 'ignore' })
  }
})

module.exports = setting

