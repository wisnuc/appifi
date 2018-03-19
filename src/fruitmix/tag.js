/**
 * Tags is provide flexible file classification for user files
 * Name tags
 * 
 * Tag : {
 *    name
 *    color
 *    id,
 *    group,  // opt? 
 *    creator,
 *    ctime,
 *    mtime,
 * }
 */

const { readXstat, readXattr, updateXattr } = require('../lib/xstat')

module.exports = {
  //get all tags  
  getTags(user) {
    return this.tags.tags
  },

  hasSameNameTag(tagName) {
    let tag =  this.tags.tags.find(t => t.name === tagName)
    if(tag) return true
    return false
  },

  async createTagAsync(user, props) {
    if(!user || !user.uuid) throw Object.assign(new Error('user not found'))
    let { name, color, group } = props
    if(!name || typeof name !== 'string' || !name.length) throw Object.assign(new Error('name is required'), { status: 400})
    if(this.hasSameNameTag(name)) throw Object.assign(new Error('tag name has already be used'), { status: 400 })
    let creator = user.uuid
    return await this.tags.createTagAsync({ name, color, group, creator })
  },

  async updateTagAsync(user, tagId, props) {
    if(!user || !user.uuid) throw Object.assign(new Error('user not found'))
    let { name, color, group } = props
    if(this.hasSameNameTag(name)) throw Object.assign(new Error('tag name has already be used'), { status: 400 })
    return await this.tags.updateTagAsync(tagId, { name, color, group })
  },

  async deleteTagAsync(user, tagId) {
    if(!user || !user.uuid) throw Object.assign(new Error('user not found'), { status:400 })
    let tag = this.getTag(user, tagId)
    if(!tag) throw Object.assign(new Error('tag not found'), { status: 400})
    return await this.tags.deleteTagAsync(tagId)
  },

  getTag(user, tagId) {
    return this.tags.findTag(tagId)
  },

  addTags(user, driveUUID, dirUUID, filename, tags, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }
    let fromPath = path.join(dir.abspath(), filename)
    fs.lstat(fromPath, (err, stat) => {
      if (err) return callback(err)
      if (!stat.isFile()) {
        let e = new Error(`${filename} is not a file`)
        return callback(e)
      }
      readXattr(fromPath, stat, (err, xattr) => {
        if(err) return callback(err)
        if(xattr.tags || isArray(xattr.tags)) {
          
        }
      })
    })
  },

  removeTags(user, driveUUID, dirUUID, filename, tags, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }
    let fromPath = path.join(dir.abspath(), filename)
    fs.lstat(fromPath, (err, stat) => {
      if (err) return callback(err)
      if (!stat.isFile()) {
        let e = new Error(`${filename} is not a file`)
        return callback(e)
      }
      readXattr()
    })
  },

  resetTags(user, driveUUID, dirUUID, filename, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }
    let fromPath = path.join(dir.abspath(), filename)
    fs.lstat(fromPath, (err, stat) => {
      if (err) return callback(err)
      if (!stat.isFile()) {
        let e = new Error(`${filename} is not a file`)
        return callback(e)
      }
      readXattr()
    })
  },

  setTags(user, driveUUID, dirUUID, filename, tags, callback) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }
    let fromPath = path.join(dir.abspath(), filename)
    fs.lstat(fromPath, (err, stat) => {
      if (err) return callback(err)
      if (!stat.isFile()) {
        let e = new Error(`${filename} is not a file`)
        return callback(e)
      }
      readXattr()
    })
  }

}