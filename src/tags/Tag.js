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

  constructor(opts) {
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

  findTag(tagId) {
    return this.tags.find(t => t.id === tagId)
  }

  createTag(props, callback) {
    if (!isNonNullObject(props)) throw E.EINVAL('props must be non-null object')
    if (!isNonEmptyString(props.name)) throw E.EINVAL('tag name must be non-empty string')
    let newTag
    this.store.save(data => {
      let index = data ? data.index + 1 : 0
      
      if (!data) data = {} // create enpty data object

      if(index > MAX_TAG_ID) throw new Error('too many tags')
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
      if(err) return callback(err)
      callback(null, newTag)
    })
  }

  deleteTag (tagId, callback) {
    this.store.save(data => {
      let index = data.tags.findIndex(t => t.id === tagId)
      if (index === -1) throw new Error('tag not found')
      data.tags = [...data.tags.slice(0, index), ...data.tags.slice(index + 1)]
      return data
    }, callback)
  }

  updateTag(tagId, props, callback) {
    let nextTag
    this.store.save(data => {
      let index = data.tags.findIndex(t => t.id === tagId) 
      if (index === -1) throw new Error('tag not found')

      nextTag = Object.assign({}, data.tags[index])
      if (props.name) nextTag.name = props.name
      if (props.color) nextTag.color = props.color
      nextTag.mtime = new Date().getTime()

      data.tags = [...data.tags.slice(0, index), nextTag, ...data.tags.slice(index + 1)]
      return data
    }, err => {
      if(err) return callback(err)
      callback(null, nextTag)
    })
  }

 }

 module.exports = Tag