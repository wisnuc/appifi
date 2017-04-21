
import { Router } from 'express'
import config from '../config'


let router = Router();

// get account info
router.get('/', (req, res) => {

	let userUUID = req.user.uuid;
	config.ipc.call('getAccountInfo', userUUID, (err, user) => {
		err ? res.status(500).json({})
			: res.status(200).json(Object.assign({}, user))
	})
})

export default router