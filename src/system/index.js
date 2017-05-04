const Promise = require('bluebird')
const child = require('child_process')
const os = require('os')

const router = require('express').Router()
const validator = require('validator')

const debug = require('debug')('system:index')

const Boot = require('./boot')
const Config = require('./config')
const Device = require('./device')
const Storage = require('./storage')

const { readFanSpeed, writeFanScale } = require('./barcelona')
const eth = require('./eth')
const { mac2dev, aliases, addAliasAsync, deleteAliasAsync } = require('./ipaliasing')
const { mkfsBtrfs } = require('./mkfs')


const nolog = (res) => Object.assign(res, { nolog: true })
const unsupported = res => res.status(404).json({ code: 'EUNSUPPORTED', message: 'not supported' })
const invalid = res => res.status(400).json({ code: 'EINVAL', message: 'invalid api arguments' })
const error = (res, err) => res.status(500).json({ code: err.code, message: err.message })
const ok = (res, obj) => res.status(200).json(obj ? obj : ({ message: 'ok' }))

/**
 *  GET /boot, return boot status
 */
router.get('/boot', (req, res) => {

  let obj = Object.assign({}, Boot.get(), {
    bootMode: Config.get().bootMode,
    lastFileSystem: Config.get().lastFileSystem,
    fruitmix: Boot.fruitmix ? Boot.fruitmix.getState() : null
  }) 

  // quick fix, TODO
  if (!obj.currentFileSystem) obj.currentFileSystem = null

  nolog(res).status(200).json(obj)
})

/**
 *  POST /boot
 *  {
 *    op: STRING_ENUM,      // 'poweroff', 'reboot', 'rebootMaintenance', 'rebootNormal' 
 *    target: STRING_UUID,  // file system uuid, required only if op === 'rebootNormal'
 *  }
 */
const isValidBootArgs = body => 
  typeof body === 'object' 
    && body !== null
    && !!['poweroff', 'reboot', 'rebootMaintenance', 'rebootNormal'].includes(body.op)
    && body.op === 'rebootNormal' 
      ? (typeof body.target === 'string' && validator.isUUID(body.target))
      : true

router.post('/boot', (req, res) =>
  !isValidBootArgs(req.body)
    ? invalid(res)
    : rebootAsync(req.body.op, req.body.target).asCallback(err =>
      err
        ? error(res, err)
        : ok(res)))

/**
 *  GET /device, return device info 
 */
router.get('/device', (req, res) => ok(res, Device.get()))

/**
 *  GET /fan, return { fanSpeed, fanScale }
 */
router.get('/fan', (req, res) => 
  !Device.isWS215i() 
    ? unsupported(res)
    : readFanSpeed((err, fanSpeed) => err
      ? error(res, err)
      : ok(res, { fanSpeed, fanScale: Config.get().barcelonaFanScale })))

/**
 *  POST /fan
 *  {
 *    fanScale: INTEGER
 *  }
 */
const isValidFanArgs = body => 
  typeof body === 'object'
    && body !== null
    && Number.isIntegery(body.fanScale) 
    && body.fanScale >= 0 
    && body.fanScale <= 100

router.post('/fan', (req, res) =>
  !Device.isWS215i()
    ? unsupported(res)
    : !isValidFanArgs(req.body) 
      ? invalid(res)
      : writeFanScale(req.body.fanScale, err => 
        err ? error(res, err) : ok(res)))

/**
 *  GET /ipaliasing, return ipaliasing (list)
 */
router.get('/ipaliasing', (req, res) => res.status(200).json(aliases()))

/**
 *  POST /ipaliasing
 */
router.post('/ipaliasing', (req, res) => (async () => {

  let { mac, ipv4 } = req.body
  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac) 
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)
  
  let dev = mac2dev(mac)
  if (!dev) 
    throw Object.assign(new Error('no interface found with given mac'), { code: 'ENOENT' })

  await addAliasAsync(dev, ipv4)
  return aliases().find(alias => alias.mac === mac)

})().asCallback((err, obj) => respond(res, err, obj)))

/**
 *  DELETE /ipaliasing
 */
