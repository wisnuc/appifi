
import { Router } from 'express'
import auth from '../middleware/auth'
import config from '../config'

let router = Router();

// get all local user info
router.get('/users', (req, res) => {

	// permission useruuid
	let useruuid = req.useruuid;
	config.ipc.register('getAllLocalUser', useruuid, (err, users) => {
		err ? res.status(500).json({})
			: res.status(200).json(Object.assgin({}, { users }))
	})
})

// add pulbic drive
router.post('/drive', (req, res) => {
	// permission useruuid
	let useruuid = req.useruuid;
	let drive = req.drive;
	// config.ipc.call()
})

// update public drive
router.patch('/:driveUUID', auth,jwt(), (req, res) => {})

export default router