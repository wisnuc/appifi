const Promise = require('bluebird')
const child = require('child_process')
const os = require('os')

const router = require('express').Router()

const broadcast = require('../../common/broadcast')
const Barceloa = require('../barcelona')
const System = require('../system')

/**

@module Control
*/

/**
Returns system info
*/
router.get('/system', (req, res) => res.status(200).json(System()))

/**
Returns timedate output
*/
router.get('/timedate', (req, res) => {

  child.exec('timedatectl', (err, stdout, stderr) => {

    if (err) return res.status(500).json({code: err.code, message: err.message})
    
    let timedate = stdout
      .toString()
      .split('\n')
      .filter(l => l.length)
      .reduce((prev, curr) => {
        let pair = curr.split(': ').map(str => str.trim())
        prev[pair[0]] = pair[1]
        return prev
      }, {})

    res.status(200).json(timedate)
  })
})

/**
Returns network interfaces
*/
router.get('/net/interfaces', (req, res) => {

  let obj = os.networkInterfaces()
  let its = Object
    .keys(obj)
    .reduce((arr, key) => [...arr, { dev: key, addresses: obj[key] }], [])

  let origs = its.filter(it => !it.dev.endsWith(':app'))

  its.filter(it => it.dev.endsWith(':app'))
    .forEach(alias => {

      let orig = origs.find(o => o.dev === alias.dev.slice(0, -4))
      if (!orig) return

      alias.addresses.forEach(addr => {
        addr.alias = true
        orig.addresses.push(addr)
      })
    })

  res.status(200).json(origs)
})

router.post('/net/interfaces/:dev/aliases', (req, res) => {

  let dev = req.params.dev
  let ipv4 = req.body.ipv4

  child.exec(`ip addr add ${ipv4}/24 dev ${dev} label ${dev}:app`, err => { 

    if (err) return res.status(500).json({ code: err.code, message: err.message })  
    broadcast.emit('IpAliasUpdate')
    res.status(200).end()
  })
})

router.delete('/net/interfaces/:dev/aliases/:ipv4', (req, res) => {

  let dev = req.params.dev
  let ipv4 = req.params.ipv4

  child.exec(`ip addr del ${addr}/24 dev ${dev}:app`, err => {

    if (err) return res.status(500).json({ code: err.code, message: err.message })  
    broadcast.emit('IpAliasUpdate')
    res.status(200).end()    
  })
})

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

module.exports = router

