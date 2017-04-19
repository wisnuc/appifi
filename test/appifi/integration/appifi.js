import {
  appifiInit,
  appstoreStart,
  appstoreStop,
  getDockerInfor,
} from '/home/wisnuc/git/appifi/src/appifi/index'

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const run = async () =>  {
  await appifiInit()
  console.log(getDockerInfor())
  // await sleep(10000)
  // await appstoreStop()
  // console.log(getDockerInfor())
  // await sleep(10000)
  // await appstoreStart()
  // console.log(getDockerInfor())
  // await sleep(10000)
  // await appstoreStop()
  // console.log(getDockerInfor())
  // await sleep(10000)
  // await appstoreStart()
  // console.log(getDockerInfor())
}

run()

