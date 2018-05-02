const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const path = require('path')
const UUID = require('uuid')
const deepFreeze = require('deep-freeze')

const E = require('../lib/error')
const { saveObjectAsync } = require('../lib/utils')
const { isUUID, isNonNullObject, isNonEmptyString } = require('../lib/assertion')
const DataStore = require('../lib/DataStore')

const Debug = require('debug')
const debug = Debug('Tags')

let MAX_TAG_ID = 2048
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

class Tag extends require('events') {
  constructor (opts) {
    super()

    this.conf = opts.configuration
    this.fruitmixDir = opts.fruitmixDir

    this.store = new DataStore({
      file: opts.file,
      tmpDir: opts.tmpDir,
      isArray: false
    })

    this.store.on('Update', (...args) => this.emit('Update', ...args))

    Object.defineProperty(this, 'tags', {
      get () {
        return this.store.data ? (this.store.data.tags ? this.store.data.tags : []) : []
      }
    })
  }

  findTag (tagId) {
    return this.tags.find(t => t.id === tagId)
  }

  createTag (props, callback) {
    if (!isNonNullObject(props)) throw E.EINVAL('props must be non-null object')
    if (!isNonEmptyString(props.name)) throw E.EINVAL('tag name must be non-empty string')
    let newTag
    this.store.save(data => {
      let index = data ? data.index + 1 : 0

      if (!data) data = {} // create enpty data object
      if (Array.isArray(data.tags) && !data.tags.every(t => t.name !== props.name)) { throw new Error('name has already been used') }
      if (index > MAX_TAG_ID) throw new Error('too many tags')
      let ctime = new Date().getTime()
      newTag = {
        name: props.name,
        id: index,
        color: props.color ? props.color : null,
        group: props.group ? props.group : null,
        creator: props.creator,
        ctime,
        mtime: ctime
      }
      Array.isArray(data.tags) ? data.tags.push(newTag) : data.tags = [newTag]
      data.index = index
      return data
    }, (err, data) => {
      if (err) return callback(err)
      callback(null, newTag)
    })
  }

  deleteTag (tagId, callback) {
    this.store.save(data => {
      let index = data.tags.findIndex(t => t.id === tagId)
      if (index === -1) throw new throwError('tag not found')
      data.tags = [...data.tags.slice(0, index), ...data.tags.slice(index + 1)]
      return data
    }, callback)
  }

  updateTag (tagId, props, callback) {
    let nextTag
    this.store.save(data => {
      let index = data.tags.findIndex(t => t.id === tagId)
      if (index === -1) throw new Error('tag not found')

      if (isNonEmptyString(props.name) && !data.tags.every(t => t.name !== props.name)) { throw new Error('name has already been used') }

      nextTag = Object.assign({}, data.tags[index])
      if (props.name) nextTag.name = props.name
      if (props.color) nextTag.color = props.color
      nextTag.mtime = new Date().getTime()

      data.tags = [...data.tags.slice(0, index), nextTag, ...data.tags.slice(index + 1)]
      return data
    }, err => {
      if (err) return callback(err)
      callback(null, nextTag)
    })
  }

  LIST (user, props, callback) {
    process.nextTick(() => callback(null, this.tags))
  }

  /**
   *
   * @param {*} user
   * @param {object} props
   *  tagId - number string
   * @param {*} callback
   */
  GET (user, props, callback) {
    let tagId = parseInt(props.tagId)
    if (!Number.isInteger(tagId)) { return callback(Object.assign(new Error('tagId error'), { status: 400 })) }
    let tag = this.findTag(tagId)
    if (!tag) { return process.nextTick(() => callback(Object.assign(new Error('tag not found'), { status: 404 }))) }
    process.nextTick(() => callback(null, tag))
  }

  POST (user, props, callback) {
    if (!user || !user.uuid) { return callback(Object.assign(new Error('user not found'), { status: 404 })) }
    let { name, color, group } = props
    if (!name || typeof name !== 'string' || !name.length) { return callback(Object.assign(new Error('name is required'), { status: 400})) }
    if (!this.tags.every(t => t.name !== name)) { return callback(Object.assign(new Error('tag name has already be used'), { status: 400 })) }
    let creator = user.uuid
    this.createTag({ name, color, group, creator }, callback)
  }

  PATCH (user, props, callback) {
    if (!user || !user.uuid) { return callback(Object.assign(new Error('user not found'), { status: 404 })) }
    let { tagId, name, color, group } = props
    tagId = parseInt(tagId)
    if (!Number.isInteger(tagId)) return callback(Object.assign(new Error('tagId error'), { status: 400 }))
    if (!this.tags.every(t => t.name !== name)) { return callback(Object.assign(new Error('tag name has already be used'), { status: 400 })) }
    this.updateTag(tagId, { name, color, group }, callback)
  }

  DELETE (user, props, callback) {
    if (!user || !user.uuid) { return callback(Object.assign(new Error('user not found'), { status: 404 })) }
    let tagId = parseInt(props.tagId)
    if (!Number.isInteger(tagId)) return callback(Object.assign(new Error('tagId error'), { status: 400 }))
    let tag = this.findTag(tagId)
    if (!tag) return callback(Object.assign(new Error('tag not found'), { status: 400}))
    this.deleteTag(tag.id, callback)
  }
}

module.exports = Tag
