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

/**
 * Tags is provide flexible file classification for user files
 * Name tags
 *
 * Tag : {
 *    name
 *    color
 *    id,
 *    creator,
 *    ctime,
 *    mtime,
 * }
 */

class Tag extends require('events') {
  constructor (opts) {
    super()
    this.phi = true
    this.conf = opts.configuration
    this.fruitmixDir = opts.fruitmixDir

    this.store = new DataStore({
      file: opts.file,
      tmpDir: opts.tmpDir,
      isArray: true
    })

    this.store.on('Update', (...args) => this.emit('Update', ...args))

    Object.defineProperty(this, 'tags', {
      get () {
        return this.store.data ? this.store.data: []
      }
    })
  }

  /**
   *
   * @param {*} user
   * @param {object} props
   *  tagId - number string
   * @param {*} callback
   */

  LIST (user, props, callback) {
    if (this.phi) {
      process.nextTick(() => {
        callback(null, this.tags.filter(t => t.creator == user.uuid && !t.deleted))
      })
    } else process.nextTick(() => callback(null, this.tags.filter(t => !t.deleted)))
  }
  
  GET (user, props, callback) {
    let tagId = parseInt(props.tagId)
    if (!Number.isInteger(tagId)) { return callback(Object.assign(new Error('tagId error'), { status: 400 })) }
    let tag
    if (this.phi) {
      tag = this.tags.find(t => t.id === tagId && t.creator == user.uuid && !t.deleted)
    } else {
      tag = this.tags.find(t => t.id === tagId && !t.deleted)
    } 
    if (!tag) { return process.nextTick(() => callback(Object.assign(new Error('tag not found'), { status: 404 }))) }
    process.nextTick(() => callback(null, tag))
  }

  // 创建Tag
  POST (user, props, callback) {
    try {
      // 检查user
      if (!user || !user.uuid) { 
        return callback(Object.assign(new Error('user not found'), { status: 404 })) 
      }
      let creator = user.uuid
      let { name, color } = props
      let errors = [], newTag

      // 校验参数
      errors = errors.concat(validateName(name), validateColor(color))
      if (errors.length) return callback(Object.assign(errors[0], {status: 400}))

      // 检查name是否重复
      let result = validateRepetition(name, creator, this.tags, this.phi)
      if (result) return callback(Object.assign(result, { status: 400 }))

      this.store.save(tags => {
        let index = tags? tags.length > 0? tags[tags.length -1].id + 1 :0 : 0
        if (!tags) tags = [] // create empty array
  
        let ctime = new Date().getTime()
        newTag = {
          name,
          id: index,
          color: color ? color : null,
          creator: creator,
          ctime,
          mtime: ctime,
          deleted: false
        }
        
        return [...tags, newTag]
      }, (err, data) => {
        if (err) return callback(err)
        callback(null, newTag)
      })

    } catch(e) {
      callback(e)
    }

    // 检查tag参数
    if (!isNonNullObject(props)) throw E.EINVAL('props must be non-null object')
    if (!isNonEmptyString(props.name)) throw E.EINVAL('tag name must be non-empty string')
  }

  // 更新Tag
  PATCH (user, props, callback) {
    try {
      // 检查user
      if (!user || !user.uuid) { 
        return callback(Object.assign(new Error('user not found'), { status: 404 })) 
      }
      let creator = user.uuid
      let { tagId, name, color } = props
      tagId = parseInt(tagId)
      if (!Number.isInteger(tagId)) return callback(Object.assign(new Error('tagId error'), { status: 400 }))
      let errors = [], nextTag

      // 校验参数
      errors = errors.concat(validateName(name), validateColor(color))
      if (errors.length) return callback(Object.assign(errors[0], {status: 400}))

      // 检查name是否重复
      let result = validateRepetition(name, creator, this.tags, this.phi)
      if (result) return callback(Object.assign(result, { status: 400 }))

      this.store.save(tags => {
        // 检查tag是否存在
        let index = tags.findIndex(t => t.id === tagId && t.creator == creator)
        if (index === -1) throw Object.assign(new Error('tag not found'), {status: 404})
  
        nextTag = Object.assign({}, tags[index])

        if (props.name) nextTag.name = props.name
        if (props.color) nextTag.color = props.color
        nextTag.mtime = new Date().getTime()

        return [...tags.slice(0, index), nextTag, ...tags.slice(index + 1)]
      }, err => {
        if (err) return callback(err)
        callback(null, nextTag)
      })

    } catch(e) {
      callback(e)
    }
  }

  // 删除Tag
  DELETE (user, props, callback) {
    if (!user || !user.uuid) { return callback(Object.assign(new Error('user not found'), { status: 404 })) }
    let tagId = parseInt(props.tagId)
    if (!Number.isInteger(tagId)) return callback(Object.assign(new Error('tagId error'), { status: 400 }))
    let tag = this.tags.find(item => item.id == tagId && item.creator == user.uuid)
    if (!tag) return callback(Object.assign(new Error('tag not found'), { status: 404}))
    let result = []
    // this.deleteTag(tag.id, callback)
    this.store.save(tags => {
      let index
      if (this.phi) {
        index = tags.findIndex(t => t.id === tagId && t.creator == user.uuid && !t.deleted)
      } else {
        index = tags.findIndex(t => t.id === tagId && !t.deleted)
      }
      if (index === -1) throw new Error('tag not found')
      tags[index].deleted = true
      return [...tags]

    }, (err, data) => {
      if (err) return callback(err)
      callback(null, data.filter(t => t.creator == user.uuid && !t.deleted))
    })
  }
}

const validateName = (name) => {
  let forbidCode = []
  let error = []
  if (!name || name == '')
    error.push(new Error('name is required'))

  if (typeof name !== 'string')
    error.push(new Error('name is llegal'))
  
  if (name.length > 256) 
    error.push(new Error('name length should less than 256')) 

  for(let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) < 33 ) {
      error.push(new Error('exist llegal characters'))
      break
    } 
  }
  
  return error
}

const validateColor = (color) => {
  let error = []
  let pat = new RegExp('^#([0-9A-F]{6}|[0-9A-F]{3})$')
  if (!color || !color.length)
    error.push(new Error('color is required'))

  if (!pat.test(color))
    error.push(new Error('color is llegal'))
  
  return error
}

const validateRepetition = (name, creator, names, type) => {
  let result = null

  if (type) {
    if (names.some(t => t.name == name && t.creator == creator)) {
      result = new Error('name has already been used') 
    }   
  } else {
    if (!names.every(t => t.name !== props.name)) {
      result = new Error('name has already been used') 
    }
  }

  return result
}

module.exports = Tag
