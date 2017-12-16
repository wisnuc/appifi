const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')
const stream = require('stream')
const fs = require('fs')
const path = require('path')
const http = require('http')

const request = require('superagent')
const uuid = require('uuid')
const debug = require('debug')('station')
const Promise = require('bluebird')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const sanitize = require('sanitize-filename')
const ioctl = require('ioctl')

const requestAsync = require('./request').requestHelperAsync
const broadcast = require('../../common/broadcast')
const boxData = require('../../box/boxData')

const getFruit = require('../../fruitmix')
const { getIpcMain } = require('../../webtorrent/ipcMain')

const { isUUID } = require('../../common/assertion')
// const Config = require('./const').CONFIG

const Transform = stream.Transform

let asCallback = (fn) => {
  return (props, callback) => {
    fn(props)
      .then(data => callback(null, data))
      .catch(e => callback(e))
  }
}

class HashTransform extends Transform {
  constructor() {
    super()
    this.hashStream = crypto.createHash('sha256')
    this.length = 0
  }

  _transform(buf, enc, next) {
    this.length += buf.length
    this.hashStream.update(buf, enc)
    this.push(buf)
    next()
  }

  getHash() {
    return this.hashStream.digest('hex')
  }
}

class StoreFile {
  constructor(tmp, size, sha256) {
    this.tmp = tmp
    this.size = size
    this.sha256 = sha256
  }

  async storeFileAsync(cloudAddr,sessionId, saId, token)  {
    return Promise.promisify(this.storeFile).bind(this)(cloudAddr,sessionId, saId, token)
  }

  storeFile(cloudAddr,sessionId, saId, token, callback) {
    let transform = new HashTransform()
    let url = cloudAddr + '/s/v1/stations/' + saId + '/response/' + sessionId
    let fpath = path.join(this.tmp, uuid.v4())
    let finished = false
    debug('start store')

    let error = (err) => {
      debug(err)
      if (finished) return
      finished = true
      debug('store file coming error')
      return callback(err)
    }
    let finish = (fpath) => {
      if (finished) return
      debug('store file checking')
      let bytesWritten = ws.bytesWritten
      let sha256 = transform.getHash()
      if(bytesWritten !== this.size)
        return error(Object.assign(new Error('size mismatch'), { code: 'EMISMATCH'}))
      if(sha256 !== this.sha256)
        return error(Object.assign(new Error('sha256 mismatch'), { code: 'EMISMATCH'}))
      debug('store file bytesWritten')
      finished = true
      callback(null, fpath)
    }

    let abort = () => {
      if (finished) return
      finished = true
      callback(new Error('EABORT'))
    }

    let req = request.get(url).set({ 'Authorization': token })
    let ws = fs.createWriteStream(fpath)
    debug('store req created')
    req.on('response', res => {
      debug('response', fpath)
      if(res.status !== 200){
        debug('response error', fpath)
        error(res.error)
        ws.end()
      }
    })
    req.on('error', err => error(err))
    req.on('abort', () => error(new Error('EABORT')))
    ws.on('finish', () => finish(fpath))
    ws.on('error', err => error(err))

    req.pipe(transform).pipe(ws)
  }
}
/* data:  {
    type: 'pipe',   // socket communication multiplexing
    
    sessionId:      // client-cloud-station pipe session id (uuid)
    user: {         // valid user data format
      userId: 'xxx',
      nickName: 'xxx',
      avator: 'xxx', 
    },
    method: 'GET', 'POST', 'PUT', 'DELETE', 'PATCH',
    resource: 'path string', // req.params must base64 encode
    body: {         // req.body, req.query
    
    },

    serverAddr:     // valid ip address, whitelist
  }*/



/**
 * service for connect message 'pipe'
 * 
 */
class Pipe {
  constructor(ctx) {
    this.tmp = path.join(ctx.froot, 'tmp')
    this.connect = ctx
    this.connect.register('pipe', this.handle.bind(this))
    this.handlers = new Map()
    this.register()
  }
  
