import fs from 'fs'
import path from 'path'

import xattr from 'fs-xattr'
import { Router } from 'express'
import formidable from 'formidable'

import auth from '../middleware/auth'
import config from '../config'
import { createFileShareService } from '../../file/fileShareService'
import paths from '../lib/paths'

let router = Router()

router.get('/', (req, res) => {
  config.ipc.call('getFileShares', {}, (err, data) => {
  })
})

router.post('/', (req, res) => {
  config.ipc.call('createFileShare', req.body, (err, data) => {
  })
})

router.patch('/:shareUUID', (req, res) => {
  config.ipc.call('updateFileShare', req.body, (err, data) => {
  })
})

router.delete('/:shareUUID', (req, res) => {
  config.ipc.call('deleteFileShare', req.body, (err, data) => {
  })
})








