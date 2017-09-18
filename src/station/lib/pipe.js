const EventEmitter = require('events').EventEmitter
const crypto = require('crypto')
const stream = require('stream')
const fs = require('fs')
const path = require('path')

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

class StoreSingleFile {
  constructor(tmp, token, size, hash, jobId) {
    this.tmp = tmp
    this.size = size
    this.hash = hash
    this.token = token
    this.jobId = jobId
  }

  async runAsync(url) {
    return await this.storeFileAsync(url)
  }

  async storeFileAsync(url)  {
    return Promise.promisify(this.storeFile).bind(this)(url)
  }

  storeFile(url, callback) {
    let transform = new HashTransform()
    //TODO: define url
    let fpath = path.join(this.tmp, uuid.v4())
    let finished = false

    debug('start store')

    let error = (err) => {
      debug(err)
      if (finished) return
      finished = true
      debug('coming error')
      return callback(err)
    }
    let finish = (fpath) => {
      if (finished) return
      debug('store finish')
      finished = true
      //TODO: check size sha256
      callback(null, fpath)
    }

    let abort = () => {
      if (finished) return
      finished = true
      callback(new Error('EABORT'))
    }

    let req = request.get(url).set({ 'Authorization': this.token })
    let ws = fs.createWriteStream(fpath)
    debug('store req created')
    req.on('response', res => {
      debug('response', fpath)
      if(res.status !== 200){
        debug('response error')
        error(res.error)
        ws.close()
      }
    })
    req.on('error', err => error(err))
    req.on('abort', () => error(new Error('EABORT')))
    ws.on('finish', () => finish(fpath))
    ws.on('error', err => error(err))

    req.pipe(transform).pipe(ws)
  }

}

class StoreFiles {
  constructor(tmp, token, sizeArr, hashArr, jobId) {
    this.tmp = tmp
    this.sizeArr = sizeArr
    this.hashArr = hashArr
    this.token = token
    this.jobId = jobId
    this.currentIndex = 0 //当前文件数
    this.currentEndpoint = 0 //当前文件结束位置
    let currentSize = 0
  }

  run() {
    
  }

  storeFiles(callback) {
    //TODO: define url
    let url = ''
    let totalSize = 0
    this.sizeArr.forEach(s => totalSize += s)
    this.currentEndpoint = this.sizeArr[0] - 1 // 当前文件结束点
    let finished = false
    let fpathArr = []
    let hashMaker = new HashTransform()
    let fpath = path.join(this.tmp, uuid.v4())
    let ws = fs.createWriteStream(fpath)
    hashMaker.pipe(ws) // pipe

    let error = (err) => {
      console.log(err)
      if (finished) return
      finished = true
      return callback(err)
    }
    let finish = (fpaths) => {
      if (finished) return
      finished = true
      //TODO: check size sha256
      callback(null, fpaths)
    }

    let abort = () => {
      if (finished) return
      finished = true
      callback(new Error('EABORT'))
    }

    let req = request.get(url).set({ 'Authorization': this.token })
    req.on('error', error)
    req.on('abort', () => error(new Error('EABORT')))
    ws.on('finish', () => finish(fpathArr))
    ws.on('error', error())
    req.on('response', res => {
      console.log('response')
      if(res.status !== 200){ 
        ws.close()
        res.destroy()
        return error(res.error)        
      }
      else if(res.get('Content-Length') !== totalSize){ // totalsize error
        ws.close()
        res.destroy()
        return error(new Error('totalsize mismatch'))
      }
      else{ // run 
        res.on('data', data => {
          let chunk = Buffer.from(data)
          if((chunk + this.currentSize - 1) >= this.currentEndpoint){
            res.pause()
            let needL = chunk.length - (this.currentEndpoint - this.currentSize + 1)
            
            // write last chunk
            hashMaker.write(chunk.slice(0, needL))
            let digest = hashMaker.digest('hex')
            ws.close() // close write stream 
            
            // check hash
            if(digest !== this.currentEndpoint[this.currentIndex])
              return error(`${ this.currentIndex } hash mismatch`)
            
            // save fpath
            fpathArr.push(fpath)
            if(fpathArr.length === this.sizeArr.length) 
              return finish(fpathArr)

            //  create new instance
            fpath = path.join(this.tmp, uuid.v4())
            
            this.currentIndex ++
            this.currentEndpoint += this.sizeArr[this.currentIndex]

            hashMaker = new HashTransform()
            ws = fs.createWriteStream(fpath)
            hashMaker.pipe(ws)
            hashMaker.write(chunk.slice(needL, chunk.length))
            this.currentSize += chunk.length

            //resume
            res.resume()
              
            //TODO: do something
            // 1 write chunk
            // 2 check file
            // 3 new HashMaker new Writeable new endpoint new fpath new index
            // 4 resume res
            // 5 end
            
          }else{
            hashMaker.write(data) // update
            this.currentSize += chunk.length
          }
        })

        res.on('end', () => {

        })

        res.on('error', err => {

        })
      }
    })
    
    req.end()    
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
  constructor(tmp, connect) {
    this.tmp = undefined
    this.connect = connect
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
                    : paths.length === 2 ? (method === 'GET' ? (paths[1] === 'password'? 'UpdateUserPasswd': (paths[1] === 'media-blacklist' ? 'GetMediaBlackList' : undefined))
                      : (method === 'PUT' ? 'SetMediaBlackList' : (method === 'POST' ? 'AddMediaBlackList' : (method === 'DELETE' ? 'SubtractUserMediaBlackList' : undefined))))
                        : undefined
        break
      default:
        return undefined
        break
    }
  }

