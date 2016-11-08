import os from 'os'
import child from 'child_process'
import { storeState, storeDispatch } from '../reducers'

// ip addr add ${ipaddr}/24 dev ${dev} label ${dev}:wisnuc
// ip addr del ${ipaddr}/24 dev ${dev}:wisnuc

const K = x => y => x

const parseAliasing = (net) => 
  Object.keys(net).reduce((prev, curr, idx, arr) => 
    (curr.endsWith(':app') && arr.indexOf(curr.slice(0, -4)) !== -1) ? 
      [...prev, {
        dev: curr.slice(0, -4),
        mac: net[curr.slice(0, -4)][0]['mac'],
        ipv4: net[curr][0]['address'] 
      }] : prev, [])


const _mac2dev = (net, mac) => {
  for (let prop in net) {
    if (net.hasOwnProperty(prop) && 
        prop.indexOf(':') === -1 &&
        net[prop][0]['internal'] === false &&
        net[prop][0]['mac'].toUpperCase() === mac.toUpperCase())
    return prop
  }
}

const mac2dev = (mac) => _mac2dev(os.networkInterfaces(), mac) 

const aliases = () => parseAliasing(os.networkInterfaces())

const _addAlias = (dev, addr, callback) => 
  child.exec(`ip addr add ${addr}/24 dev ${dev} label ${dev}:app`, err => callback(err))

const addAlias = (dev, addr, callback) => 
  _addAlias(dev, addr, err => 
    err ? callback(err) : callback(K(null)(
      storeDispatch({
        type: 'CONFIG_IP_ALIASING',
        data: aliases().map(alias => ({ mac: alias.mac, ipv4: alias.ipv4}))
      })
    )))

const addAliasAsync = Promise.promisify(addAlias)

const _deleteAlias = (dev, addr, callback) => 
  child.exec(`ip addr del ${addr}/24 dev ${dev}:wisnuc`, err => callback(err))

const deleteAlias = (dev, addr, callback) => 
  _deleteAlias(dev, addr, err => 
    err ? callback(err) : callback(K(null)(
      storeDispatch({
        type: 'CONFIG_IP_ALIASING',
        data: aliases().map(alias => ({ mac: alias.mac, ipv4: alias.ipv4}))
      })
    )))

const deleteAliasAsync = Promise.promisify(deleteAlias)

const init = async () => {

  let i
  let activated = aliases()

  while (storeState().config === null) {
    await Promise.delay(100)
  }

  let config = storeState().config.ipAliasing

  // find common entries
  let common = activated.filter(act => !!config.find(conf => act.mac === conf.mac && act.ipv4 === conf.ipv4))

  // remove common entries from both list
  activated = activated.filter(act => !common.find(s => s === act))
  config = config.filter(conf => !common.find(s => s.mac === conf.mac && s.ipv4 === conf.ipv4))

  // remove activated but not configured
  for (i = 0; i < activated.length; i++)
    await Promise.promisify(_deleteAlias)(activated[i].dev, activated[i].ipv4) 

  // add configured but not activated
  let net = os.networkInterfaces()
  for (i = 0; i < config.length; i++)
    await Promise.promisify(_addAlias)(_mac2dev(net, config[i].mac), config[i].ipv4)
}

init()
  .then(() => console.log(`[system] ipaliasing initialized`, aliases()))
  .catch(e => console.log(e))

export { mac2dev, aliases, addAliasAsync, deleteAliasAsync }


