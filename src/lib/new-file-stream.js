const path = require('path')
const fs = require('fs')
const child = require('child_process')
const stream = require('stream')
const debug = require('debug')('newfilestream')

const threadify = require('./threadify')

const modulePath = path.join('tmp', 'b7fed555-3d9c-4651-bbd7-7b6343bf5e23') 

const moduleSource = `

const fs = require('fs')
const crypto = require('crypto')
const hash = crypto.createHash('sha256')

const copy = (src, dst) => {

  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)
  let hash = 
}

process.on('message', message => {

})


`
