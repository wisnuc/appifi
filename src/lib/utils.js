const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const child = Promise.promisifyAll(require('child_process'))

const crypto = require('crypto')

const bcrypt = require('bcrypt')
const crypt3 = require('crypt3')
const UUID = require('uuid')

let tmpNum = 0
const tmpPrefix = UUID.v4()

/**
Utility functions

@module utils
*/

/**
Save a JavaScript object to a JSON file

@param {string} fpath - absolute file path
@param {string} tmpDir - temp file directory
@param {object} object - object to be saved
@param {function} callback - `err => {}`, reports error if any
*/
const saveObject = (fpath, tmpDir, object, callback) => {

  let jsonStr, finished = false

  try {
    jsonStr = JSON.stringify(object, null, '  ')
  }
  catch (e) {
    process.nextTick(() => callback(e))
    return
  }

  let tmpPath = path.join(tmpDir, tmpPrefix + (tmpNum++))

  // create a write stream
  let os = fs.createWriteStream(tmpPath)
  os.on('error', e => {
    if (finished) return
    finished = true
    callback(e)
  })

  os.on('close', () => {
    if (finished) return
    finished = true
    fs.rename(tmpPath, fpath, err => callback(err))
  })

  os.write(jsonStr)
  os.end()
}

/**
Async version of saveObject

@function saveObjectAsync
*/
const saveObjectAsync = Promise.promisify(saveObject)

/**
Encrypt password using bcrypt

@function passwordEncrypt
@param {string} password - password in plain text
@param {number} saltLen - salt length
*/
const passwordEncrypt = (password, saltLen) =>
  bcrypt.hashSync(password, bcrypt.genSaltSync(saltLen));

/**
Encrypt unix password (sha512, $6$)

@function unixPasswordEncrypt
@param {string} password - password in plain text
*/
const unixPasswordEncrypt = password =>
  crypt3(password, crypt3.createSalt('sha512').slice(0, 11))

/**
Encrypt smb password (md4, UTF16LE encoding)

@function md4Encrypt
@param {string} password - password in plain text
*/
const md4Encrypt = password =>  
  crypto.createHash('md4')
    .update(Buffer.from(password, 'utf16le'))
    .digest('hex')
    .toUpperCase()


module.exports = {
  saveObject,
  saveObjectAsync,
  passwordEncrypt,
  unixPasswordEncrypt,
  md4Encrypt
}


