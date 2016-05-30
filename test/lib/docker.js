
import appstore from 'lib/appstore'
import docker from 'lib/docker'

import { testing } from 'lib/docker'

/*
let hello = new testing.imageCreateTask('ubuntu', 'latest', null)
hello.on('update', () => {
  console.log(hello.getState())
})

hello.on('end', () => {
  console.log(hello.getState())
})
*/
appstore.init()
setTimeout(() => {
    console.log(appstore.get())
    let hello = new testing.appInstTask(appstore.get().apps[7])
    hello.on('end', () => { 
      let d = hello.getState()
      console.log(hello)
      console.log(JSON.stringify(d, null, '  '))
    })
  }, 30000)
