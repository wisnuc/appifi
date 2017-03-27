const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

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
module.exports = async mountpoint => {

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

    let users = await retrieveNewUserAsync(froot)
    if (users === 'ENOENT') users = await retrieveOldUsersAsync(froot)
    if (users === 'ENOENT' || users === 'EPARSE')
      return { status: 'EDATA' }

    return {
      status: 'READY',
      users: users.map(u => ({
        // TODO
      }))
    }    
  }
  catch (e) {

    console.log(`failed to probe fruitmix @ ${mountpoint}`, e)
    return { status: 'EFAIL' }
  }
}


