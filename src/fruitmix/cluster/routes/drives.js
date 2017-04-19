
import { Router } from 'express'

import auth from '../middleware/auth'
import config from '../config'

let router = Router()

// get home, library & public drive
router.get('/', auth.jwt(), (req, res) => {
	config.ipc.call('getDrives', (err, drives) => {
		err ? res.status(500).json({})
			: res.status(200).json(Object.assign({}, drives))
	})
})

// get drive info
router.get('/:driveUUID', auth.jwt(), (req, res) => {
  let driveUUID = req.params.driveUUID
  config.ipc.call('getDriveInfo', driveUUID, (err, drive) => {
  	err ? res.status(500).json({})
			: res.status(200).json(Object.assign({}, drive))
  })
})

export default router