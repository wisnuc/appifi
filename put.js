const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const request = require('superagent')
// const request = require('request')
const UUID = require('uuid')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

if (process.argv.length < 3) return

// 'http+unix://%2Fabsolute%2Fpath%2Fto%2Funix.sock/search'

/**
mkdirp(tmptest, err => {

  let fpath = path.join(tmptest, UUID.v4())
  let stream = fs.createReadStream(process.argv[2])
  let req = request
    .put('http+unix://%2Ftmp%2Fsidekick/file') //    .put('http://localhost:8964/file')
    .query({ path: fpath })
    .on('error', err => {
      console.log('error', err)
    })
    .on('response', res => {
      console.log('response', res.body)
    })

  stream.pipe(req)
})
**/

mkdirp(tmptest, err => {

  let fpath = path.join(tmptest, UUID.v4())
  let stream = fs.createReadStream(process.argv[2])
  let req = request
    .put(`http://localhost:4005/file?path=${fpath}`)
    .on('error', err => {
      console.log('error', err)
    })
    .on('response', res => {
      console.log('response', res.body)
    })

  stream.pipe(req)
})


