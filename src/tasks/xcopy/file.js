/**
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

const { openwx } = require('./lib')
const Node = require('./node')
**/

module.exports = {
  File: require('./file-base'),
  FileCopy: require('./file-copy'), 
  FileMove: require('./file-move'),
  FileImport: require('./file-import'),
  FileExport: require('./file-export'),
}


