const Promise = require('bluebird')

const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const os = require('os')

/**
Pure function for retrieving Ethernet interface information

@module Eth
*/

var classNetPath ='/sys/class/net'

const mapAsyncMapFilter = async (arr, asyncMapper, mapper, options) => 
  (await Promise.map(arr, item => asyncMapper(item).reflect(), options))
    .map((x, index) => x.isFulfilled() ? mapper(arr[index], x.value()) : null)
    .filter(x => !!x)

const enumerateNetworkInterfaceNamesAsync = async (dirpath) => {

  let entries = await fs.readdirAsync(dirpath)
  let interfaces = await mapAsyncMapFilter(entries,         // entries
    entry => fs.lstatAsync(path.join(dirpath, entry)),      // imapper, map entry to stat, async
    (entry, stat) => stat.isSymbolicLink() ? entry : null)  // omapper, select entry by stat 

  return await mapAsyncMapFilter(interfaces, 
    itfc => fs.readlinkAsync(path.join(dirpath, itfc)), 
    (itfc, link) => !link.startsWith('../../devices/virtual/') ? itfc : null)
}

const autoInt = (string) => parseInt(string).toString() === string ? parseInt(string) : string

const formatFileValue = (value) => {

  let arr = value.toString().trim().split('\n')

  // if all have key=value format, return an object
  if (arr.every(item => (item.match(/=/g) || []).length === 1)) {
    let object = {}
    arr.forEach(item => object[item.split('=')[0]] = autoInt(item.split('=')[1]))
    return object
  }

  arr = arr.map(item => autoInt(item))

  // otherwise return single string or string array
  return arr.length === 1 ? arr[0] : arr
}

const genKeyValuePair = (stat, value) => {
  if (stat.isFile()) 
    return { key: stat.entry, value: formatFileValue(value) } 
  else if (stat.isSymbolicLink()) 
    return { key: stat.entry, value: value.toString() } 
  else if (stat.isDirectory())
    return { key: stat.entry, value: value }
  else 
    return null 
}

const objectifyAsync = async (dirpath) => {

  let object = {}
  let entries = await fs.readdirAsync(dirpath)
  let stats = await mapAsyncMapFilter(entries, 
    entry => fs.lstatAsync(path.join(dirpath, entry)),
    (entry, stat) => Object.assign(stat, { entry }))

  let pairs = await mapAsyncMapFilter(stats,
    stat => {
      let entryPath = path.join(dirpath, stat.entry)
      if (stat.isFile()) 
        return fs.readFileAsync(entryPath)
      else if (stat.isSymbolicLink())
        return fs.readlinkAsync(entryPath)
      else if (stat.isDirectory())
        return Promise.resolve(objectifyAsync(entryPath))
      else
        return null
    },
    (stat, value) => genKeyValuePair(stat, value))

  pairs.forEach(pair => object[pair.key] = pair.value)
  return object
}

const enumerateNetworkInterfacesAsync = async () => {

  let names = await enumerateNetworkInterfaceNamesAsync(classNetPath)
  return await mapAsyncMapFilter(names,
    name => Promise.resolve(objectifyAsync(path.join(classNetPath, name))),
    (name, obj) => Object.assign(obj, { name }))
}

/**
Return object combining ethernet interface information extracted from both node.js API and sysfs

```
// example
{
  "os": {
    "lo": [
      {
        "address": "127.0.0.1",
        "netmask": "255.0.0.0",
        "family": "IPv4",
        "mac": "00:00:00:00:00:00",
        "internal": true
      },
      {
        "address": "::1",
        "netmask": "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
        "family": "IPv6",
        "mac": "00:00:00:00:00:00",
        "scopeid": 0,
        "internal": true
      }
    ],
    "enp0s3": [
      {
        "address": "10.10.15.250",
        "netmask": "255.255.252.0",
        "family": "IPv4",
        "mac": "08:00:27:e4:37:b2",
        "internal": false
      },
      {
        "address": "fe80::a00:27ff:fee4:37b2",
        "netmask": "ffff:ffff:ffff:ffff::",
        "family": "IPv6",
        "mac": "08:00:27:e4:37:b2",
        "scopeid": 2,
        "internal": false
      }
    ]
  },
  "sysfs": [
    {
      "addr_assign_type": 0,
      "addr_len": 6,
      "address": "08:00:27:e4:37:b2",
      "broadcast": "ff:ff:ff:ff:ff:ff",
      "carrier": 1,
      "carrier_changes": 4,
      "dev_id": "0x0",
      "dev_port": 0,
      "device": "../../../0000:00:03.0",
      "dormant": 0,
      "duplex": "full",
      "flags": "0x1003",
      "gro_flush_timeout": 0,
      "ifalias": "",
      "ifindex": 2,
      "iflink": 2,
      "link_mode": 0,
      "mtu": 1500,
      "name_assign_type": 4,
      "netdev_group": 0,
      "operstate": "up",
      "power": {
        "async": "disabled",
        "control": "auto",
        "runtime_active_kids": 0,
        "runtime_active_time": 0,
        "runtime_enabled": "disabled",
        "runtime_status": "unsupported",
        "runtime_suspended_time": 0,
        "runtime_usage": 0
      },
      "proto_down": 0,
      "queues": {
        "rx-0": {
          "rps_cpus": 0,
          "rps_flow_cnt": 0
        },
        "tx-0": {
          "byte_queue_limits": {
            "hold_time": 1000,
            "inflight": 0,
            "limit": 332364,
            "limit_max": 1879048192,
            "limit_min": 0
          },
          "tx_maxrate": 0,
          "tx_timeout": 0,
          "xps_cpus": 0
        }
      },
      "speed": 1000,
      "statistics": {
        "collisions": 0,
        "multicast": 243,
        "rx_bytes": 15775560,
        "rx_compressed": 0,
        "rx_crc_errors": 0,
        "rx_dropped": 0,
        "rx_errors": 0,
        "rx_fifo_errors": 0,
        "rx_frame_errors": 0,
        "rx_length_errors": 0,
        "rx_missed_errors": 0,
        "rx_over_errors": 0,
        "rx_packets": 70756,
        "tx_aborted_errors": 0,
        "tx_bytes": 230267444,
        "tx_carrier_errors": 0,
        "tx_compressed": 0,
        "tx_dropped": 0,
        "tx_errors": 0,
        "tx_fifo_errors": 0,
        "tx_heartbeat_errors": 0,
        "tx_packets": 148759,
        "tx_window_errors": 0
      },
      "subsystem": "../../../../../class/net",
      "tx_queue_len": 1000,
      "type": 1,
      "uevent": {
        "INTERFACE": "enp0s3",
        "IFINDEX": 2
      },
      "name": "enp0s3"
    }
  ]
}
```
*/
module.exports = async () => ({
  os: os.networkInterfaces(),
  sysfs: await enumerateNetworkInterfacesAsync()
})

// module.exports().then(r => console.log(JSON.stringify(r, null, '  ')))


