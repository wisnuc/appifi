const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const child = require('child_process')

const router = require('express').Router()

const broadcast = require('../common/broadcast')
const barcelona = require('./barcelona')

/**
This module probes the following system information:

+ cpu
+ memory 
+ dmidecode or barcelona equivalent
+ software release revision (github release)
+ source code revision (commit)

These information are probed when system starts and cached. 

@module System
@requires Barcelona
@fires SystemUpdate
*/

/**
Fired when system probe finished during system inits.

@event SystemUpdate
@global
*/

// K combinator
const K = x => y => x

const dminames = [
  'bios-vendor', 'bios-version', 'bios-release-date',
  'system-manufacturer', 'system-product-name',
  'system-version', 'system-serial-number', 'system-uuid',
  'baseboard-manufacturer', 'baseboard-product-name',
  'baseboard-version', 'baseboard-serial-number',
  'baseboard-asset-tag',
  'chassis-manufacturer', 'chassis-type', 'chassis-version',
  'chassis-serial-number', 'chassis-asset-tag',
  'processor-family', 'processor-manufacturer',
  'processor-version', 'processor-frequency'
]

// this function change string format 'processor-family' to js style 'processorFamily'
const camelCase = text => 
  text.split(/[_\- ()]/)
    .map((w, idx) => idx === 0 
      ? w.charAt(0).toLowerCase() + w.slice(1)
      : w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

// parse
const parseSingleSectionOutput = stdout => 
  stdout.toString().split('\n')                                               // split to lines
    .map(l => l.trim()).filter(l => l.length)                                 // trim and remove empty line
    .map(l => l.split(':').map(w => w.trim()))                                // split to word array (kv)
    .filter(arr => arr.length === 2 && arr[0].length)                         // filter out non-kv
    .reduce((obj, arr) => K(obj)(obj[camelCase(arr[0])] = arr[1]), {})        // merge into one object

// parse
const parseMultiSectionOutput = stdout =>
  stdout.toString().split('\n\n')                                             // split to sections
    .map(sect => sect.trim())                                                 // trim
    .filter(sect => sect.length)                                              // remove last empty
    .map(sect => 
      sect.split('\n')                                                        // process each section
        .map(l => l.trim()).filter(l => l.length)                             // trim and remove empty line     
        .map(l => l.split(':').map(w => w.trim()))                            // split to word array (kv)     
        .filter(arr => arr.length === 2 && arr[0].length)                     // filter out non-kv     
        .reduce((obj, arr) => K(obj)(obj[camelCase(arr[0])] = arr[1]), {}))   // merge into one object 


const probeProcAsync = async (path, multi) => {

  let stdout = await child.execAsync(`cat /proc/${path}`)
  return multi 
    ? parseMultiSectionOutput(stdout)  
    : parseSingleSectionOutput(stdout)
}

// return undefined if not barcelona
const probeWS215iAsync = async () => {

  try {
    await fs.statAsync('/proc/BOARD_io')
    let arr = await Promise.all([
      child.execAsync('dd if=/dev/mtd0ro bs=1 skip=1697760 count=11'),
      child.execAsync('dd if=/dev/mtd0ro bs=1 skip=1697664 count=20'),
      child.execAsync('dd if=/dev/mtd0ro bs=1 skip=1660976 count=6 | xxd -p')
    ])
    return {
      serial: arr[0].toString(),
      p2p: arr[1].toString(),
      mac: arr[2].trim().match(/.{2}/g).join(':')
    }
  } catch (e) {}
}

// callback version is much easier than that of async version with bluebird promise reflection
const dmiDecode = cb => {

  let count = dminames.length, dmidecode = {}
  const end = () => (!--count) && cb(null, dmidecode)
  
  dminames.forEach(name => 
    child.exec(`dmidecode -s ${name}`, (err, stdout) => 
      end(!err && stdout.length && 
        (dmidecode[camelCase(name)] = stdout.toString().split('\n')[0].trim()))))
}

// return undefined for barcelona
const dmiDecodeAsync = async () => {
  try {
    await fs.statAsync('/proc/BOARD_io')
    return
  } catch (e) {}

  return await Promise.promisify(dmiDecode)()
}

// return null if not in production deployment
const probeReleaseAsync = async () => {

  if (process.cwd() === '/wisnuc/appifi') {
    try {
      return JSON.parse(await fs.readFileAsync('/wisnuc/appifi/.release.json'))
    } catch(e) {}
  }
  return null
}

// return null if not in production deployment
const probeRevisionAsync = async () => {

  if (process.cwd() === '/wisnuc/appifi') {
    try {
      return (await fs.readFileAsync('/wisnuc/appifi/.revision')).toString().trim()
    } catch (e) {}
  }
  return null
}

let system = null

let promises = [ 
  probeProcAsync('cpuinfo', true),
  probeProcAsync('meminfo', false),
  probeWS215iAsync(),
  dmiDecodeAsync(),
  probeReleaseAsync(),
  probeRevisionAsync() 
]

Promise
  .all(promises)
  .then(arr => {

    system = {
      cpuInfo: arr[0],
      memInfo: arr[1],
      ws215i: arr[2],
      dmidecode: arr[3],
      release: arr[4],
      commit: arr[5]  // for historical reason, this is named commit
    }

    broadcast.emit('SystemUpdate', null, system)
  })

router.get('/', (req, res) => res.status(200).json(system))

module.exports = router

