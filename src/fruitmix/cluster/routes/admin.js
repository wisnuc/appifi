
import { Router } from 'express'
import config from '../config'

let router = Router();

// get all local user info
router.get('/users', (req, res) => {

	// permission useruuid
	let useruuid = req.useruuid;
	config.ipc.register('getAllLocalUser', useruuid, (err, users) => {
		err ? res.status(500).json({})
			: res.status(200).json(Object.assign({}, { users }))
	})
})

// add pulbic drive
router.post('/drive', (req, res) => {
	// permission useruuid
	let useruuid = req.useruuid;
	let drive = req.drive;
	config.ipc.call('createPublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json({})
			: res.status(200).json(Object.assign({ drive }))
	})
})

// update public drive
router.patch('/:driveUUID', (req, res) => {
	// permission useruuid
	let useruuid = req.useruuid;
	let drive = req.drive;
	config.ipc.call('updatePublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json({})
			: res.status(200).json(Object.assign({ drive }))
	})
})

export default router