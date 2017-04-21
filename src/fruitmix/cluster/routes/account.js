
import { Router } from 'express'
import config from '../config'
import { localUsers } from '../model'

let router = Router();

// get account info
router.get('/', (req, res) => {

	let userUUID = req.user.uuid;
	localUsers((err, users) => {
		err ? res.status(500).json(Object.assign({}, err))
			: res.status(200).json(Object.assign({}, users.filter(u => u.uuid === userUUID)[0]))
	})

	// config.ipc.call('getAccountInfo', userUUID, (err, user) => {
	// 	err ? res.status(500).json({})
	// 		: res.status(200).json(Object.assign({}, user))
	// })
})

export default router