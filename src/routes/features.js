const Promise = require('bluebird')
const router = require('express').Router()
const auth = require('../middleware/auth')

const broadcast = require('../common/broadcast')
const getFruit = require('../fruitmix')
const UUID = require('uuid')

const fruit = (req, res, next) => {
	req.fruit = getFruit()
	if (req.fruit) {
		next()
	} else {
		res.status(503).json({ message: 'fruitmix not available' })
	}
}

const sambaTypes = ['start', 'stop', 'restart']
router.post('/samba/:type', fruit,/** auth.jwt(), **/ (req, res, next) => {
	if (sambaTypes.indexOf(req.params.type) == -1) return next(Object.assign(new Error('samba operation error'), { status: 400 }))
	switch(req.params.type) {
		case 'start':
			req.fruit.startSambaAsync(req.user)
				.then(() => res.status(200).json({}))
				.catch(next)
			break
		case 'stop':
			req.fruit.stopSambaAsync(req.user)
				.then(() => res.status(200).json({}))
				.catch(next)
			break
		case 'restart':
			req.fruit.restartSambaAsync(req.user)
				.then(() => res.status(200).json({}))
				.catch(next)
			break
	}
})

router.get('/samba/status', fruit, (req, res, next) => res.status(200).json({ status: req.fruit.getSambaStatus(req.user)}))

module.exports = router