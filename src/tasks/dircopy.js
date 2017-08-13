const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const { forceXstat } = require('../lib/xstat')
const Transform = require('../lib/transform')
const fileCopy = require('../forest/filecopy')
const Forest = require('../forest/forest')

class DirCopy extends EventEmitter {

  constructor() {
    super()
  }

  let dirwalk = new Transform({
    spawn: {
      name: 'dirwalk-fruit',

      /**
      This function is the equivalent of readdir and lstat that operating on
      a fruitmix file system
      */
      transform: function (x, callback) {
      }
    }
  })
}

module.exprots = DirCopy


