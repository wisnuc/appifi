const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const router = require('express').Router

const uploadDir = path.join(_fruitmixPath, 'upload')

const loadUploads = (uuid, callback) => {

  let dirPath = path.join(_fruitmixPath, 'uploads', uuid)

  fs.readdir(dirPath, (err, entries) => {

    if (err) return callback(err) 

    
  })
}

router.get('/', auth.jwt(), (req, res) => {
  
  let user = req.user 
 
  loadUploads(user.uuid, (err, uploads) => {

    return 
  }) 
})

router.post('/', auth.jwt(), (req, res) => {

  let user = req.user

  let dirPath = path.join(_fruitmixPath, 'uploads', user.uuid)

})

router.get('/:uploadUUID', auth.jwt(), (req, res) => {

})

router.delete('/:uploadUUID', auth.jwt(), (req, res) => {

})

router.put('/:uploadUUID/segments/:index', auth.jwt(), (req, res) => {

})
