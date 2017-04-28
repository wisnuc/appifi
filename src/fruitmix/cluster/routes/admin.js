
import { Router } from 'express'
import config from '../config'

let router = Router();

// get all local user info
router.get('/users', (req, res) => {

	// permission useruuid
	let useruuid = req.user.uuid;
	config.ipc.call('getAllLocalUser', useruuid, (err, users) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { users }))
	})
})

// admin create local user
router.post('/users', (req, res) => {

	let userUUID = req.user.uuid
	let props = Object.assign({}, req.body, {
		type: 'local'
	})

	config.ipc.call('createLocalUser', {
		useruuid: userUUID,
		props
	}, (err, user) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(user)
	})
})

// admin update user
router.patch('/users/:userUUID', (req, res) => {

	let permissionUser = req.user
	let useruuid = req.params.userUUID

	if (!user.isAdmin && userUUID !== permissionUser.uuid)
		return res.status(401).json({ message: 'permission error'})

	let props = Object.assign({}, req.body)

	config.ipc.call('updateUser', {
		useruuid: userUUID,
		props
	}, (err, user) => {
		err ? res.status(500).json({
			code: err.code,
			message: err.message
		}) : res.status(200).json(Object.assign({}, user, {
			password: undefined,
			smbPassword: undefined,
			lastChangetime: undefined
		}))
	})
})

// get all public drive
router.get('/drives', (req, res) => {
	let useruuid = req.user.uuid
	config.ipc.call('getAllPublicDrive', useruuid, (err, drives) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drives }))
	})
})

// add pulbic drive
router.post('/drives', (req, res) => {
	// permission useruuid
	let useruuid = req.user.uuid;
	let drive = req.drive;
	config.ipc.call('createPublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drive }))
	})
})

// update public drive
router.patch('/:driveUUID', (req, res) => {
	// permission useruuid
	let useruuid = req.user.uuid;
	let drive = req.drive;
	config.ipc.call('updatePublicDrive', { useruuid, props:drive }, (err, drive) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, { drive }))
	})
})

export default router