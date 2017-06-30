const Promise = require('bluebird')

const router = require('express').Router()

/**
  POST /mkfs
  {
    type: 'btrfs',
    target: ['sda', 'sdb', ...],
    mode: 'single' or 'raid0' or 'raid1'
  }
**/
const isValidMkfsArgs = body => 
  typeof body === 'object'
    && body !== null
    && body.type === 'btrfs'
    && Array.isArray(body.target)
    && body.target.every(item => typeof item === 'string' && item.length > 0)  
    && -1 !== ['single', 'raid0', 'raid1'].indexOf(body.mode)

router.post('/mkfs', (req, res) => 
  !isValidMkfsArgs(req.body)
    ? invalid(res)
    : mkfsBtrfs(req.body, (err, volume) => 
      err ? error(res, err) : ok(res, volume)))

/**
  POST /install
  { 
    target: uuid,
    username: non-empty STRING, 
    password: non-empty STRING, 
    intall or reinstall is true
  }
**/
const isValidInstallArgs = body =>
  typeof body === 'object'
    && body !== null
    && typeof body.target === 'string'
    && validator.isUUID(body.target)
    && typeof body.username === 'string'
    && body.username.length > 0
    && typeof body.password === 'string'
    && body.password.length > 0
    && (body.install === true || body.reinstall === true)

router.post('/install', (req, res) => 
  !isValidInstallArgs(req.body)
    ? invalid(res)
    : Boot.manualBootAsync(req.body).asCallback(err => err
      ? console.log(err) || res.status(500).json({ code: err.code, message: err.message })
      : res.status(200).json({ message: 'ok' })))

/**
  GET /storage

	if query string raw=true, return original storage object
  if query string wisnuc=true, return probed storage object
	otherwise, just (pretty) storage without log
**/
router.get('/storage', (req, res) => {

	if (req.query.raw === 'true')	
		return res.status(200).json(Storage.get(true))

	if (req.query.wisnuc !== 'true')
		return nolog(res).status(200).json(Storage.pretty)	
	else
		Boot.probedStorageAsync().asCallback((err, storage) => {
			if (err) return error(res, err)	
			return ok(res, storage)
		})
})

module.exports = router
