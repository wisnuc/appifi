const os = require('os')
const child = require('child_process')
const router = require('express').Router()

const broadcast = require('../common/broadcast')
const sysfsNetworkInterfaces = require('./networkInterfaces')

/**

@requires Broadcast
@module Net
*/

/**
Fired when network interface config updated by user.

@event NetworkInterfacesUpdate
@global
*/

/**
This data type represents a configuration for a network interface, identified by name.

```
networkInterfaceConfig {
  name: 'enp14s0',
  aliases: [
    '192.168.5.150/24',
    '192.168.5.166/24'
  ]
}
```

@typedef {object} networkInterfaceConfig
@property {string} name - network interface name
@property {string[]} aliases - array of ipv4 or ipv6 addresses in cidr notation.
@global
*/

/**

*/
let nics = []

/**
Returns network interfaces, annotated with config.
*/
const interfaces = callback =>
  sysfsNetworkInterfaces((err, _its) => {
    if (err) return callback(err)

    // reformat
    const its = _its
      .map(it => ({
        name: it.name,
        address: it.address,
        mtu: it.mtu,
        speed: it.speed,
        wireless: !!it.wireless,
        state: it.operstate,

        // for node address
        ipAddresses: [],

        // for config
        config: null
      }))
      .filter(it => it.state === 'up' || it.state === 'down')

    // annotate ip addresses
    const obj = os.networkInterfaces()

    Object.keys(obj).forEach((key) => {
      if (!key.includes(':')) {
        const it = its.find(i => i.name === key)
        if (it) it.ipAddresses.push(...obj[key])
        return
      }

      const split = key.split(':')
      if (split.length !== 2 || split[0].length === 0 || split[1].length === 0) return

      const number = parseInt(split[1], 10)
      if (!Number.isInteger(number) || number < 0 || `${number}` !== split[1]) return

      const it = its.find(i => i.name === split[0])
      if (!it) return

      const addrs = obj[key]
        .filter(addr => addr.family === 'IPv4')
        .map(addr => Object.assign({ number }, addr))

      it.ipAddresses.push(...addrs)
    })

    // annotate nics
    nics.forEach((config) => {
      const it = its.find(i => i.name === config.name)
      if (it) it.config = config
    })

    callback(null, its)
  })

const update = () => interfaces((err, its) => {
  if (err) return
  its.forEach(it => {
    if (it.state !== 'up') return

    // find out the largest number used
    let num = it.ipAddresses
      .reduce((curr, { number }) => (number ? Math.max(number, curr) : curr), 0) + 1

    // bring up all aliases not up
    if (it.config && it.config.aliases) {
      it.config.aliases.forEach((alias) => {
        if (it.ipAddresses.find(ipAddr => ipAddr.address === alias.split('/')[0])) return

        child.exec(`ip addr add ${alias} dev ${it.name} label ${it.name}:${num}`)
        num += 1
      })
    }

    // shutdown all aliases not in config
    it.ipAddresses.forEach((ipAddr) => {
      if (!ipAddr.number) return

      let aliases = it.config && it.config.aliases
      if (!aliases || !aliases.find(alias => alias.split('/')[0] === ipAddr.address)) {
        child.exec(`ip addr del ${ipAddr.address} dev ${it.name}:${ipAddr.number}`)
      }
    })
  })
})

broadcast.on('ConfigUpdate', (err, config) => {
  if (err) return
  if (!Array.isArray(config.networkInterfaces)) {
    process.nextTick(() => broadcast.emit('NetworkInterfacesUpdate', null, []))
    return
  }
  if (nics === config.networkInterfaces) return
  nics = config.networkInterfaces
  update()
})

router.get('/', (req, res) =>
  interfaces((err, its) => err ? res.status(500).end() : res.status(200).json(its)))

router.post('/:name/aliases', (req, res, next) => {
  let name = req.params.name
  let ipv4 = req.body.ipv4
  let mask = req.body.mask

  interfaces((err, its) => {
    if (err) return next(err)

    let it = its.find(i => i.name === name)
    if (!it) return res.status(404).end()

    let cidr = `${ipv4}/${mask}`
    let conf = { name, aliases: [cidr] }
    let index = nics.findIndex(c => c.name === name)
    let newNics = index === -1
      ? [...nics, conf]
      : [...nics.slice(0, index), conf, ...nics.slice(index + 1)]

    newNics.sort((a, b) => a.name.localeCompare(b.name))
    broadcast.emit('NetworkInterfacesUpdate', newNics)
    res.status(200).end()
  })
})

router.delete('/:name/aliases/:ipv4', (req, res, next) => {
  let name = req.params.name
  let ipv4 = req.params.ipv4

  interfaces((err, its) => {
    if (err) return next(err)

    let it = its.find(i => i.name === name)
    if (!it) return res.status(404).end()

    res.status(200).end()
  })
})

module.exports = router