  /***********************************Dirves**************************/
  //get drives
  async getDrivesAsync(data) {
    let { serverAddr, sessionId, user } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let drives = fruit.getDrives(user)
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
    let dirUUID = path[3]
    let ops = ['mkdir', 'rename', 'dup', 'remove', 'newfile']
    if(ops.findIndex(body.op) === -1)
      return await this.errorResponseAsync(serverAddr, sessionId, new Error('op error'))

    let da = Object.assign({}, body)
    da.driveUUID = driveUUID
    da.dirUUID = dirUUID

    let split = da.name.split('|')
    if (split.length === 0 || split.length > 2)
       throw new Error('invalid name')
    if (!split.every(name => name === sanitize(name)))
       throw new Error('invalid name')
    da.fromName = split.shift()
    da.toName = split.shift() || da.fromName

    switch (da.op) {
      case 'mkdir':
        break
      case 'rename':
        break
      case 'dup':
        break
      case 'remove':
        break
      case 'newfile':
        break
      default:
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

  async mkdirAsync(data) {

  }

  async renameAsync(data) {

  }

  async dupAsync(data) {

  }

  async removeAsync(data) {

  }

  async newFileAsync(data) {

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

    // const fingerprints = fruit.getFingerprints(user)
    // const metadata = fingerprints.reduce((acc, fingerprint) => {
    //   // let meta = Media.get(fingerprint)
    //   let meta = fruit.getMetadata(null, fingerprint)
    //   if (meta) acc.push(Object.assign({ hash: fingerprint }, meta))
    //   return acc
    // }, [])
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

      let metadata = fruit.getMetadata(null, fingerprint)
      if (metadata) {
        return await this.successResponseJsonAsync(serverAddr, sessionId, metadata)
      } else {
        return await this.errorResponseAsync(serverAddr, sessionId, new Error('metadata not found'))
      }
    }
    else if (body.alt === 'data') {
      let files = fruit.getFilesByFingerprint(user, fingerprint)
      if (files.length) {
        return await this.fetchFileResponseAsync(files[0], serverAddr, sessionId)
      } else {
        return await this.errorResponseAsync(serverAddr, sessionId, new Error('media not found'))
      }
    }
    else if (body.alt === 'thumbnail') {
      let thumb = await this.getMediaThumbnailAsync(user, fingerprint, body)
      if(thumb){
        return await this.fetchFileResponseAsync(thumb, serverAddr, sessionId)
      } else {
        return await this.errorResponseAsync(serverAddr, sessionId, new Error('thumbnail not found'))
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
    let userList = user.isAdmin ? fruit.getUsers() : fruit.displayUsers()
    return await this.successResponseJsonAsync(serverAddr, sessionId, userList)
  }
  
  // not first user
  // create new user
  async createUserAsync(data) {
    let { serverAddr, sessionId, user, body } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    let newUser = await fruit.createUserAsync(body)
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
    
    let u, err, userUUID = paths[1]
    try {
      u = await fruit.updateUserAsync(user, userUUID, body)
      return await this.successResponseJsonAsync(serverAddr, sessionId, u)
    }
    catch(e) {
      err.message = e.message
      err.code = 400
      return await this.errorResponseAsync(serverAddr, sessionId, err)
    }
  }

  async updateUserPasswdAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    try{
      await fruit.updateUserPasswordAsync(user, userUUID)
      return await this.successResponseJsonAsync(serverAddr, sessionId, {})
    } catch(e) {
      e.code = 400
      return await this.errorResponseAsync(serverAddr, sessionId, e)
    }
  }

  async getUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    let list = await fruit.getMediaBlacklistAsync(user)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  async setUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    let list = await fruit.setMediaBlacklistAsync(user, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  async addUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    let list = await fruit.addMediaBlacklistAsync(user, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
  }

  async subtractUserMediaBlackListAsync(data) {
    let { serverAddr, sessionId, user, body, paths } = data
    let fruit = getFruit()
    if(!fruit) return await this.errorResponseAsync(serverAddr, sessionId, new Error('fruitmix not start'))
    
    let userUUID = paths[1]
    let list = await fruit.subtractMediaBlacklistAsync(user, body)
    return await this.successResponseJsonAsync(serverAddr, sessionId, list)
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
    let req = request.post(url).set({ 'Authorization': this.connect.token })

    let finish = () => {
      if(finished) return
      finished = true
      return callback()
    }

    let error = err => {
      if(finished) return
      finished = true
      return callback(err)
    }

    req.on('response', res => {
      debug('response', res.status, fpath)
      if　(res.status !== 200)　{
        debug('response error')
        error(res.error)
      }
      else 
        finish()
    })
    req.on('error', err => {
      error(err)
    }) 
    rs.on('error', err =>{
      error(err)
    })
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

  async errorResponseAsync(cloudAddr, sessionId, err) {
    let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId +'/json'
    let error = { code: err.code, message: err.message }
    let params = { error }
    debug('pipe handle error', params)
    await requestAsync('POST', url, { params }, { 'Authorization': this.connect.token })
  }

  async successResponseFileAsync(cloudAddr, sessionId, fpath) {
    let url = cloudAddr + '/s/v1/stations/' + this.connect.saId + '/response/' + sessionId + '/pipe'
    let params = data
    debug(params)
    await this.fetchFileResponseAsync(fpath, cloudAddr, sessionId)
  }

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
    let storeFile = new StoreSingleFile(this.tmp, this.token, size, sha256, jobId)
  }

  register() {
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
  }
}

module.exports = Pipe
