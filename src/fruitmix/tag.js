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

const { readXstat, updateFileTagsAsync } = require('../lib/xstat')
const path = require('path')

module.exports = {
  //get all tags  
  getTags(user) {
    return this.tag.tags
  },

  hasSameNameTag(tagName) {
    let tag =  this.tag.tags.find(t => t.name === tagName)
    if(tag) return true
    return false
  },

  createTag(user, props, callback) {
    if(!user || !user.uuid) throw Object.assign(new Error('user not found'))
    let { name, color, group } = props
    if(!name || typeof name !== 'string' || !name.length) throw Object.assign(new Error('name is required'), { status: 400})
    if(this.hasSameNameTag(name)) throw Object.assign(new Error('tag name has already be used'), { status: 400 })
    let creator = user.uuid
    this.tag.createTag({ name, color, group, creator }, callback)
  },

  updateTag(user, tagId, props, callback) {
    if(!user || !user.uuid) throw Object.assign(new Error('user not found'))
    let { name, color, group } = props
    if(this.hasSameNameTag(name)) throw Object.assign(new Error('tag name has already be used'), { status: 400 })
    this.tag.updateTag(tagId, { name, color, group }, callback)
  },

  deleteTag(user, tagId, callback) {
    if(!user || !user.uuid) throw Object.assign(new Error('user not found'), { status:400 })
    let tag = this.getTag(user, tagId)
    if(!tag) throw Object.assign(new Error('tag not found'), { status: 400})
    this.tag.deleteTag(tagId, callback)
  },

  getTag(user, tagId) {
    return this.tag.findTag(tagId)
  },

  fileAddTags(user, driveUUID, dirUUID, filename, tags, cb) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return cb(err)
    }
    let fromPath = path.join(dir.abspath(), filename)
    if(!tags.every(t => global.validTagIds.includes(t))) return cb(Object.assign(new Error('tags error, tagId not found'), { status:400 }))

    readXstat(fromPath, (err, xstat) => {
      if (xstat.type !== 'file') {
        let e = new Error(`${filename} is not a file`)
        e.status = 404
        return cb(e)
      }
  
      let xtags = xstat.tags
      if(xtags || Array.isArray(xtags)) {
        tags = [...xtags, ...tags].sort()
        xtags = tags.reduce((acc, c) => acc.includes(c) ? acc : [...acc, c], [])
      }else {
        xtags = tags
      }
  
      updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
        .then(xs => cb(null, xs))
        .catch(cb)
    })
  },

  fileRemoveTags(user, driveUUID, dirUUID, filename, tags, cb) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return cb(err)
    }
    let fromPath = path.join(dir.abspath(), filename)

    if(!tags.every(t => global.validTagIds.includes(t))) return cb(new Error('tags error, tagId not found'))

    readXstat(fromPath, (err, xstat) => {
      if (xstat.type !== 'file') {
        let e = new Error(`${filename} is not a file`)
        e.status = 404
        return cb(e)
      }
  
      let xtags = xstat.tags
      if(xtags || Array.isArray(xtags)) {
        xtags = xtags.filter(x => !tags.includes(x))
      }else {
        xtags = undefined
      }
      updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
        .then(xs => cb(null, xs))
        .catch(cb)
    })
  },

  fileResetTags(user, driveUUID, dirUUID, filename, cb) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return  cb(err)
    }
    let fromPath = path.join(dir.abspath(), filename)

    readXstat(fromPath, (err, xstat) => {

      if (xstat.type !== 'file') {
        let e = new Error(`${filename} is not a file`)
        e.status = 404
        return cb(e)
      }

      let xtags = undefined

      updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
        .then(xs => cb(null, xs))
        .catch(cb)
    })

  },

  fileSetTags(user, driveUUID, dirUUID, filename, tags, cb) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      return cb(err)
    }
    let fromPath = path.join(dir.abspath(), filename)

    if(!tags.every(t => global.validTagIds.includes(t))) return cb(new Error('tags error, tagId not found'))

    readXstat(fromPath, (err, xstat) => {
      if (xstat.type !== 'file') {
        let e = new Error(`${filename} is not a file`)
        e.status = 404
        return cb(e)
      }
  
      let xtags = tags
  
      updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
        .then(xs => cb(null, xs))
        .catch(cb)
    })
  }

}
