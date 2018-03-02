const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const path = require('path')
const UUID = require('uuid')
const deepFreeze = require('deep-freeze')

const E = require('../lib/error')
const { saveObjectAsync } = require('../lib/utils')
const { isUUID, isNonNullObject, isNonEmptyString } = require('../lib/assertion')

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
 *    createor,
 *    ctime,
 *    mtime,
 * }
 */

validateTags = (tags) => {

}

class Tags {
  constructor(froot) {
    this.filePath = path.join(froot, 'tags.json')
    this.tmpDir = path.join(froot, 'tmp')

    try {
      this.tags = JSON.parse(fs.readFileSync(this.filePath))
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      this.tags = []
    }

    validateTags(this.tags)

    deepFreeze(this.tags)

    /**
    @member {boolean} lock - internal file operation lock
    */
    this.lock = false
  }

  findTag(tagId) {
    return this.tags.find(t => t.id === parseInt(tagId))
  }

  /**
  Save tags to file. This operation use opportunistic lock.
  */
  async commitTagsAsync(currTags, nextTags) {

    // referential equality check
    if (currTags !== this.tags) throw E.ECOMMITFAIL()

    // check atomic operation lock
    if (this.lock === true) throw E.ECOMMITFAIL()
    
    //validate
    validateTags(nextTags)

    // get lock
    this.lock = true
    try {
      // save to file
      await saveObjectAsync(this.filePath, this.tmpDir, nextTags)

      // update in-memory object
      this.tags = nextTags

      // enforce immutability
      deepFreeze(this.tags)
    } finally {
      // TODO: notify
      // put lock
      this.lock = false
    }
  }

  async createTagAsync(props) {
    if (!isNonNullObject(props)) throw E.EINVAL('props must be non-null object')
    if (!isNonEmptyString(props.name)) throw E.EINVAL('tag name must be non-empty string')
    //TODO: check createor , group

    let currTags = this.tags
    let ctime = new Date().getTime()

    // get current max index
    let currIndex = 0
    this.tags.forEach(t => {
      if(t.id > currIndex) currIndex = t.id
    })

    if(++currIndex > MAX_TAG_ID) throw new Error('too many tags')

    let newTag = {
      name: props.name,
      id: currIndex,
      color: props.color ? props.color : null,
      group: props.group ? props.group : null,
      createor: props.createor,
      ctime,
      mtime: ctime
    }

    let nextTags = [...currTags, newTag]
    await this.commitTagsAsync(currTags, nextTags)
    return newTag
  }

  async deleteTagAsync(tagId) {
    //TODO: check permission
    let currTags = this.tags

    let index = this.tags.findIndex(t => t.id === tagId)
    if (index === -1) throw new Error('tag not found')


    let nextTags = [...currTags.slice(0, index), ...currTags.slice(index + 1)]
    await this.commitTagsAsync(currTags, nextTags)
  }

  async updateTagAsync(tagId, props) {

    let currTags = this.tags

    let index = this.tags.findIndex(t => t.id === tagId) 
    if (index === -1) throw new Error('tag not found')

    let nextTag = Object.assign({}, this.tags[index], props)
    let nextTags = [
      ...currTags.slice(0, index),
      nextTag,
      ...currTags.slice(index + 1)
    ] 

    await this.commitTagsAsync(currTags, nextTags)
    return nextTag
  }
}

module.exports = Tags