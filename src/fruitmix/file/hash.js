const path = require('path')
const fs = require('fs')

const E = require('../lib/error')
const Worker = require('./worker')

const command = require('../lib/command')
const isSHA256 = require('../lib/is').isSHA256
const updateFileHash = require('../file/xstat')

/**
@module Hash
*/

/**
A concrete worker class for hashing a fruitmix file.
@extends Worker
@todo Support non-fruitmix file.
*/
class HashWorker extends Worker {

  /**
  @param {string} fpath - absolute file path
  @param {string} uuid - file object uuid
  */
  constructor(fpath, uuid) {
    super()
    this.fpath = fpath
    this.uuid = uuid
    this.cmd = undefined
    this.hash = undefined
  }

  /**
  abort cmd before finishing.
  */
  cleanUp() {
    this.cmd && this.cmd()
  }

  /**
  hash given file using openssl
  */
  run() {
    fs.lstat(this.fpath, (err, stats) => 
      this.finished ? undefined
      : err ? this.error(err)
      : !stats.isFile() ?  this.error(new E.ENOTFILE())
      : this.cmd = command('openssl', ['dgst', '-sha256', '-r', this.fpath], (err, data) => 
          this.finished ? undefined
          : err ? this.error(err)
          : !isSHA256(this.hash = data.toString().trim().split(' ')[0]) ? this.error(new E.FORMAT())
          : fs.lstat(this.fpath, (err, stats2) => 
              this.finished ? undefined
              : err ? this.error(err)
              : !stats.isFile() ? this.error(new E.ENOTFILE()) 
              : stats.mtime.getTime() !== stats2.mtime.getTime() ? this.error(new E.ETIMESTAMP())
              : updateFileHash(this.fpath, this.uuid, this.hash, stats.mtime.getTime(), (err, xstat) => 
                  this.finished ? undefined
                  : err ? this.error(err)
                  : this.finish(xstat)))))
  }
}

/**
Constructs a HashWorker instance. Factory method.

@function Hash
@param {string} fpath - absolute file path
@param {string} [uuid] - fruitmix file uuid
@returns {HashWorker}
*/
const Hash = (fpath, uuid) => new HashWorker(fpath, uuid)

module.exports = Hash

