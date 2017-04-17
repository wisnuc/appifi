import appifiConfig from '/home/wisnuc/git/appifi/src/appifi/index'
import appifiHTTPServer from '/home/wisnuc/git/appifi/src/appifi/appifi'

import appifiServer from '/home/wisnuc/git/appifi/src/appifi/server'

appifiHTTPServer(appifiConfig)

// let test = {
//   operation: 'daemonStart'
// }
// appifiServer.operation(test, () => {
//   console.log('Run, Appifi run!')
// })