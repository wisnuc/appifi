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

const { readXstatAsync, updateFileTagsAsync } = require('../lib/xstat')

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

  async addTagsAsync(user, driveUUID, dirUUID, filename, tags) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      throw err
    }
    let fromPath = path.join(dir.abspath(), filename)

    if(!tags.every(t => global.validTagIds.includes())) throw new Error('tags error, tagId not found')

    let xstat = await readXstatAsync(fromPath)

    if (xstat.type !== 'file') {
      let e = new Error(`${filename} is not a file`)
      e.status = 404
      throw e
    }

    let xtags = xstat.tags
    if(xtags || Array.isArray(xtags)) {
      tags = [...xtags, ...tags].sort()
      xtags = tags.reduce((acc, c) => acc.includes(c) ? acc : [...acc, c], [])
    }else {
      xtags = tags
    }

    return await updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
  },

  async removeTagsAsync(user, driveUUID, dirUUID, filename, tags) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      throw err
    }
    let fromPath = path.join(dir.abspath(), filename)

    if(!tags.every(t => global.validTagIds.includes())) throw new Error('tags error, tagId not found')

    let xstat = await readXstatAsync(fromPath)

    if (xstat.type !== 'file') {
      let e = new Error(`${filename} is not a file`)
      e.status = 404
      throw e
    }

    let xtags = xstat.tags
    if(xtags || Array.isArray(xtags)) {
      tags = [...xtags, ...tags].sort()
      xtags = tags.filter(x => !tags.includes(x))
    }else {
      xtags = undefined
    }

    return await updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
  },

  async resetTagsAsync(user, driveUUID, dirUUID, filename) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      throw err
    }
    let fromPath = path.join(dir.abspath(), filename)

    if(!tags.every(t => global.validTagIds.includes())) throw new Error('tags error, tagId not found')

    let xstat = await readXstatAsync(fromPath)

    if (xstat.type !== 'file') {
      let e = new Error(`${filename} is not a file`)
      e.status = 404
      throw e
    }

    let xtags = undefined

    return await updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
  },

  async setTagsAsync(user, driveUUID, dirUUID, filename, tags) {
    let dir = this.driveList.getDriveDir(driveUUID, dirUUID)
    if (!dir) {
      let err = new Error('drive or dir not found')
      err.status = 404
      throw err
    }
    let fromPath = path.join(dir.abspath(), filename)

    if(!tags.every(t => global.validTagIds.includes())) throw new Error('tags error, tagId not found')

    let xstat = await readXstatAsync(fromPath)

    if (xstat.type !== 'file') {
      let e = new Error(`${filename} is not a file`)
      e.status = 404
      throw e
    }

    let xtags = tags

    return await updateFileTagsAsync(fromPath, xstat.uuid, xtags, xstat.mtime)
  }

}