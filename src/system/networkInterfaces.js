const path = require('path')
const fs = require('fs')

/**
Pure function for retrieving network interfaces information from linux sysfs.

This file has no external dependencies for standalone usage, such as:

`require('./src/system/networkInterfaces')((err, obj) => console.log(err || obj))`

https://www.kernel.org/doc/Documentation/ABI/testing/sysfs-class-net

@module networkInterfaces
*/

/**
Path to sysfs network class
@const
*/
const classNetPath = '/sys/class/net'

/**
Convert string to integer when appropriate
@params {string} string
*/
const autoInt = (string) => parseInt(string).toString() === string ? parseInt(string) : string

/**
Format value read from file
@param {(buffer|string)} value
@returns formatted value
*/
const formatFileValue = (value) => {
  let arr = value.toString().trim().split('\n')

  // if all have key=value format, return an object
  if (arr.every(item => (item.match(/=/g) || []).length === 1)) {
    let object = {}
    arr.forEach(item => {
      object[item.split('=')[0]] = autoInt(item.split('=')[1])
    })
    return object
  }

  arr = arr.map(item => autoInt(item))

  // otherwise return single string or string array
  return arr.length === 1 ? arr[0] : arr
}

/**
Convert sysfs key value tree to JavaScript object. This function works recursively
@param {string} dirPath - directory path in sysfs
@param {function} callback - `(err, object) => {}`
*/
const objectify = (dirPath, callback) => {
  let object = {}
  fs.readdir(dirPath, (err, entries) => {
    if (err) return callback(err)
    if (entries.length === 0) return callback(null, {})

    let count = entries.length
    entries.forEach(entry => {
      let entryPath = path.join(dirPath, entry)
      fs.lstat(entryPath, (err, stat) => {
        const finish = () => !--count && callback(null, object)

        if (err) return finish()
        if (stat.isFile()) {
          fs.readFile(entryPath, (err, data) => {
            if (!err) object[entry] = formatFileValue(data)
            finish()
          })
        } else if (stat.isSymbolicLink()) {
          fs.readlink(entryPath, (err, linkString) => {
            if (err) return finish()
            if (entry !== 'phy80211') {
              object[entry] = linkString.toString()
              return finish()
            }

            objectify(entryPath, (err, obj) => {
              if (err) return finish()
              object[entry] = obj
              return finish()
            })
          })
        } else if (stat.isDirectory()) {
          objectify(entryPath, (err, obj) => {
            if (!err) object[entry] = obj
            finish()
          })
        } else { finish() }
      })
    })
  })
}

