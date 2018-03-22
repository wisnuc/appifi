const requestC = require('./request').requestHelper
const getFruit = require('../../fruitmix')
const { FILE, CONFIG } = require('./const')
const debug = require('debug')('boxes:updater')

class BoxUpdater {
  
  constructor(ctx) {
    this.ctx = ctx
    this.publishBoxes(err => {
      if(err) debug(err)
      else debug('publish boxes success')
    })
    this.initHandle(err => {
      if(err) debug(err)
    })
  }

  initHandle(callback) {
    let fruit = getFruit()
    if(!fruit) callback(new Error('fruitmix not start'))
    let boxData = fruit.boxData
    boxData.on('Box_CreateBox', this.createBox.bind(this))
    boxData.on('Box_UpdateBox', this.updateBox.bind(this))
    boxData.on('Box_DeleteBox', this.deleteBox.bind(this))
    boxData.on('Box_CreateTweet', this.updateLastTweet.bind(this))
  }

  publishBoxes(callback) {
    let fruit = getFruit()
    if(!fruit) callback(new Error('fruitmix not start'))
    fruit.getBoxesSummary((err, boxes) => {
      if(err) return callback(err)
      if(!boxes || !boxes.length) return callback()
      let url = CONFIG.CLOUD_PATH + 's/v1/boxes/batch'
      let token = this.ctx.token
      let opts = { 'Authorization': token }
      let params = { create: boxes } // TODO change ticket status
      debug('发起publish boxes', url)
      requestC('POST', url, { params }, opts, (err, res) => {
        if(err) {
          debug(err)
        }else
          return callback()
      })
    })    
  }

  createBox(box) {
    let url = CONFIG.CLOUD_PATH + 's/v1/boxes/'
    let token = this.ctx.token
    let opts = { 'Authorization': token }
    let params = box // TODO change ticket status
    debug('发起 create box', box, url)
    requestC('POST', url, { params }, opts, (err, res) => {
      if(err) debug(err)
    })
  }

  updateBox(box) {
    let url = CONFIG.CLOUD_PATH + 's/v1/boxes/' + box.uuid 
    let token = this.ctx.token
    let opts = { 'Authorization': token }
    let params = Object.assign(box, { uuid:undefined, ctime:undefined }) // TODO change ticket status
    debug('发起 update box', box, url)
    requestC('PATCH', url, { params }, opts, (err, res) => {
      if(err) debug(err)
    })
  }

  deleteBox(boxUUID) {
    let url = CONFIG.CLOUD_PATH + 's/v1/boxes/' + boxUUID 
    let token = this.ctx.token
    let opts = { 'Authorization': token }
    debug('发起 delete box', boxUUID, url)
    requestC('DELETE', url, {}, opts, (err, res) => {
      if(err) debug(err)
    })
  }

  updateLastTweet({boxUUID, tweet}) {
    if(tweet) tweet.tweeter = tweet.tweeter.id
    tweet = Object.assign(tweet, { boxId: boxUUID })
    let url = CONFIG.CLOUD_PATH + 's/v1/tweets'
    let token = this.ctx.token
    let opts = { 'Authorization': token }
    let params = tweet
    debug('发起 update last tweet', tweet, url)
    requestC('POST', url, { params }, opts, (err, res) => {
      if(err) debug(err)
    })
  }
}

module.exports = BoxUpdater