  /**
   * @param {object} data -- from socket
   * 
   * {
   *    resource,
   *    method,
   *    user:{
   *      id,
   *      nickName,
   *      unionId,
   *      avatarUrl
   *    },
   *    others...
   * }
   */
  handle(data) {
    debug(data)
    
    if(!data.serverAddr || !data.sessionId) return debug('Invaild pipe request')

    let fruit = getFruit()
    if(!fruit) return  this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('fruitmix not start'), { code: 500 }))
                              .then(() => {}).catch(debug)
    
    if(!data.resource || !data.method) {
      debug('resource or method error')
      return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('resource or method not found'), { code: 400 }))
                    .then(() => {}).catch(debug)
    }

    let localUser = fruit.findUserByGUID(data.user.id)
    
    if(!localUser) 
      return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('user not found'), { code: 400 }))
                    .then(() => {}).catch(debug)

    data.user = Object.assign({}, data.user, localUser)
    // debug('fruit pipe user: ', data.user)
    let messageType = this.decodeType(data)
    if(!messageType){
      debug('resource error')
      return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('resource error'), { code: 400 }))
                    .then(() => {}).catch(debug)
    } 
    debug('pipe messageType:', messageType)
    if(this.handlers.has(messageType))
      this.handlers.get(messageType)(data)
        .then(() => {debug('success for request')})
        .catch(e => {
          debug('pipe catch exception:', e)
          debug('pipe error messageType:', messageType)
          debug('pipe error subType: ', data.subType)
          if(['GetMediaThumbnail', 'GetMediaFile'].includes(data.subType))
            return this.errorFetchResponseAsync(data.serverAddr, data.sessionId, Object.assign(e, { code: 400 }))
                      .then(() => {}).catch(debug)
          else if(['WriteDirNewFile', 'WriteDirAppendFile'].includes(data.subType)) {
            let code = 400
            if(e.code === 'EEXIST') code = 403 
            return this.errorStoreResponseAsync(data.serverAddr, data.sessionId, Object.assign(e, { code }))
                      .then(() => {}).catch(debug)
          }
          else
            return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(e, { code: 400 }))
                      .then(() => {}).catch(debug)
          
        })
    else
      debug('NOT FOUND EVENT HANDLER', messageType, data)
  }

  /**
   * 
   * @param {object} data
   * 
   * return type - this.handlers`s key 
   */
  decodeType(data) {
    let resource = new Buffer(data.resource, 'base64').toString('utf8')
    let method = data.method
    let paths = resource.split('/').filter(p => p.length)
    data.paths = [...paths]
    
    if(!paths.length) return undefined
    let r1 = paths.shift()
    switch(r1) {
      case 'drives':
        return  paths.length === 0 ? (method === 'GET' ? 'GetDrives' : (method === 'POST' ? 'CreateDrive' : undefined))
                  : paths.length === 1 ? (method === 'GET' ? 'GetDrive' : (method === 'PATCH' ? 'UpdateDrive' : (method === 'DELETE' ? 'DeleteDrive' : undefined)))
                    : paths.length === 2 && method === 'GET' ? 'GetDirectories'
                      : paths.length === 3 && method === 'GET' ? 'GetDirectory'
                        : paths.length === 4 && method === 'POST' ? 'WriteDir'
                          : paths.length === 5 && method === 'GET' ? 'DownloadFile' : undefined
        break
      case 'media':
        return paths.length === 0 && method === 'GET' ? 'GetMetadatas'
                  : paths.length === 1 && method === 'GET' ? 'GetMetadata'
                  : undefined
        break
      case  'users':
        return paths.length === 0 ? (method === 'GET' ? 'GetUsers' : (method === 'POST' ? 'CreateUser' : undefined))
                  : paths.length === 1 ? (method === 'GET' ? 'GetUser' : (method === 'PATCH' ? 'UpdateUserInfo' : undefined))
                    : paths.length === 2 ? (method === 'GET' ? (paths[1] === 'media-blacklist' ? 'GetMediaBlackList' : undefined)
                      : (method === 'PUT' ? (paths[1] === 'password' ? 'UpdateUserPasswd' : (paths[1] === 'media-blacklist' ?'SetMediaBlackList' : undefined))
                       : (method === 'POST' ? 'AddMediaBlackList' 
                        : (method === 'DELETE' ? 'SubtractUserMediaBlackList' : undefined))))
                        : undefined
        break
      case 'token':
        return paths.length === 0 && method === 'GET' ? 'GetToken' : undefined
      case 'download':
        return paths.length === 0 && method === 'GET' ? 'getSummary' 
                  : paths.length === 1 ? (method === 'PATCH' ? 'patchTorrent' : (paths[0] === 'magnet' ? 'addMagnet' : 'addTorrent'))
                  : undefined
      default:
        return undefined
        break
    }
  }


  /*****************************TOKEN***************************/

  async getTokenAsync(data) {
    let { serverAddr, sessionId, user } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let token = fruit.getToken(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, token)
  }
  /***********************************Dirves**************************/
  //get drives
  async getDrivesAsync(data) {
    let { serverAddr, sessionId, user } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let drives = fruit.getDriveList(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, drives)
  }

  //create drive
  async createDriveAsync(data) {
    let { serverAddr, sessionId, user, body} = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let drives = await fruit.createPublicDriveAsync(user, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, drives)
  }
  
  //get drive
  async getDriveAsync(data) {
    let { serverAddr, sessionId, user, paths } = data
    let fruit = getFruit()

    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if(paths.length !== 2 || !isUUID(paths[1])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
    let driveUUID = paths[1]

    let drive = fruit.getDrive(user, driveUUID)
    return await this.successResponseJsonAsync(serverAddr, sessionId, drive)
  }


  async updateDriveAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()

    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if(paths.length !== 2 || !isUUID(paths[1])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
    let driveUUID = paths[1]
    
    let drive = await fruit.updatePublicDriveAsync(user, driveUUID, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, drive)
  }

  async deleteDriveAsync(data) {
    // not implemented yet
  }

  //fetch
  async getDirectoriesAsync(data) {
    let { serverAddr, sessionId, user, paths } = data
    let fruit = getFruit()

    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    if(paths.length !== 3 || paths[2] !== 'dirs' || !isUUID(paths[1])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
    
    let driveUUID = paths[1]
    let dirs = fruit.getDriveDirs(user, driveUUID)

    return await this.successResponseJsonAsync(serverAddr, sessionId, dirs)
  }

  async getDirectoryAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()

    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if(paths.length !== 4 || paths[2] !== 'dirs' || !isUUID(paths[1] || !isUUID(paths[3]))) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
    
    let driveUUID = paths[1]
    let dirUUID = paths[3]
    let metadata = body.metadata === 'true' ? true : false
    let dirs = await fruit.getDriveDirAsync(user, driveUUID, dirUUID, metadata)
    return await this.successResponseJsonAsync(serverAddr, sessionId, dirs)
  }

  /**
   * 
   * @param {object} data 
   * 
   * {
   *  version: 1,
   *  name: fromPath|toPath, or 'name'
   *  op: enum STRING ['mkdir', 'rename', 'dup', 'remove', 'newfile']
   *  overwrite: optional(UUID)
   *  size: 0 <= size <= 1G, INTEGER
   *  sha256:  (neglected when size === 0),
   * }
   */
  async writeDirAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if(paths.length !== 5 || paths[2] !== 'dirs' || !isUUID(paths[1] || !isUUID(paths[3] || paths[4] !== 'entries'))) 
      return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
    
    let driveUUID = paths[1]
    let dirUUID = paths[3]
    let ops = ['mkdir', 'rename', 'dup', 'remove', 'newfile', 'appendfile']
    if(!ops.includes(body.op))
      return await this.errorResponseAsync(serverAddr, sessionId, new Error('op error'))

    let da = Object.assign({}, body)
    da.driveUUID = driveUUID
    da.dirUUID = dirUUID
    data.body = da

    switch (da.op) {
      case 'mkdir':
        return await this.mkdirpAsync(data)
        break
      case 'rename':
        return await this.renameAsync(data)
        break
      case 'dup':
        return await this.dupAsync(data)
        break
      case 'remove':
        return await this.removeAsync(data)
        break
      case 'newfile':
        return await this.newFileAsync(data)
        break
      case 'appendfile':
        return await this.appendFileAsync(data)
        break
      default:
        debug('unhandle writedir event')
        break
    }

  }

  /********************************************************************************************/
  
  /**
   * {
   *  version: 1,
   *  name: fromName|toName, or 'name'
   *  op: enum STRING ['mkdir', 'rename', 'dup', 'remove', 'newfile']
   *  overwrite: optional(UUID)
   *  size: 0 <= size <= 1G, INTEGER
   *  sha256:  (neglected when size === 0),
   *  dirUUID,
   *  driveUUID,
   *  fromName,
   *  toName
   * }
   */

  async mkdirpAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncMkdir = Promise.promisify(fruit.mkdirp).bind(fruit)
    let xstat = await asyncMkdir(user, body.driveUUID, body.dirUUID, body.toName)
    debug('mkdirp success', xstat)
    return await this.successResponseJsonAsync(serverAddr, sessionId, xstat)
  }

  async renameAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncRename = Promise.promisify(fruit.rename).bind(fruit)
    let xstat = await asyncRename(user, body.driveUUID, body.dirUUID, body.fromName, body.toName, body.overwrite)
    debug('renameAsync success', xstat)
    return await this.successResponseJsonAsync(serverAddr, sessionId, xstat)
  }

  async dupAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncDup = Promise.promisify(fruit.dup).bind(fruit)
    let xstat = await asyncDup(user, body.driveUUID, body.dirUUID, body.fromName, body.toName, body.overwrite)
    debug('dupAsync success', xstat)
    return await this.successResponseJsonAsync(serverAddr, sessionId, xstat)
  }

  async removeAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncRemove = Promise.promisify(fruit.rimraf).bind(fruit)
    await asyncRemove(user, body.driveUUID, body.dirUUID, body.toName, body.uuid)
    debug('removeAsync success')
    return await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  async newFileAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    data.subType = 'WriteDirNewFile'
    let store = new StoreFile(this.tmp, body.size, body.sha256)
    let fpath = await store.storeFileAsync(serverAddr, sessionId, this.connect.saId, this.connect.token)
    let asyncNewFile = Promise.promisify(fruit.createNewFile).bind(fruit)
    let xstat = await asyncNewFile(user, body.driveUUID, body.dirUUID, body.toName, fpath, body.sha256, body.overwrite)
    debug('newFileAsync success', xstat)
    await this.successStoreResponseAsync(serverAddr, sessionId, xstat)
  }

  async appendFileAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    data.subType = 'WriteDirAppendFile'
    let store = new StoreFile(this.tmp, body.size, body.sha256)
    let fpath = await store.storeFileAsync(serverAddr, sessionId, this.connect.saId, this.connect.token)
    let asyncAppendFile = Promise.promisify(fruit.appendFile).bind(fruit)


    let tmp = { path: fpath, size: body.size, sha256: body.sha256 }
    let xstat = await asyncAppendFile(user, body.driveUUID, body.dirUUID, body.toName, body.append, tmp)

    debug('appendFileAsync success', xstat)
    await this.successStoreResponseAsync(serverAddr, sessionId, xstat)
  }

  async downloadFileAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if(paths.length !== 6 || paths[2] !== 'dirs' || paths[4] !== 'entries' || !isUUID(paths[1]) || !isUUID(paths[3]) || !isUUID(paths[5])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
    let driveUUID = paths[1]
    let dirUUID = paths[3]
    let entryUUID = paths[5]
    let name = body.name
    let dirPath = fruit.getDriveDirPath(user, driveUUID, dirUUID)
    let filePath = path.join(dirPath, name)
    return await this.fetchFileResponseAsync(filePath, serverAddr, sessionId)
  }

  /****************************************Media Api**************************************/
  
  // return metadata list
  async getMetadatasAsync(data) {
    let { serverAddr, sessionId, user, body } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let metadata = fruit.getMetaList(user)
    debug('getMetaList success', metadata)
    return await this.successResponseJsonAsync(serverAddr, sessionId, metadata)
  }

  /**
   * body.alt
   * if alt === metadata  return metadata
   * if alt === data return file
   * if alt === thumbnail return thumbnail
   */
  async getMetadataAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    const fingerprint = paths[1]

    if (body.alt === undefined || body.alt === 'metadata') {
      data.subType = 'GetMediaMetadata'
      let metadata = fruit.getMetadata(null, fingerprint)
      if (metadata) {
        return await this.successResponseJsonAsync(serverAddr, sessionId, metadata)
      } else {
        return await this.errorResponseAsync(serverAddr, sessionId, new Error('metadata not found'))
      }
    }
    else if (body.alt === 'data') {
      data.subType = 'GetMediaFile'
      let files = fruit.getFilesByFingerprint(user, fingerprint)
      if (files.length) {
        return await this.fetchFileResponseAsync(files[0], serverAddr, sessionId)
      } else {
        return await this.errorFetchResponseAsync(serverAddr, sessionId, new Error('media not found'))
      }
    }
    else if (body.alt === 'thumbnail') {
      data.subType = 'GetMediaThumbnail'
      let thumb = await this.getMediaThumbnailAsync(user, fingerprint, body)
      if(thumb){
        return await this.fetchFileResponseAsync(thumb, serverAddr, sessionId)
      } else {
        return await this.errorFetchResponseAsync(serverAddr, sessionId, new Error('thumbnail not found'))
      }
    }else{
      return await this.errorResponseAsync(serverAddr, sessionId, new Error('operation not found'))
    }
    
  }
  
  getMediaThumbnail(user, fingerprint, query, callback) {
    //getMediaThumbnail
    let fruit = getFruit()
    if(!fruit) return callback(new Error('fruitmix not start'))
    fruit.getThumbnail(user, fingerprint, query, (err, thumb) => {
      if (err) return callback(err)
      if (typeof thumb === 'string') {
        return callback(null, thumb)
      } else if (typeof thumb === 'function') {
        let cancel = thumb((err, th) => {
          if (err) return callback(err)
          return callback(th)
        })
      }
    })
  }

  async getMediaThumbnailAsync(user, fingerprint, query) {
    return Promise.promisify(this.getMediaThumbnail).bind(this)(user, fingerprint, query)
  }

  /*************************************** User *********************************************/

  // get user list
  async getUsersAsync(data) {
    let { serverAddr, sessionId, user } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    // let userList = user.isAdmin ? fruit.getUsers() : fruit.displayUsers()
    let userList = fruit.getUsers() 
    return await this.successResponseJsonAsync(serverAddr, sessionId, userList)
  }
  
  // not first user
  // create new user
  async createUserAsync(data) {
    let { serverAddr, sessionId, user, body } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let newUser = await fruit.createUserAsync(user, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, newUser)
  }

  /**
   * get single user info
   * @param { Object } data 
   */
  async getUserAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let err = {}, userUUID = paths[1]
    if(user.uuid === userUUID || user.isAdmin) {
      let u = fruit.findUserByUUID(userUUID)
      if(u) return await this.successResponseJsonAsync(serverAddr, sessionId, u)
      err = new Error('user not find')
      err.code = 404
      return await this.errorResponseAsync(serverAddr, sessionId, err)
    }
    err.message = 'auth error'
    err.code = 403
    return await this.errorResponseAsync(serverAddr, sessionId, err)
  }

  // update name, isAdmin, disabled 
  async updateUserInfoAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let u, userUUID = paths[1]
    u = await fruit.updateUserAsync(user, userUUID, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, u)
  }

  async updateUserPasswdAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    if(user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))

    await fruit.updateUserPasswordAsync(user, userUUID, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  async getUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    if(user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))
    let list = await fruit.getMediaBlacklistAsync(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  /**
   * FIXME: mediablacklist array ->> add key blacklist 
  */
  async setUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    let list = await fruit.setMediaBlacklistAsync(user, body.blacklist)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  /**
   * FIXME: mediablacklist array ->> add key blacklist 
  */
  async addUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    if(user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))

    let list = await fruit.addMediaBlacklistAsync(user, body.blacklist)
    return await this.successResponseJsonAsync(sherverAddr, sessionId, list)
  }

  /**
   * FIXME: mediablacklist array ->> add key blacklist 
  */
  async subtractUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit)  return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    if(user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))

    let list = await fruit.subtractMediaBlacklistAsync(user, body.blacklist)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  async getSummaryAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { torrentId, type } = body
    getIpcMain().call('getSummary', { torrentId, type, user }, async (error, summary) => {
      if (error) await this.errorResponseAsync(serverAddr, sessionId, error)
      else await this.successResponseJsonAsync(serverAddr, sessionId, summary)
    })
  }

  async patchTorrentAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { op } = body
    let torrentId = paths[1]
    let ops = ['pause', 'resume', 'destroy']
    if(!ops.includes(op)) return await this.errorResponseAsync(serverAddr, sessionId, new Error('unknow op'))
    getIpcMain().call(op, { torrentId, user }, async (error, result) => {
      if(error) return await this.errorResponseAsync(serverAddr, sessionId, error)
      else await this.successResponseJsonAsync(serverAddr, sessionId, result)
    })
  }

  async addMagnetAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { dirUUID, magnetURL } = body
    getIpcMain().call('addMagnet', { magnetURL, dirUUID, user}, async (error, result) => {
      if(error) return await this.errorResponseAsync(serverAddr, sessionId, error)
      else await this.successResponseJsonAsync(serverAddr, sessionId, result)
    })
  }

  async addTorrentAsync(data) {
    console.log('enter torrent cloud', data.body.dirUUID)
    let { serverAddr, sessionId, user, body, paths } = data
    let { dirUUID } = body
    data.subType = 'WriteDirNewFile'
    let store = new StoreFile(this.tmp, body.size, body.sha256)
    let fpath = await store.storeFileAsync(serverAddr, sessionId, this.connect.saId, this.connect.token)
    let fname = path.basename(fpath)
    let torrentTmp = path.join(getFruit().fruitmixPath, 'torrentTmp')
    let torrentPath = path.join(torrentTmp, fname)
    let fruit = getFruit()
    mkdirp.sync(torrentTmp)
    fs.rename(fpath, torrentPath, async (error, data) => {
      if (error) return await this.errorStoreResponseAsync(serverAddr, sessionId, error)
      else getIpcMain().call('addTorrent', { torrentPath, dirUUID, user }, async (err, result) => {
        if (err) return await this.errorStoreResponseAsync(serverAddr, sessionId, err)
        else return await this.successStoreResponseAsync(serverAddr, sessionId, result)
      })
    })
  }

  //fetch file -- client download --> post file to cloud
  /**
   * 
   * @param {*} fpath -local file path
   * @param {*} cloudAddr 
   * @param {*} sessionId -cloud session id
   * @param {*} callback 
   */
  fetchFileResponse(fpath, cloudAddr, sessionId, callback) {
    let finished = false
    let url = cloudAddr+ '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId
    let rs = fs.createReadStream(fpath)
    let addr = cloudAddr.split(':')
    let options = {
      hostname: addr[0],
      path:'/s/v1/stations/' + this.connect.saId + '/response/' + sessionId,
      method: 'POST',
      headers: {
        'Authorization': this.connect.token
      }
    }

    let error = err => {
      if(finished) return 
      debug('error fetch', err)
      finished = true
      callback(err)
    }

    let finish = () => {
      if(finished) return
      finished = true
      debug('success fetch', fpath)
      callback(null)
    }

    if(addr.length === 2) options.port = addr[1]

    let req = http.request(options, res => {
      res.setEncoding('utf8')
      res.on('error', error)
      res.on('end', finish);
    })

    req.on('error', error)

    req.on('abort', error)

    rs.pipe(req)
  }

  async fetchFileResponseAsync(fpath, cloudAddr, sessionId) {
    return Promise.promisify(this.fetchFileResponse).bind(this)(fpath, cloudAddr, sessionId)
  }


  async createTextTweetAsync({ boxUUID, guid, comment }) {
    let box = boxData.getBox(boxUUID)
    let props = { comment, global: guid }
    let result = await box.createTweetAsync(props)
    let newDoc = await boxData.updateBoxAsync({ mtime: result.mtime }, box.doc.uuid)
  }

  async errorFetchResponseAsync(cloudAddr, sessionId, err) {
    let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId +'/pipe/fetch'
    let error = { code: 400, message: err.message }
    let params = error 
    debug('pipe handle error', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.connect.token })
  }

  async errorResponseAsync(cloudAddr, sessionId, err) {
    let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId +'/json'
    let error = { code: 400, message: err.message }
    let params = { error }
    debug('pipe handle error', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.connect.token })
  }

  async errorStoreResponseAsync(cloudAddr, sessionId, err) {
    let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId +'/pipe/store'
    let error = { code: 400, message: err.message }
    let params = { error }
    debug('pipe handle error', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.connect.token })
  }

  async successStoreResponseAsync(cloudAddr, sessionId, data) {
    let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId + '/pipe/store'
    let params = { data }
    debug(params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.connect.token })
    debug('request success')
  }

  // async successResponseFileAsync(cloudAddr, sessionId, fpath) {
  //   let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId + '/pipe'
  //   let params = data
  //   debug(params)
  //   await this.fetchFileResponseAsync(fpath, cloudAddr, sessionId)
  // }

  async successResponseJsonAsync(cloudAddr, sessionId, data) {
    let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId + '/json'
    let params = data
    debug('aaaaaaa',params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.connect.token })
    debug('request success')
  }

  async createBlobTweetAsync({ boxUUID, guid, comment, type, size, sha256, jobId }) {
    // { comment, type: 'blob', id: sha256, global, path: file.path}
    //get blob
    // let storeFile = new StoreFile(this.tmp, this.token, size, sha256, jobId)
  }

  register() {
    this.handlers.set('GetToken', this.getTokenAsync.bind(this))
    //drives
    this.handlers.set('GetDrives', this.getDrivesAsync.bind(this))
    this.handlers.set('CreateDrive', this.createDriveAsync.bind(this))
    this.handlers.set('GetDrive', this.getDriveAsync.bind(this))
    this.handlers.set('UpdateDrive', this.updateDriveAsync.bind(this))
    this.handlers.set('DeleteDrive', this.deleteDriveAsync.bind(this))
    this.handlers.set('GetDirectories', this.getDirectoriesAsync.bind(this))
    this.handlers.set('GetDirectory', this.getDirectoryAsync.bind(this))
    this.handlers.set('WriteDir', this.writeDirAsync.bind(this))
    this.handlers.set('DownloadFile', this.downloadFileAsync.bind(this))
    //users
    this.handlers.set('GetUsers', this.getUsersAsync.bind(this))
    this.handlers.set('CreateUser', this.createUserAsync.bind(this))
    this.handlers.set('GetUser', this.getUserAsync.bind(this))
    this.handlers.set('UpdateUserInfo', this.updateUserInfoAsync.bind(this))
    this.handlers.set('UpdateUserPasswd', this.updateUserPasswdAsync.bind(this))
    this.handlers.set('GetMediaBlackList', this.getUserMediaBlackListAsync.bind(this))
    this.handlers.set('SetMediaBlackList', this.setUserMediaBlackListAsync.bind(this))
    this.handlers.set('AddMediaBlackList', this.addUserMediaBlackListAsync.bind(this))
    this.handlers.set('SubtractUserMediaBlackList', this.subtractUserMediaBlackListAsync.bind(this))
    //media
    this.handlers.set('GetMetadatas', this.getMetadatasAsync.bind(this))
    this.handlers.set('GetMetadata', this.getMetadataAsync.bind(this))
    //download
    this.handlers.set('getSummary', this.getSummaryAsync.bind(this))
    this.handlers.set('patchTorrent', this.patchTorrentAsync.bind(this))
    this.handlers.set('addMagnet', this.addMagnetAsync.bind(this))
    this.handlers.set('addTorrent', this.addTorrentAsync.bind(this))
  }
}

module.exports = Pipe
