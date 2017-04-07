const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

const EventEmitter = require('events').EventEmitter
const sambaAudit = new EventEmitter()

const debug = require('debug')('fruitmix:tools')

// return ENOENT, EPARSE or local users
const retrieveNewUsersAsync = async froot => {

  let mpath = path.join(froot, 'models', 'model.json')
  let data
  try {
    data = await fs.readFileAsync(mpath)
  }
  catch (e) {
    // ! dont check ENOTDIR leave it as EFAIL
    if (e.code === 'ENOENT') return 'ENOENT'
    throw e
  }

  let model
  try {
    let model = JSON.parse(data)
    return model.users.filter(u => u.type === 'local') 
  }
  catch (e) {
    if (typeof e === SyntaxError) return 'EPARSE'
    throw e
  } 
}

// return ENOENT, EPARSE, or users
const retrieveOldUsersAsync = async froot => {

  let upath = path.join(froot, 'models', 'users.json') 
  let data
  try {
    data = await fs.readFileAsync(upath)
  }
  catch (e) {
    // ! dont check ENOTDIR leave it as EFAIL
    if (e.code === 'ENOENT') return 'ENOENT'   
    throw e
  }

  try {
    return JSON.parse(data)
  }
  catch (e) {
    if (typeof e === SyntaxError) return 'EPARSE'
    throw e
  }
}

/**

  this module should not change anything on file system

  { status: 'EFAIL' } operation error
  { status: 'ENOENT' or 'ENOTDIR' } fruitmix not found
  { status: 'EDATA' } fruitmix installed but user data not found or cannot be parsed
  { status: 'READY', users: [...] } empty users are possible

**/
const probeAsync = async mountpoint => {

  if (!path.isAbsolute(mountpoint)) throw new Error('mountpoint must be an absolute path')

  let froot = path.join(mountpoint, 'wisnuc', 'fruitmix')

  // test fruitmix dir
  try {
    await fs.readdirAsync(froot)
  }
  catch (e) {

    if (e.code === 'ENOENT' || e.code === 'ENODIR')
      return { status: e.code }

    console.log(`failed to probe fruitmix @ ${mountpoint}`, e)
    return { status: 'EFAIL' }
  }

  // retrieve users
  try {

    let users = await retrieveNewUsersAsync(froot)
    if (users === 'ENOENT') users = await retrieveOldUsersAsync(froot)
    if (users === 'ENOENT' || users === 'EPARSE')
      return { status: 'EDATA' }

    return {
      status: 'READY',
      users: users.map(u => ({
        type: u.type,
        username: u.username,
        uuid: u.uuid,
        avatar: u.avatar,
        email: u.email,
        nologin: u.nologin,
        isFirstUser: u.isFirstUser,
        isAdmin: u.isAdmin,
        home: u.home,
        library: u.library,
        service: u.service,
        friends: u.friends,
        lastChangeTime: u.lastChangeTime
      }))
    }
  }
  catch (e) {

    console.log(`failed to probe fruitmix @ ${mountpoint}`, e)
    return { status: 'EFAIL' }
  }
}

const fork = (cfs, init, callback) => {

  let froot = path.join(cfs.mountpoint, 'wisnuc', 'fruitmix')
  let modpath = path.resolve(__dirname, '../../fruitmix/main')

  console.log(`forking fruitmix, waiting for 120s before timeout`)

  let finished = false
  let fruitmix = child.fork(modpath, ['--path', froot], { 
		env: Object.assign({}, process.env, { FORK: 1 }),
		stdio: ['ignore', 1, 2, 'ipc'] 		// this looks weird, but must be in this format, see node doc
	})

  sambaAudit.on('sambaAudit', (data) => {
    console.log(JSON.stringify(data))
  })

  fruitmix.on('error', err => {

    if (finished === true) return

    console.log('[BOOT] fruitmix error: ', err)

    fruitmix.kill()
    finished = true
    callback(err)
  })

  fruitmix.on('message', message => {

    if (finished === true) return

    console.log(`[BOOT] fruitmix message: ${message}`)

    switch (message.type) {
      case 'fruitmixStarted':

        console.log('[fork fruitmix] fruitmixStarted message received from child process')

        if (init) {
          fruitmix.send('message', {
            type: 'createFirstUser',
            username: init.username,
            password: init.password
          })
        }
        else {
          fruitmix.removeAllListeners()
          finished = true
          callback(null, fruitmix)
        }
        break

      case 'createFirstUserDone':

        let data, err
        if (message.data) {
          datga = message.data 
        } 
        else {
          err = new Error(message.error.message)
          err.code = message.error.code
        }

        fruitmix.removeAllListeners()
        finished = true
        callback(null, fruitmix)
        break

      default:

        console.log(`[BOOT] unknown message type: ${message.type}`) 
        break 
    }
  })

  fruitmix.on('close', (code, signal) => {
    
    if (finished === true) return

    console.log(`[BOOT] fruitmix closed. code: ${code}, signal: ${signal}`)

    finished = true
    callback(new Error(`unexpected exit with code ${code} and signal ${signal}`))
  })

  setTimeout(() => {
    
    if (finished === true) return

    console.log(`[BOOT] failed to start fruitmix in 120s`)

    fruitmix.kill()
    finished = true
    callback(new Error('fork fruitmix timeout'))
  }, 120000)
}

module.exports = {
  probeAsync,
  sambaAudit,
  forkAsync: async function (cfs, init = null) {
		await Promise.promisify(fork)(cfs, init)
	}
}

