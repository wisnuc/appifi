const Promise = require('bluebird')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = require(rimraf)
Promise.promisifyAll(fs)
const UUID = require('uuid')

const { saveObjectAsync } = require('../lib/utils')

/**
 *  /feature
 *     /:uuid (fetureuuid)
 *        manifest(desc for feature)
 *        /files
 */

 /**
  * manifest define
  * type:
  * subType
  * futureId
  * tasks:[{
  *    filename,
  *    sha256,
  *    size,
  * }]
  * creator
  * ctime
  * mtime
  */
class Future {
	constructor(froot) {
		this.dir = path.join(froot, 'future')
    mkdirp.sync(this.dir)
    this.futures = new Map()
    this.loadSync()
  }
  
  loadSync() {
    let entries = fs.readdirSync(this.dir)
    entries.forEach(ent => {
      let futPath = path.join(this.dir, entries, 'manifest')
      let future
      try { 
        future = JSON.parse(fs.readFileSync(futPath)) //FIXME: error future delete
      } catch(e) {
        debug('load future error: ' + ent)
        debug(e)
        return
      }
      let futureId = future.futureId
      let tasks = future.tasks
      tasks.forEach(t => {
        let tPath = path.join(this.dir, 'files', t.sha256)
        t.finished = fs.existsSync(tPath)
      })
      this.futures.set(futureId, future)
    })
  }

  async createFutureAsync(props) {
    let { type, creator, subType, tasks } = props
    if(!type) throw new Error('future type error')
    if(!creator) throw new Error('future creator error')
    if(!tasks || !Array.isArray(tasks) || !tasks.length) throw new Error('future tasks error')
    let createDate = new Date().getTime()
    let doc = {
      type,
      subType,
      creator,
      tasks,
      ctime: createDate,
      mtime: createDate,
      futureId: UUID.v4()
    }
    await mkdirpAsync(path.join(this.dir, doc.futureId))
    await saveObjectAsync(path.join(this.dir, doc.futureId, 'manifest'), this.ctx.getTmpDir(), doc)
    return doc
  }

  async deleteFutureAsync(user, futureId) {
    let future = this.futures.get(futureId)
    if(!future) throw new Error('no future')

    if(future.creator !== user.userId) throw new Error('permission denied')
    await rimrafAsync(path.join(this.dir, futureId))
    return
  }

  async addFileToFutureAsync(user,futureId, filePath, sha256) {
    let future = this.futures.get(futureId)
    if(!future) throw new Error('no future')

    if(future.creator !== user.userId) throw new Error('permission denied')
    let task = future.tasks.find(t => t.sha256 === sha256)
    if(!task)  throw new Error('task not found')
    let fpath = path.join(this.dir, futureId, 'files', sha256)
    await fs.renameAsync(filePath, fpath)
    task.finished = true
  }
}