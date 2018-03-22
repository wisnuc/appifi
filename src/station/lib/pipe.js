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

const btrfs = require('../../lib/btrfs')
const requestAsync = require('./request').requestHelperAsync
const broadcast = require('../../common/broadcast')
const Fingerprint = require('../../lib/fingerprint2')
// const boxData = require('../../box/boxData')

const getFruit = require('../../fruitmix')
const { createIpcMain, getIpcMain, destroyIpcMain } = require('../../webtorrent/ipcMain')

const { isUUID } = require('../../common/assertion')
// const Config = require('./const').CONFIG

const Transform = stream.Transform
Promise.promisifyAll(fs)


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
  //TODO: miniprogram no sha256
  constructor(tmp, size, sha256) {
    this.tmp = tmp
    this.size = size
    this.sha256 = sha256
  }

  async storeFileAsync(cloudAddr, sessionId, saId, token) {
    return Promise.promisify(this.storeFile).bind(this)(cloudAddr, sessionId, saId, token)
  }

  storeFile(cloudAddr, sessionId, saId, token, callback) {
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
      debug('Bytes Written -->', bytesWritten)
      if (bytesWritten !== this.size)
        return error(Object.assign(new Error('size mismatch'), { code: 'EMISMATCH' }))
      if (sha256 !== this.sha256)
        return error(Object.assign(new Error('sha256 mismatch'), { code: 'EMISMATCH' }))
      debug('store file bytesWritten')
      finished = true
      callback(null, fpath)
    }

    let abort = () => {
      if (finished) return
      finished = true
      callback(new Error('EABORT'))
    }

    let req = request.get(url).set({ 'Authorization': token }).buffer(false)
    let ws = fs.createWriteStream(fpath)
    debug('store req created')
    req.on('response', res => {
      debug('response', fpath)
      if (res.status !== 200) {
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
 *  ctx : stationh
 */
class Pipe {
  constructor(ctx) {
    this.tmp = path.join(ctx.froot, 'tmp')
    // this.connect = ctx
    // this.connect.register('pipe', this.handle.bind(this))
    this.ctx = ctx
    this.token = ctx.token
    this.stationId = ctx.station.id
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

    if (!data.serverAddr || !data.sessionId) return debug('Invaild pipe request')

    let fruit = getFruit()
    if (!fruit) return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('fruitmix not start'), { code: 500 }))
      .then(() => { }).catch(debug)

    if (!data.resource || !data.method) {
      debug('resource or method error')
      return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('resource or method not found'), { code: 400 }))
        .then(() => { }).catch(debug)
    }

    let localUser = fruit.findUserByGUID(data.user.id)
    if(localUser)
      data.user = Object.assign({}, data.user, localUser)
    else 
      data.user.global = {
        id: data.user.id
      }
    
    // debug('fruit pipe user: ', data.user)
    let messageType = this.decodeType(data)

    if (data.needLocalUser && !localUser)
      return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('user not found'), { code: 400 }))
        .then(() => { }).catch(debug)

    if (!messageType) {
      debug('resource error')
      return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(new Error('resource error'), { code: 400 }))
        .then(() => { }).catch(debug)
    }
    debug('pipe messageType:', messageType)
    if (this.handlers.has(messageType))
      this.handlers.get(messageType)(data)
        .then(() => { debug('success for request') })
        .catch(e => {
          debug('pipe catch exception:', e)
          debug('pipe error messageType:', messageType)
          debug('pipe error subType: ', data.subType)
          if (['GetMediaThumbnail', 'GetMediaFile'].includes(data.subType))
            return this.errorFetchResponseAsync(data.serverAddr, data.sessionId, Object.assign(e, { code: 400 }))
              .then(() => { }).catch(debug)
          else if (['WriteDirNewFile', 'WriteDirAppendFile', 'CreateTweet'].includes(data.subType)) {
            let code = 400
            if (e.code === 'EEXIST') code = 403
            return this.errorStoreResponseAsync(data.serverAddr, data.sessionId, Object.assign(e, { code }))
              .then(() => { }).catch(debug)
          }
          else
            return this.errorResponseAsync(data.serverAddr, data.sessionId, Object.assign(e, { code: 400 }))
              .then(() => { }).catch(debug)

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
    data.paths = [...paths] // record paths
    data.needLocalUser = true // middleware for check user
    if (!paths.length) return undefined
    let r1 = paths.shift()
    switch (r1) {
      case 'drives':
        return paths.length === 0 ? (method === 'GET' ? 'GetDrives' : (method === 'POST' ? 'CreateDrive' : undefined))
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
      case 'users':
        return paths.length === 0 ? (method === 'GET' ? 'GetUsers' : (method === 'POST' ? 'CreateUser' : undefined))
          : paths.length === 1 ? (method === 'GET' ? 'GetUser' : (method === 'PATCH' ? 'UpdateUserInfo' : undefined))
            : paths.length === 2 ? (method === 'GET' ? (paths[1] === 'media-blacklist' ? 'GetMediaBlackList' : undefined)
              : (method === 'PUT' ? (paths[1] === 'password' ? 'UpdateUserPasswd' : (paths[1] === 'media-blacklist' ? 'SetMediaBlackList' : undefined))
                : (method === 'POST' ? 'AddMediaBlackList'
                  : (method === 'DELETE' ? 'SubtractUserMediaBlackList' : undefined))))
              : undefined
        break
      case 'token':
        return paths.length === 0 && method === 'GET' ? 'GetToken' : undefined
        break
      case 'station':
        return paths.length === 1 ? (method === 'GET' ? (paths[0] === 'info' ? 'GetStationInfo' 
                    : (paths[0] === 'tickets' ? 'GetTickets' : undefined)) : (method === 'PATCH' ? 'UpdateStationInfo' : (method === 'POST' ? 'CreateTicket' : undefined)))
                      : paths.length === 2 ? (method === 'GET' ? 'GetTicket' : undefined) 
                        : paths.length === 3 ? 'ConfirmTicket'
                        : undefined
        break
      case 'download':
        if (paths.length === 1 && method === 'GET' && paths[0] === 'switch') return 'getTorrentSwitch'
        if (paths.length === 1 && method === 'PATCH' && paths[0] === 'switch') return 'patchTorrentSwitch'
        if (paths[0] == 'ppg1') return 'ppg1'
        if (paths[0] == 'ppg2') return 'addTorrent'
        if (paths[0] == 'ppg3') return 'ppg3'
        if (paths[0] == 'http') return 'addHttp'
        if (paths[0] == 'version') return 'checkVersion'
        return paths.length === 0 && method === 'GET' ? 'getSummary' 
                  : paths.length === 1 ? (method === 'PATCH' ? 'patchTorrent' : (paths[0] === 'magnet' ? 'addMagnet' : 'addTorrent'))
                  : undefined
        break
      case 'boxes': {
          data.needLocalUser = false
          return paths.length === 0 ? (method === 'GET' ? 'GetBoxes' : 'CreateBox') 
                  : (paths.length === 1 ? (method === 'GET' ? 'GetBox' : (method === 'PATCH' ? 'UpdateBox' : (method === 'DELETE' ? 'DeleteBox': undefined))) 
                  : (paths.length === 2 ? (paths[1] === 'tweets' ? (method === 'GET' ? 'GetTweets' : (method === 'DELETE' ? 'DeleteTweets' : (method === 'POST' ? 'CreateTweet' : undefined))) : undefined)
                  : (paths.length === 3 && paths[1] === 'files' ? 'GetBoxFile' 
                  : undefined)))
        }
        break
      case 'tasks' :
        return paths.length === 0 ? (method === 'GET' ? 'GetTasks' : 'CreateTask')
                : paths.length === 1 ? (method === 'GET' ? 'GetTask' : 'DeleteTask')
                : paths.length === 3 ? (method === 'PATCH' ? 'UpdateSubTask' : 'DeleteSubTask')
                : undefined 
        break
      default:
        return undefined
        break
    }
  }
  /*****************************STATION*************************/
  async getStationInfoAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let info = this.ctx.info()
    if(!info) return await this.errorResponseAsync(serverAddr, sessionId, new Error('station not start'))
    return await this.successResponseJsonAsync(serverAddr, sessionId, info)
  }

  async updateStationInfoAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    if(!this.ctx.initialized)  return await this.errorResponseAsync(serverAddr, sessionId, new Error('station not start'))
    let info = await this.ctx.updateInfoAsync({ name:body.name })
    return await this.successResponseJsonAsync(serverAddr, sessionId, info)    
  }

  async getTicketsAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    if(!this.ctx.initialized)  return await this.errorResponseAsync(serverAddr, sessionId, new Error('station not start'))
    let Tickets = this.ctx.tickets
    let ticketArr = await Tickets.getTicketsAsync(user.uuid)
    return await this.successResponseJsonAsync(serverAddr, sessionId, ticketArr)
  }

  async createTicketAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    if(!this.ctx.initialized)  return await this.errorResponseAsync(serverAddr, sessionId, new Error('station not start'))
    let Tickets = this.ctx.tickets
    let ticket = await Tickets.createTicketAsync(user.uuid, body.type)
    return await this.successResponseJsonAsync(serverAddr, sessionId, ticket)
  }

  async getTicketAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    if(!this.ctx.initialized)  return await this.errorResponseAsync(serverAddr, sessionId, new Error('station not start'))
    let Tickets = this.ctx.tickets
    let ticketId = paths[2]
    let t = await Tickets.getTicketAsync(ticketId)
    return await this.successResponseJsonAsync(serverAddr, sessionId, t)
  }

  async confirmTicketAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    if(!this.ctx.initialized)  return await this.errorResponseAsync(serverAddr, sessionId, new Error('station not start'))
    let Tickets = this.ctx.tickets
    let guid = body.guid
    let state = body.state
    let ticketId = paths[3]
    let d = await Tickets.consumeTicket(user.uuid, guid, ticketId, state)
    return await this.successResponseJsonAsync(serverAddr, sessionId, d)
  }

  /*****************************TOKEN***************************/

  async getTokenAsync(data) {
    let { serverAddr, sessionId, user } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let token = fruit.getToken(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, token)
  }
  /***********************************Dirves**************************/
  //get drives
  async getDrivesAsync(data) {
    let { serverAddr, sessionId, user } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let drives = fruit.getDriveList(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, drives)
  }

  //create drive
  async createDriveAsync(data) {
    let { serverAddr, sessionId, user, body } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let drives = await fruit.createPublicDriveAsync(user, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, drives)
  }

  //get drive
  async getDriveAsync(data) {
    let { serverAddr, sessionId, user, paths } = data
    let fruit = getFruit()

    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if (paths.length !== 2 || !isUUID(paths[1])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
    let driveUUID = paths[1]

    let drive = fruit.getDrive(user, driveUUID)
    return await this.successResponseJsonAsync(serverAddr, sessionId, drive)
  }


  async updateDriveAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()

    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if (paths.length !== 2 || !isUUID(paths[1])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
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

    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    if (paths.length !== 3 || paths[2] !== 'dirs' || !isUUID(paths[1])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))

    let driveUUID = paths[1]
    let dirs = fruit.getDriveDirs(user, driveUUID)

    return await this.successResponseJsonAsync(serverAddr, sessionId, dirs)
  }

  async getDirectoryAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()

    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if (paths.length !== 4 || paths[2] !== 'dirs' || !isUUID(paths[1] || !isUUID(paths[3]))) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))

    let driveUUID = paths[1]
    let dirUUID = paths[3]
    let metadata = body.metadata === 'true' ? true : false
    let counter = body.counter === 'true' ? true : false
    let dirs = await fruit.getDriveDirAsync(user, driveUUID, dirUUID, metadata, counter)
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

    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if (paths.length !== 5 || paths[2] !== 'dirs' || !isUUID(paths[1] || !isUUID(paths[3] || paths[4] !== 'entries')))
      return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))

    let driveUUID = paths[1]
    let dirUUID = paths[3]
    let ops = ['mkdir', 'rename', 'dup', 'remove', 'newfile', 'appendfile']
    if (!ops.includes(body.op))
      return await this.errorResponseAsync(serverAddr, sessionId, new Error('op error'))

    let da = Object.assign({}, body)
    da.driveUUID = driveUUID
    da.dirUUID = dirUUID
    data.body = da

    switch (da.op) {
      case 'mkdir':
        return await this.mkdirpAsync2(data)
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
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncMkdir = Promise.promisify(fruit.mkdirp).bind(fruit)
    let xstat = await asyncMkdir(user, body.driveUUID, body.dirUUID, body.toName)
    debug('mkdirp success', xstat)
    return await this.successResponseJsonAsync(serverAddr, sessionId, xstat)
  }

  async mkdirpAsync2 (data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let dst = {
      drive: body.driveUUID,
      dir: body.dirUUID,
      name: body.toName
    }
    let asyncMkdir = Promise.promisify(fruit.driveList.mkdir).bind(fruit.driveList)
    let xstat = await asyncMkdir(dst, ['skip', null])
    debug('mkdirp success', xstat)
    return await this.successResponseJsonAsync(serverAddr, sessionId, xstat)
  }

  async renameAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncRename = Promise.promisify(fruit.rename).bind(fruit)
    let xstat = await asyncRename(user, body.driveUUID, body.dirUUID, body.fromName, body.toName, body.overwrite)
    debug('renameAsync success', xstat)
    return await this.successResponseJsonAsync(serverAddr, sessionId, xstat)
  }

  async dupAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncDup = Promise.promisify(fruit.dup).bind(fruit)
    let xstat = await asyncDup(user, body.driveUUID, body.dirUUID, body.fromName, body.toName, body.overwrite)
    debug('dupAsync success', xstat)
    return await this.successResponseJsonAsync(serverAddr, sessionId, xstat)
  }

  async removeAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let asyncRemove = Promise.promisify(fruit.rimraf).bind(fruit)
    await asyncRemove(user, body.driveUUID, body.dirUUID, body.toName, body.uuid)
    debug('removeAsync success')
    return await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  async newFileAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    data.subType = 'WriteDirNewFile'
    let store = new StoreFile(this.tmp, body.size, body.sha256)
    let fpath = await store.storeFileAsync(serverAddr, sessionId, this.stationId, this.token)
    let asyncNewFile = Promise.promisify(fruit.createNewFile).bind(fruit)
    let xstat = await asyncNewFile(user, body.driveUUID, body.dirUUID, body.toName, fpath, body.sha256, body.overwrite)
    debug('newFileAsync success', xstat)
    await this.successStoreResponseAsync(serverAddr, sessionId, xstat)
  }

  async appendFileAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    data.subType = 'WriteDirAppendFile'
    let store = new StoreFile(this.tmp, body.size, body.sha256)
    let fpath = await store.storeFileAsync(serverAddr, sessionId, this.stationId, this.token)
    let asyncAppendFile = Promise.promisify(fruit.appendFile).bind(fruit)


    let tmp = { path: fpath, size: body.size, sha256: body.sha256 }
    let xstat = await asyncAppendFile(user, body.driveUUID, body.dirUUID, body.toName, body.append, tmp)

    debug('appendFileAsync success', xstat)
    await this.successStoreResponseAsync(serverAddr, sessionId, xstat)
  }

  async downloadFileAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    if (paths.length !== 6 || paths[2] !== 'dirs' || paths[4] !== 'entries' || !isUUID(paths[1]) || !isUUID(paths[3]) || !isUUID(paths[5])) return await this.errorResponseAsync(serverAddr, sessionId, new Error('resource error'))
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
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
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
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

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
      let file
      if(body.boxUUID) {
        file = getFruit().getBoxFilepath(user, body.boxUUID, fingerprint)
        if (!file) 
          return await this.errorFetchResponseAsync(serverAddr, sessionId, new Error('media not found'))
      } else {
        let files = fruit.getFilesByFingerprint(user, fingerprint)
        if (!files.length) 
          return await this.errorFetchResponseAsync(serverAddr, sessionId, new Error('media not found'))
        file = files[0]
      }
      return await this.fetchFileResponseAsync(file, serverAddr, sessionId)
    }
    else if (body.alt === 'thumbnail') {
      data.subType = 'GetMediaThumbnail'
      let thumb = await this.getMediaThumbnailAsync(user, fingerprint, body)
      if (thumb) {
        return await this.fetchFileResponseAsync(thumb, serverAddr, sessionId)
      } else {
        return await this.errorFetchResponseAsync(serverAddr, sessionId, new Error('thumbnail not found'))
      }
    } else {
      return await this.errorResponseAsync(serverAddr, sessionId, new Error('operation not found'))
    }

  }

  getMediaThumbnail(user, fingerprint, query, callback) {
    //getMediaThumbnail
    let fruit = getFruit()
    if (!fruit) return callback(new Error('fruitmix not start'))
    if(query.boxUUID) {
      try{
        let fp = fruit.getBlobMediaThumbnail(user, fingerprint, query, (err, thumb) => {
          if (err) return callback(err)
          if (typeof thumb === 'string') {
            callback(null, thumb)
          } else if (typeof thumb === 'function') {
            let cancel = thumb((err, th) => {
              if (err) return callback(err)
              callback(null, th)
            })
            // TODO cancel
          } else {
            callback(new Error(`unexpected thumb type ${typeof thumb}`))
          }
        })
      }
      catch(e) { return callback(e) }
    }
    else {
      fruit.getThumbnail(user, fingerprint, query, (err, thumb) => {
        if (err) return callback(err)
        if (typeof thumb === 'string') {
          return callback(null, thumb)
        } else if (typeof thumb === 'function') {
          let cancel = thumb((err, th) => {
            if (err) return callback(err)
            return callback(null, th)
          })
        }
      })
    }
  }

  async getMediaThumbnailAsync(user, fingerprint, query) {
    return Promise.promisify(this.getMediaThumbnail).bind(this)(user, fingerprint, query)
  }

  /*************************************** Station *****************************************/

  

  /*************************************** User *********************************************/

  // get user list
  async getUsersAsync(data) {
    let { serverAddr, sessionId, user } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    // let userList = user.isAdmin ? fruit.getUsers() : fruit.displayUsers()
    let userList = fruit.getUsers()
    return await this.successResponseJsonAsync(serverAddr, sessionId, userList)
  }

  // not first user
  // create new user
  async createUserAsync(data) {
    let { serverAddr, sessionId, user, body } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
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
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    let err = {}, userUUID = paths[1]
    if (user.uuid === userUUID || user.isAdmin) {
      let u = fruit.findUserByUUID(userUUID)
      if (u) return await this.successResponseJsonAsync(serverAddr, sessionId, u)
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
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    let u, userUUID = paths[1]
    u = await fruit.updateUserAsync(user, userUUID, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, u)
  }

  async updateUserPasswdAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    let userUUID = paths[1]
    if (user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))

    await fruit.updateUserPasswordAsync(user, userUUID, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  async getUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    let userUUID = paths[1]
    if (user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))
    let list = await fruit.getMediaBlacklistAsync(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  /**
   * FIXME: mediablacklist array ->> add key blacklist 
  */
  async setUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

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
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    let userUUID = paths[1]
    if (user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))

    let list = await fruit.addMediaBlacklistAsync(user, body.blacklist)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  /**
   * FIXME: mediablacklist array ->> add key blacklist 
  */
  async subtractUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))

    let userUUID = paths[1]
    if (user.uuid !== userUUID) return await this.errorResponseAsync(serverAddr, sessionId, new Error('user uuid mismatch'))

    let list = await fruit.subtractMediaBlacklistAsync(user, body.blacklist)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  // download api
  // download (get summary)
  async getSummaryAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { torrentId, type } = body
    if (!getIpcMain()) return await this.errorResponseAsync(serverAddr, sessionId, new Error('webtorrent is not started'))
    getIpcMain().call('getSummary', { torrentId, type, user }, async (error, summary) => {
      if (error) await this.errorResponseAsync(serverAddr, sessionId, error)
      else await this.successResponseJsonAsync(serverAddr, sessionId, summary)
    })
  }

  async ppg3Async(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { ppgId, type } = body
    if (!getIpcMain()) return await this.errorResponseAsync(serverAddr, sessionId, new Error('webtorrent is not started'))
    getIpcMain().call('getSummary', { torrentId: ppgId, type, user }, async (error, summary) => {
      if (error) await this.errorResponseAsync(serverAddr, sessionId, error)
      else {
        summary.ppgPath = summary.torrentPath
        summary.ppgURL = summary.magnetURL
        summary.torrentPath = undefined
        summary.magnetURL = undefined
        await this.successResponseJsonAsync(serverAddr, sessionId, summary)
      }
    })
  }

  // download (get version for ios)
  async checkVersionAsync() {
    await this.successResponseJsonAsync(serverAddr, sessionId, {version: false})
  }

  // download (operation in a task)
  async patchTorrentAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { op } = body
    let torrentId = paths[1]
    let ops = ['pause', 'resume', 'destroy']
    if (!getIpcMain()) return await this.errorResponseAsync(serverAddr, sessionId, new Error('webtorrent is not started'))
    if(!ops.includes(op)) return await this.errorResponseAsync(serverAddr, sessionId, new Error('unknow op'))
    let result = await getIpcMain().callAsync(op, { torrentId, user })
    this.successResponseJsonAsync(serverAddr, sessionId, result)
  }

  // download (create magnet task)
  async addMagnetAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { dirUUID, magnetURL } = body
    if (!getIpcMain()) return await this.errorResponseAsync(serverAddr, sessionId, new Error('webtorrent is not started'))
    let result = await getIpcMain().callAsync('addMagnet', { magnetURL, dirUUID, user})
    this.successResponseJsonAsync(serverAddr, sessionId, result)
  }

  async ppg1Async(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { dirUUID, ppgURL } = body
    if (!getIpcMain()) return await this.errorResponseAsync(serverAddr, sessionId, new Error('webtorrent is not started'))
    let result = await getIpcMain().callAsync('addMagnet', { magnetURL:ppgURL, dirUUID, user})
    this.successResponseJsonAsync(serverAddr, sessionId, result)
  }

  // download (create torrent task)
  async addTorrentAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    if (!getIpcMain()) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('webtorrent is not started'))
    let { dirUUID } = body
    data.subType = 'WriteDirNewFile'
    let store = new StoreFile(this.tmp, body.size, body.sha256)
    let fpath = await store.storeFileAsync(serverAddr, sessionId, this.stationId, this.token)
    let fname = path.basename(fpath)
    let torrentTmp = path.join(getFruit().fruitmixPath, 'torrentTmp')
    let torrentPath = path.join(torrentTmp, fname)
    let fruit = getFruit()
    mkdirp.sync(torrentTmp)
    await fs.renameAsync(fpath, torrentPath)
    let result = await getIpcMain().callAsync('addTorrent', { torrentPath, dirUUID, user })
    return await this.successStoreResponseAsync(serverAddr, sessionId, result)
    // fs.rename(fpath, torrentPath, async (error, data) => {
    //   if (error) return await this.errorStoreResponseAsync(serverAddr, sessionId, error)
    //   else getIpcMain().call('addTorrent', { torrentPath, dirUUID, user }, async (err, result) => {
    //     if (err) return await this.errorStoreResponseAsync(serverAddr, sessionId, err.message)
    //     else return await this.successStoreResponseAsync(serverAddr, sessionId, result)
    //   })
    // })
  }

  // download (create http task)
  async addHttpAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { dirUUID, url } = body
    if (!getIpcMain()) return await this.errorResponseAsync(serverAddr, sessionId, new Error('webtorrent is not started'))
    getIpcMain().call('addHttp', { url, dirUUID, user}, async (error, result) => {
      if (error) console.log(error)
      else console.log('not error')	
      if(error) return await this.errorResponseAsync(serverAddr, sessionId, error.message)
      else await this.successResponseJsonAsync(serverAddr, sessionId, result)
    })
  }

  async getTorrentSwitchAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    if (getIpcMain()) await this.successResponseJsonAsync(serverAddr, sessionId, {switch: true})
    else await this.successResponseJsonAsync(serverAddr, sessionId, {switch: false})
  }

  // download (toggle torrent service)
  async patchTorrentSwitchAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let { op } = body
    let ops = ['start', 'close']
    if(!ops.includes(op)) return await this.errorResponseAsync(serverAddr, sessionId, new Error('unknow op'))

    if (op === 'close') destroyIpcMain()
    else createIpcMain()
    await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  /********************************************************************************/
  /*********************************  Tasks API  **********************************/
  /********************************************************************************/

  async getTasksAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let tasks = await new Promise((resolve, reject) => {
      fruit.getTasks(user, (err, tasks) => {
        if(err) return reject(err)
        resolve(tasks)
      })
    })
    await this.successResponseJsonAsync(serverAddr, sessionId, tasks)
  }

  async createTaskAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let task = await new Promise((resolve, reject) => {
      fruit.createTask(user, body, (err, task) => {
        if(err) return reject(err)
        resolve(task)
      })
    })
    await this.successResponseJsonAsync(serverAddr, sessionId, task)
  }

  async getTaskAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let taskId = paths[1]
    let task = await new Promise((resolve, reject) => {
      fruit.getTask(user, taskId, (err, task) => {
        if(err) return reject(err)
        resolve(task)
      })
    })
    await this.successResponseJsonAsync(serverAddr, sessionId, task)
  }

  async deleteTaskAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let taskId = paths[1]
    await new Promise((resolve, reject) => {
      fruit.deleteTask(user, taskId, err => {
        if(err) return reject(err)
        resolve()
      })
    })
    await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  async updateSubTaskAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let taskId = paths[1]
    let nodeId = paths[3]
    let t = await new Promise((resolve, reject) => {
      fruit.updateSubTask(user, taskId, nodeId, body, (err, t) => {
        if(err) return reject(err)
        resolve(t)
      })
    })
    await this.successResponseJsonAsync(serverAddr, sessionId, t)
  }

  async deleteSubTaskAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let taskId = paths[1]
    let nodeId = paths[3]
    await new Promise((resolve, reject) => {
      fruit.deleteSubTask(user, taskId, nodeId, err => {
        if(err) return reject(err)
        resolve()
      })
    })
    await this.successResponseJsonAsync(serverAddr, sessionId, t)
  }

  /********************************************************************************/
  /*********************************  Boxes API  **********************************/
  /********************************************************************************/
  
  async getBoxesAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let docList = fruit.getAllBoxes(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, docList)
  }

  async getBoxAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let boxUUID = paths[1]
    let doc = fruit.getBox(user, boxUUID)
    return await this.successResponseJsonAsync(serverAddr, sessionId, doc)
  }

  async updateBoxAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let boxUUID = paths[1]
    let box = await fruit.updateBoxAsync(user, boxUUID, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, box)
  }

  async deleteBoxAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let boxUUID = paths[1]
    await fruit.deleteBoxAsync(user, boxUUID)
    return await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  async createBoxAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let doc = await fruit.createBoxAsync(user, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, doc)
  }

  async getTweetsAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let boxUUID = paths[1]
    let metadata = body.metadata === 'true' ? true : false
    let { first, last, count, segments } = body
    let props = { first, last, count, segments, metadata }
    let tweets = await fruit.getTweetsAsync(user, boxUUID, props)
    return await this.successResponseJsonAsync(serverAddr, sessionId, tweets)
  }

  async indriveFilesMoveAsync (user,  indrive) {
    return new Promise((resolve, reject) => {
      if(!indrive || !indrive.length) return resolve([])
      let tmpdir = getFruit().getTmpDir()
      let filecount = indrive.length
      let error
      let finish = () => {
        if(error) return
        if(indrive.every(i => i.finish))
          return resolve(indrive)
      }
      let errorHandle = (err) => {
        if(error) return
        error = err
        reject(error)
      }

      let copyDriveFile = (filePath, tmpPath, callback) => {
        fs.lstat(filePath, err => {
          if(err) return callback(err)
          //TODO: read xstat
          fs.copyFile(filePath, tmpPath, err => {
            if(err) return callback(err)
            let fp = new Fingerprint(filePath)
            fp.on('error', err => {
              return callback(err)
            })
    
            fp.on('data', fingerprint => {
              callback(null, fingerprint)
            })
          })
        })
      }

      indrive.forEach(l => {
        if(error) return
        let tmpPath = path.join(tmpdir, uuid.v4())
        if(l.type === 'media') {
          let files = getFruit().getFilesByFingerprint(user, l.sha256)
          if(files.length) {
            let mediaPath = files[0]
            // TODO: check file xstat
            fs.copyFile(mediaPath, tmpPath, err => {
              if(error) return
              if(err) return errorHandle(err)
              l.finish = true
              l.filepath = tmpPath
              return finish()
            })
          } else return errorHandle(new Error(`media ${ l.sha256 } not found`))
        } else if(l.type === 'file') {
          let { filename, dirUUID, driveUUID } = l
          if(!filename || !dirUUID || !driveUUID || !filename.length || !dirUUID.length || !driveUUID.length) 
            return errorHandle(new Error('filename , dirUUID or driveUUID error'))
          let dirPath
          try {
            dirPath = getFruit().getDriveDirPath(user, driveUUID, dirUUID)
          } catch(e) {
            return errorHandle(e)
          }
          let filePath = path.join(dirPath, filename)
          copyDriveFile(filePath, tmpPath, (err, fingerprint) => {
            if(error) return
            if(err) return errorHandle(err)
            l.sha256 = fingerprint
            l.finish = true
            l.filepath = tmpPath
            return finish()
          })
        } else return errorHandle(new Error('list item error'))
      })
    })
  }

  async createTweetAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let { parent, type, list, indrive, comment } = body
    let src = []
    let boxUUID = paths[1]
    data.subType = 'CreateTweet'
    if (list && list.length > 1) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('list can only one item if use pipe'))
    if(list && list.length) {
      let l = list[0]
      let store = new StoreFile(this.tmp, l.size, l.sha256)
      let filepath = await store.storeFileAsync(serverAddr, sessionId,  this.stationId, this.token)
      src.push({ sha256:l.sha256, filepath })
    }
    if (indrive) {
      user = getFruit().findUserByGUID(user.global.id)
      if(!user) return await this.errorStoreResponseAsync(serverAddr, sessionId, new Error('indrive only use for local user'))
      let files = await this.indriveFilesMoveAsync(user, indrive)
      files.map(f => src.push({ sha256: f.sha256, filepath:f.filepath}))
    }

    let props
    if (type === 'list' ) {
      let li =  [], ins = []
      if(list && list.length) li = list.map(i => { return { sha256: i.sha256, filename: i.filename } })
      if(indrive) ins = indrive.map(l => { return { sha256:l.sha256, filename:l.filename }})
      props = { parent, comment, type, list:[...li, ...ins], src }
    }
    let tweet = await fruit.createTweetAsync(user, boxUUID, props)
    return await this.successStoreResponseAsync(serverAddr, sessionId, tweet)
  }

  async getBoxFileAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let boxUUID = paths[1]
    let blobUUID = paths[3]
    let fPath = fruit.getBoxFilepath(user, boxUUID, blobUUID)
    if (fPath)
      return await this.fetchFileResponseAsync(fPath, serverAddr, sessionId)
    else 
      return await this.errorFetchResponseAsync(serverAddr, sessionId, new Error('file not found'))   
  }

  async deleteBoxTweets(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if (!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let boxUUID = paths[1]
    let indexArr = body.indexArr
    await fruit.deleteTweetsAsync(req.user, boxUUID, indexArr)
    return await this.successResponseJsonAsync(serverAddr, sessionId, {})
  }

  /********************************************************************************/
  /********************************  HTTP Utils  **********************************/
  /********************************************************************************/

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
    let url = cloudAddr + '/s/v1/stations/' + this.stationId + '/response/' + sessionId
    let rs = fs.createReadStream(fpath)
    let addr = cloudAddr.split(':')
    let options = {
      hostname: addr[0],
      path: '/s/v1/stations/' + this.stationId + '/response/' + sessionId,
      method: 'POST',
      headers: {
        'Authorization': this.token
      }
    }

    let error = err => {
      if (finished) return
      debug('error fetch', err)
      finished = true
      callback(err)
    }

    let finish = () => {
      if (finished) return
      finished = true
      debug('success fetch', fpath)
      callback(null)
    }

    if (addr.length === 2) options.port = addr[1]

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

  async errorFetchResponseAsync(cloudAddr, sessionId, err) {
    let url = cloudAddr + '/s/v1/stations/' + this.stationId + '/response/' + sessionId + '/pipe/fetch'
    let error = { code: 400, message: err.message }
    let params = { error }
    debug('pipe handle error', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.token })
  }

  async errorResponseAsync(cloudAddr, sessionId, err) {
    let url = cloudAddr + '/s/v1/stations/' + this.stationId + '/response/' + sessionId + '/json'
    let error = { code: 400, message: err.message }
    let params = { error } 
    debug('pipe handle error', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.token })
  }

  async errorStoreResponseAsync(cloudAddr, sessionId, err) {
    let url = cloudAddr + '/s/v1/stations/' + this.stationId + '/response/' + sessionId + '/pipe/store'
    let error = { code: 400, message: err.message }
    let params = { error }
    debug('pipe handle error', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.token })
  }

  async successStoreResponseAsync(cloudAddr, sessionId, data) {
    let url = cloudAddr + '/s/v1/stations/' + this.stationId + '/response/' + sessionId + '/pipe/store'
    let params = { data }
    debug(params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.token })
    debug('request success')
  }

  // async successResponseFileAsync(cloudAddr, sessionId, fpath) {
  //   let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId + '/pipe'
  //   let params = data
  //   debug(params)
  //   await this.fetchFileResponseAsync(fpath, cloudAddr, sessionId)
  // }

  async successResponseJsonAsync(cloudAddr, sessionId, data) {
    let url = cloudAddr + '/s/v1/stations/' + this.stationId + '/response/' + sessionId + '/json'
    let params = { data }
    debug('aaaaaaa', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.token })
    debug('request success')
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
    //tickets
    this.handlers.set('GetStationInfo', this.getStationInfoAsync.bind(this))
    this.handlers.set('GetTickets', this.getTicketsAsync.bind(this))
    this.handlers.set('UpdateStationInfo', this.updateStationInfoAsync.bind(this))
    this.handlers.set('CreateTicket', this.createTicketAsync.bind(this))
    this.handlers.set('GetTicket', this.getTicketAsync.bind(this))
    this.handlers.set('ConfirmTicket', this.confirmTicketAsync.bind(this))
    //download
    this.handlers.set('getSummary', this.getSummaryAsync.bind(this))
    this.handlers.set('ppg3', this.ppg3Async.bind(this))
    this.handlers.set('checkVersion', this.checkVersionAsync.bind(this))
    this.handlers.set('patchTorrent', this.patchTorrentAsync.bind(this))
    this.handlers.set('addMagnet', this.addMagnetAsync.bind(this))
    this.handlers.set('ppg1', this.ppg1Async.bind(this))
    this.handlers.set('addTorrent', this.addTorrentAsync.bind(this))//addHttp  
    this.handlers.set('addHttp', this.addHttpAsync.bind(this))
    this.handlers.set('getTorrentSwitch', this.getTorrentSwitchAsync.bind(this))
    this.handlers.set('patchTorrentSwitch', this.patchTorrentSwitchAsync.bind(this))
    //boxes
    this.handlers.set('GetBoxes', this.getBoxesAsync.bind(this))
    this.handlers.set('CreateBox', this.createBoxAsync.bind(this))
    this.handlers.set('GetBox', this.getBoxAsync.bind(this))
    this.handlers.set('UpdateBox', this.updateBoxAsync.bind(this))
    this.handlers.set('DeleteBox', this.deleteBoxAsync.bind(this))
    this.handlers.set('GetTweets', this.getTweetsAsync.bind(this))
    this.handlers.set('DeleteTweets', this.deleteBoxTweets.bind(this))
    this.handlers.set('CreateTweet', this.createTweetAsync.bind(this))
    this.handlers.set('GetBoxFile', this.getBoxFileAsync.bind(this))
    //tasks
    this.handlers.set('GetTasks', this.getTasksAsync.bind(this))
    this.handlers.set('CreateTask',this.createTaskAsync.bind(this))
    this.handlers.set('GetTask', this.getTaskAsync.bind(this))
    this.handlers.set('DeleteTask', this.deleteTaskAsync.bind(this))
    this.handlers.set('UpdateSubTask', this.updateSubTaskAsync.bind(this))
    this.handlers.set('DeleteSubTask', this.deleteSubTaskAsync.bind(this))
  }
}

module.exports = Pipe