/**
This function returns all non-virtual network interfaces in `/sys/class/net` as JavaScirpt object.

Attribute names are formatted to camelCased strings.
Values in file are read and converted to strings or numbers.
Directories are recursively converted to nested JavaScript objects.
Symbolic Links are converted to strings, using linkString as its value.
There is one exception. `phy80211` are followed and treated as a directory.

```
// example output for a offline ethernet network card and a online wireless network card.
[ { name: 'enp14s0',
    device: '../../../0000:0e:00.0',
    subsystem: '../../../../../../class/net',
    ifalias: '',
    addr_assign_type: 0,
    address: '0c:54:a5:2d:cf:de',
    addr_len: 6,
    broadcast: 'ff:ff:ff:ff:ff:ff',
    carrier: 0,
    carrier_changes: 0,
    dev_id: '0x0',
    dev_port: 0,
    dormant: 0,
    flags: '0x1003',
    duplex: 'half',
    gro_flush_timeout: 0,
    iflink: 2,
    ifindex: 2,
    link_mode: 0,
    mtu: 1500,
    name_assign_type: 4,
    netdev_group: 0,
    operstate: 'down',
    proto_down: 0,
    speed: 10,
    tx_queue_len: 1000,
    type: 1,
    uevent: { INTERFACE: 'enp14s0', IFINDEX: 2 },
    power:
     { async: 'disabled',
       control: 'auto',
       runtime_active_kids: 0,
       runtime_active_time: 0,
       runtime_enabled: 'disabled',
       runtime_status: 'unsupported',
       runtime_usage: 0,
       runtime_suspended_time: 0 },
    statistics:
     { collisions: 0,
       multicast: 0,
       rx_bytes: 0,
       rx_compressed: 0,
       rx_crc_errors: 0,
       rx_dropped: 0,
       rx_errors: 0,
       rx_fifo_errors: 0,
       rx_frame_errors: 0,
       rx_length_errors: 0,
       rx_missed_errors: 0,
       rx_over_errors: 0,
       rx_packets: 0,
       tx_aborted_errors: 0,
       tx_carrier_errors: 0,
       tx_bytes: 0,
       tx_compressed: 0,
       tx_dropped: 0,
       tx_errors: 0,
       tx_fifo_errors: 0,
       tx_heartbeat_errors: 0,
       tx_packets: 0,
       tx_window_errors: 0 },
    queues: { 'rx-0': [Object], 'tx-0': [Object] } },
  { name: 'wlp13s0',
    device: '../../../0000:0d:00.0',
    subsystem: '../../../../../../class/net',
    wireless: {},
    ifalias: '',
    addr_assign_type: 0,
    addr_len: 6,
    address: '34:23:87:0f:ee:15',
    broadcast: 'ff:ff:ff:ff:ff:ff',
    carrier: 1,
    carrier_changes: 10,
    dev_id: '0x0',
    dev_port: 0,
    dormant: 0,
    flags: '0x1003',
    gro_flush_timeout: 0,
    ifindex: 3,
    iflink: 3,
    link_mode: 1,
    mtu: 1500,
    name_assign_type: 4,
    netdev_group: 0,
    operstate: 'up',
    proto_down: 0,
    tx_queue_len: 1000,
    type: 1,
    uevent: { DEVTYPE: 'wlan', INTERFACE: 'wlp13s0', IFINDEX: 3 },
    power:
     { async: 'disabled',
       runtime_active_kids: 0,
       control: 'auto',
       runtime_active_time: 0,
       runtime_enabled: 'disabled',
       runtime_status: 'unsupported',
       runtime_usage: 0,
       runtime_suspended_time: 0 },
    statistics:
     { collisions: 0,
       rx_bytes: 326621149,
       multicast: 0,
       rx_compressed: 0,
       rx_crc_errors: 0,
       rx_dropped: 0,
       rx_errors: 0,
       rx_fifo_errors: 0,
       rx_frame_errors: 0,
       rx_missed_errors: 0,
       rx_length_errors: 0,
       rx_over_errors: 0,
       rx_packets: 296858,
       tx_aborted_errors: 0,
       tx_bytes: 37300445,
       tx_carrier_errors: 0,
       tx_compressed: 0,
       tx_fifo_errors: 0,
       tx_errors: 0,
       tx_dropped: 0,
       tx_packets: 229105,
       tx_window_errors: 0,
       tx_heartbeat_errors: 0 },
    queues:
     { 'rx-0': [Object],
       'tx-0': [Object],
       'tx-1': [Object],
       'tx-2': [Object],
       'tx-3': [Object] },
    phy80211:
     { device: '../../../0000:0d:00.0',
       subsystem: '../../../../../../class/ieee80211',
       uevent: '',
       address_mask: '00:00:00:00:00:00',
       addresses: '34:23:87:0f:ee:15',
       index: 0,
       macaddress: '34:23:87:0f:ee:15',
       name: 'phy0',
       power: [Object],
       rfkill0: [Object] } } ]
```
*/
module.exports = callback => fs.readdir(classNetPath, (err, entries) => {
  let count

  if (err) return callback(err)
  if (entries.length === 0) return callback(null, [])

  count = entries.length
  let links = []
  entries.forEach(entry => fs.lstat(path.join(classNetPath, entry), (err, stat) => {
    if (!err && stat.isSymbolicLink()) links.push(entry)
    if (!--count) {
      if (links.length === 0) return callback(null, [])

      count = links.length
      let nonvirts = []
      links.forEach(link => fs.readlink(path.join(classNetPath, link), (err, linkString) => {
        if (!err && !linkString.startsWith('../../devices/virtual')) nonvirts.push(link)
        if (!--count) {
          if (nonvirts.length === 0) return callback(null, [])

          count = nonvirts.length
          let arr = []
          nonvirts.forEach(name => objectify(path.join(classNetPath, name), (err, object) => {
            if (!err) arr.push(Object.assign({ name }, object))
            if (!--count) callback(null, arr)
          }))
        }
      }))
    }
  }))
})
