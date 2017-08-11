const Promise = require('bluebird')
const uuid = require('uuid')
const path = require('path')
const UUID = require('uuid')
const fs = require('fs')
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const User = require('../models/user')
const boxData = require('../box/boxData')

class BoxService {
  constructor(User, boxData) {
  }

  getAllBoxes(user) {

  }

  getBox(user, boxUUID) {

  }

  // props {name, users:[]}
  createBox(user, props) {

  }

  // update name and users, only box owner is allowed
  // props {name, users: {op: add/delete, value: [user global ID]}}
  updateBox(user, boxUUID, props) {

  }

  deleteBox(user, boxUUID) {

  }

  getAllBranches(user, boxUUID) {

  }

  getBranch(user, boxUUID, branchUUID) {

  }

  // props {name, head}
  createBranch(user, boxUUID, props) {

  }

  // props {name, head}
  updateBranch(user, boxUUID, branchUUID, props) {

  }

  deleteBranch(user, boxUUID, branchUUID) {

  }

  // props {first, last, count, segments}
  getTweets(user, boxUUID, props) {

  }

  // FIXME:   contents in props ?
  createTweet(user, boxUUID, props) {

  }

  // add tweetsID into blacklist
  deleteTweet(user, boxUUID, tweetsID) {

  }
}





