const requestC = require('./request').requestHelper
const getFruit = require('../../fruitmix')
const { FILE, CONFIG } = require('./const')
const debug = require('debug')('station')

class BoxUpdater {
  
  constructor(ctx) {
    this.ctx = ctx
    this.publishBoxes(err => {

    })
  }

  publishBoxes(callback) {
    let fruit = getFruit()
    if(!fruit) throw new Error('fruitmix not start')
    fruit.getBoxesSummary((err, boxes) => {
      if(err) return callback(err)
      let url = CONFIG.CLOUD_PATH + 's/v1/boxes/batch'
      let token = this.ctx.token
      let opts = { 'Authorization': token }
      let params = { 'create': boxes } // TODO change ticket status
      debug('发起update boxes', boxes, url)
      requestC('POST', url, { params }, opts, (err, res) => {
        console.log(err)
        console.log(res.body)
      })
    })    
  }

  updateBox(box) {

  }

  deleteBox(boxUUID) {

  }

  updateLastTweet(boxUUID, tweet) {

  }
}

module.exports = BoxUpdater