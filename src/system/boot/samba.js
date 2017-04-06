const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

const debug = require('debug')('samba')

const fork = (cfs, init, callback) => {

    console.log(`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)

	let froot = path.join(cfs.mountpoint, 'wisnuc', 'samba')
	let modpath = path.resolve(__dirname, '../../samba/samba')

    console.log(`bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`)

	console.log(`forking samba, waiting for 120s before timeout`)

  let finished = false
  let samba = child.fork(modpath, ['--path', froot], { 
    env: Object.assign({}, process.env, { FORK: 1 }),
    stdio: ['ignore', 1, 2, 'ipc']  // this looks weird, but must be in this format, see node doc
  })

  samba.on('error', err => {

    if (finished === true) return

    console.log('[BOOT] samba error: ', err)

    samba.kill()
    finished = true
    callback(err)
  })

  samba.on('message', message => {

    if (finished === true) return

    console.log(`[BOOT] samba message: ${message}`)

    // switch (message.type) {
    //   case 'fruitmixStarted':

	// 	console.log('[fork fruitmix] fruitmixStarted message received from child process')

    //     if (init) {
    //       samba.send('message', {
    //         type: 'createFirstUser',
    //         username: init.username,
    //         password: init.password
    //       })
    //     }
    //     else {
    //       samba.removeAllListeners()
    //       finished = true
    //       callback(null, samba) 
    //     }
    //     break

    //   case 'createFirstUserDone':

    //     let data, err
    //     if (message.data) {
    //       datga = message.data 
    //     } 
    //     else {
    //       err = new Error(message.error.message)
    //       err.code = message.error.code
    //     }

    //     samba.removeAllListeners()
    //     finished = true
    //     callback(null, samba)
    //     break

    //   default:

    //     console.log(`[BOOT] unknown message type: ${message.type}`) 
    //     break 
    // }
  })

  samba.on('close', (code, signal) => {
    
    if (finished === true) return

    console.log(`[BOOT] samba closed. code: ${code}, signal: ${signal}`)

    finished = true
    callback(new Error(`unexpected exit with code ${code} and signal ${signal}`))
  })

  setTimeout(() => {
    
    if (finished === true) return

    console.log(`[BOOT] failed to start samba in 120s`)

    samba.kill()
    finished = true
    callback(new Error('fork samba timeout'))
  }, 120000)
}

module.exports = {
  forkAsync: async function (cfs, init = null) {
    await Promise.promisify(fork)(cfs, init)
  }
}