
import { Router } from 'express'
import auth from '../middleware/auth'
import config from '../config'

let router = Router();

// get local user info
router.get('/users', auth.jwt(), (req, res) => {})

// add pulbic drive
router.post('/drive', auth.jwt(), (req, res) => {
	let useruuid = req.useruuid;
	let drive = req.drive;
	// config.ipc.call()
})

// update public drive
router.patch('/:driveUUID', auth,jwt(), (req, res) => {})

export default router