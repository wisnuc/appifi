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

const opTypes = ['start', 'stop', 'restart']
router.post('/:plugin/:type', fruit,/** auth.jwt(), **/ (req, res, next) => {
	let plugin = req.params.plugin
	if (plugin !== 'samba' && plugin !== 'dlna') return next(Object.assign(new Error(`${plugin} notfound`), { status: 400 }))
	if (opTypes.indexOf(req.params.type) == -1) return next(Object.assign(new Error(`${plugin} operation error`), { status: 400 }))
	let op
	switch(req.params.type) {
		case 'start':
			op = plugin === 'samba' ? req.fruit.startSambaAsync(req.user) : req.fruit.startDlnaAsync(req.user)
			break
		case 'stop':
			op = plugin === 'samba' ? req.fruit.stopSambaAsync(req.user) : req.fruit.stopDlnaAsync(req.user)
			break
		case 'restart':
			op = plugin === 'samba' ? req.fruit.restartSambaAsync(req.user) : req.fruit.restartDlnaAsync(req.user)
			break
	}
	op.then(() => res.status(200).json({}))
		.catch(next)
})

router.get('/:plugin/status', fruit, (req, res, next) => {
	switch(req.params.plugin) {
		case 'samba':
			return res.status(200).json({ status: req.fruit.getSambaStatus(req.user)})
			break
		case 'dlna':
			return res.status(200).json({ status: req.fruit.getDlnaStatus(req.user)})
			break
		default:
			return res.status(404).json()
			break
	}
	
})

module.exports = router