router.delete('/ipaliasing', (req, res) => (async () => {
    
  let { mac, ipv4 } = req.body

  if (typeof mac !== 'string' || !validator.isMACAddress(mac))
    throw Object.assign(new Error('invalid mac'), { code: 'EINVAL' })
  if (typeof ipv4 !== 'string' || !validator.isIP(ipv4, 4))
    throw Object.assign(new Error('invalid ipv4'), { code: 'EINVAL' })

  let existing = aliases().find(alias => alias.mac === mac)
  console.log(existing)
  if (existing) 
    await deleteAliasAsync(existing.dev, existing.ipv4)

})().asCallback((err, obj) => respond(res, err, obj)))

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
 * GET /net, return os and sysfs network interfaces
 */
router.get('/net', (req, res) => 
  eth().asCallback((err, result) => 
    err ? error(res, err) : ok(res, result)))


/**
  POST /run
  { 
    target: fsUUID 
  }
**/
const isValidRunArgs = body => 
  typeof body === 'object' 
    && body !== null 
    && typeof body.target !== 'string' 
    && !validator.isUUID(body.target)

router.post('/run', (req, res) => 
  !isValidRunArgs(req.body) 
    ? res.status(400).json({ code: 'EINVAL', message: 'invalid arguments' }) 
    : Boot.manualBootAsync(req.body, false).asCallback(err => err
      ? res.status(400).json({ code: err.code, message: err.message })
      : res.status(200).json({ message: 'ok' })))

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
    && (body.install === true || typeof body.reinstall === true)

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
		return nolog(res).status(200).json(Storage.get())	
	else
		Boot.probedStorageAsync().asCallback((err, storage) => {
			if (err) return error(res, err)	
			return ok(res, storage)
		})
})

const K = x => y => x

const timedate = (callback) => 
  child.exec('timedatectl', (err, stdout, stderr) => 
    err ? callback(err) : callback(null, stdout.toString().split('\n').filter(l => l.length)
      .reduce((prev, curr) => {
        let pair = curr.split(': ').map(str => str.trim())
        prev[pair[0]] = pair[1]
        return prev
      }, {})))

// timedate
router.get('/timedate', (req, res) => timedate((err, obj) => 
  err ? K(res.status(500).end())(console.log(err)) : res.status(200).json(obj)))

////////////////////////////////////////
/**
const respond = (res, err, obj) => err ? 
    res.status(codeMap.get(err.code) || 500)
      .json({ code: err.code, message: err.message }) :
    res.status(200)
      .json((obj === null || obj === undefined) ? { message: 'success' } : obj)

router.use('/storage', mir)
router.use('/mir', mir)


router.post('/boot', (req, res) => {

  let obj = req.body
  if (obj instanceof Object === false)
    return res.status(400).json({ message: 'invalid arguments, req.body is not an object'})

  if (['poweroff', 'reboot', 'rebootMaintenance', 'rebootNormal'].indexOf(obj.op) === -1)
    return res.status(400).json({ message: 'op must be poweroff, reboot, or rebootMaintenance' }) 

  if (obj.target) {
    // if target is provided
    if (obj.op !== 'rebootNormal')
      return res.status(400).json({ message: 'target can only be used when op is rebootNormal' })

    // validate target FIXME
  }

  if (obj.op === 'poweroff') {

    console.log('[system] powering off')
    shutdown('poweroff')
  }
  else if (obj.op === 'reboot') {

    console.log('[system] rebooting')
    shutdown('reboot')
  }
  else if (obj.op === 'rebootMaintenance') {

    console.log('[system] rebooting into maintenance mode')
    storeDispatch({
      type: 'CONFIG_BOOT_MODE',
      data: 'maintenance'
    })
    shutdown('reboot')
  }
  else if (obj.op === 'rebootNormal') {

    console.log('[system] rebooting into normal mode')

    if (obj.target) {
      storeDispatch({
        type: 'CONFIG_BOOT_TARGET',
        data: {
          type: 'btrfs',
          uuid: target
        }
      })
    }
    else {
      storeDispatch({
        type: 'CONFIG_BOOT_TARGET'
      })
    }
    shutdown('reboot')
  }

  res.status(200).json({
    message: 'ok'
  })
})
**/
module.exports = router
