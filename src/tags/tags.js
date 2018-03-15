const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const path = require('path')
const UUID = require('uuid')
const deepFreeze = require('deep-freeze')

const E = require('../lib/error')
const { saveObjectAsync } = require('../lib/utils')
const { isUUID, isNonNullObject, isNonEmptyString } = require('../lib/assertion')

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

validateTags = (tags) => {

}

class Tags {
  constructor(froot) {
    this.filePath = path.join(froot, 'tags.json')
    this.tmpDir = path.join(froot, 'tmp')
    this.currMaxIndex = -1
    try {
      let tagsObj = JSON.parse(fs.readFileSync(this.filePath))
      this.tags = tagsObj.tags
      // check index if not max
      this.currMaxIndex = tagsObj.index
      this.tags.forEach(t => {
        if(t.id > this.currMaxIndex) {
          debug('find tag index large then currMaxIndex,', t, currMaxIndex)
          this.currMaxIndex = t.id
        }
      })
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
    return this.tags.find(t => t.id === tagId)
  }

  /**
  Save tags to file. This operation use opportunistic lock.
  */
  async commitTagsAsync(currTags, nextTags, index) {

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
      await saveObjectAsync(this.filePath, this.tmpDir, { tags:nextTags, index })

      // update in-memory object
      this.tags = nextTags

      // enforce immutability
      deepFreeze(this.tags)
    } finally {
      // get all tagIds
      let tagIds = this.tags.map(t => t.id).sort()
      // add tagIds to global
      global.validTagIds = tagIds

      // put lock
      this.lock = false
    }
  }

  async createTagAsync(props) {
    if (!isNonNullObject(props)) throw E.EINVAL('props must be non-null object')
    if (!isNonEmptyString(props.name)) throw E.EINVAL('tag name must be non-empty string')
    //TODO: check creator , group

    let currTags = this.tags
    let ctime = new Date().getTime()

    // get current max index
    let currIndex = this.currMaxIndex
    // this.tags.forEach(t => {
    //   if(t.id > currIndex) currIndex = t.id
    // })

    if(++currIndex > MAX_TAG_ID) throw new Error('too many tags')

    let newTag = {
      name: props.name,
      id: currIndex,
      color: props.color ? props.color : null,
      group: props.group ? props.group : null,
      creator: props.creator,
      ctime,
      mtime: ctime
    }

    let nextTags = [...currTags, newTag]
    await this.commitTagsAsync(currTags, nextTags, currIndex)
    this.currMaxIndex ++
    return newTag
  }

  async deleteTagAsync(tagId) {
    //TODO: check permission
    let currTags = this.tags

    let index = this.tags.findIndex(t => t.id === tagId)
    if (index === -1) throw new Error('tag not found')


    let nextTags = [...currTags.slice(0, index), ...currTags.slice(index + 1)]
    await this.commitTagsAsync(currTags, nextTags, this.currMaxIndex)
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

    await this.commitTagsAsync(currTags, nextTags, this.currMaxIndex)
    return nextTag
  }
}

module.exports = (froot) => {
  let tag = new Tags(froot)
  let tagIds = tag.tags.map(t => t.id).sort()
  // add tagIds to global
  global.validTagIds = tagIds
  return tag
}