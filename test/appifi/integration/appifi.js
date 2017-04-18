import {appifiInit, appstoreStart, appstoreStop} from '/home/wisnuc/git/appifi/src/appifi/index'


const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  await appifiInit()
  await sleep(10000)
  await appstoreStop()
  await sleep(10000)
  await appstoreStart()
}

run()

