const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const EventEmitter = require('events')

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

// state is a string which will be exposed to client
// starting, started, exited
// 
class Fruitmix extends EventEmitter {

  constructor(child) {
    super()

    this.child = child
    this.state = 'starting'

    this.child.on('error', err => {
      this.error = err
    })

    this.child.on('message', message => {
      switch (message.type) {
      case 'fruitmixStarted':
        this.state = 'started'
        break

      case 'createFirstUserDone':
        clearTimeout(this.timer)
        if (this.callback) {
          this.callback(message.error, message.data)
          this.callback = null
        }
        break
      }
    })

    this.child.on('exit', (code, signal) => {
      this.state = 'exited'
      this.code = code
      this.signal = signal
    }) 

    this.callback = null
  }

  getState() {

    let obj = { state: this.state }
    
    if (this.error)
      obj.error = {
        code: this.error.code,
        message: this.error.message
      }

    if (this.state === 'exited')
      obj.exit = {
        code: this.code,
        signal: this.signal
      }

    return obj
  } 

  createFirstUser(username, password, callback) {

    if (this.state !== 'started')
      return process.nextTick(() => callback(new Error('fruitmix not started')))

    if (this.callback !== null)
      return process.netxTick(() => callback(new Error('try again later')))

    this.callback = callback
    this.timer = setTimeout(() => {
      if (this.callback) this.callback(new Error('timeout'))      
    }, 3000)

    this.child.send({ type: 'createFirstUser', username, password })
  } 

  async createFirstUserAsync(username, password) {
    return Promise.promisify(this.createFirstUser.bind(this))(username, password)
  }
}

// fork is a synchronous method
// cfs: type, uuid, mountpoint
const fork = cfs => {

	let froot = path.join(cfs.mountpoint, 'wisnuc', 'fruitmix')
	let modpath = path.resolve(__dirname, '../../fruitmix/main')

	console.log(`forking fruitmix, waiting for 120s before timeout`)

  return new Fruitmix(child.fork(modpath, ['--path', froot], { 
		env: Object.assign({}, process.env, { FORK: 1 }),
		stdio: ['ignore', 1, 2, 'ipc'] 		// this looks weird, but must be in this format, see node doc
	}))
}

module.exports = {
  probeAsync,  
  fork,
}

