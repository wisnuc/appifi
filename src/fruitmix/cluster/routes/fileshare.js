import fs from 'fs'
import path from 'path'

import xattr from 'fs-xattr'
import { Router } from 'express'
import formidable from 'formidable'

import auth from '../middleware/auth'
import config from '../config'
import { createFileShareService } from '../../file/fileShareService'
import paths from '../lib/paths'
import response from '../middleware/response'

let router = Router()

// get all fileShares of a user
router.get('/', auth.jwt(), (req, res) => {
  let user = req.user

  config.ipc.call('getUserFileShares', { userUUID: user.uuid }, (err, shares) => {
    if(err) return response.res.error(err, 400)
    response.res.success(shares)
  })
})

// create a fileShare
router.post('/', auth.jwt(), (req, res) => {
  let user = req.user
  let props = Object.assign({}, req.body)

  config.ipc.call('createFileShare', { userUUID: user.uuid, props }, (err, share) => {
    if(err) return response.res.error(err)
    response.res.success(share)
  })
})

// update a fileShare
router.patch('/:shareUUID', auth.jwt(), (req, res) => {
  let user = req.user
  let shareUUID = req.params.shareUUID
  let props = Object.assign({}, req.body)

  config.ipc.call('updateFileShare', { userUUID: user.uuid, shareUUID, props }, (err, newShare) => {
    if(err) return response.res.error(err)
    response.res.success(newShare)
  })
})

// delete a fileShare 
router.delete('/:shareUUID', auth.jwt(), (req, res) => {
  let user = req.user
  let shareUUID = req.params.shareUUID

  config.ipc.call('deleteFileShare', { userUUID: user.uuid, shareUUID }, (err, data) => {
    if(err) return response.res.error(err)
    response.res.success()
  })
})








