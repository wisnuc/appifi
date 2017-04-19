
import { Router } from 'express'
import auth from '../middleware/auth'
import config from '../config'

let router = Router();

// get account info
router.get('/:userUUID', auth,jwt(), (req, res) => {

	let userUUID = req.params.userUUID;
	config.ipc.call('getAccountInfo', userUUID, (err, user) => {
		err ? res.status(500).json({})
			: res.status(200).json(Object.assign({}, user))
	})
})

export default router