const Promise = require('bluebird')
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

These information are probed once and cached.

@module System
@requires Broadcast
@requires Barcelona
*/

/**
Fired when system probe finished during system inits.

@event SystemUpdate
@global
*/

/**
K combinator
*/
const K = x => y => x

/**
list of dmidecode names
@const
*/
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

/**
System Information
*/
let system = null

/**
This function change string format 'processor-family' to js style 'processorFamily'
@param {string} text
@returns camelCased strings.
*/
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

/**
Convert proc file system information to JavaScript object

@param {string} path - proc file system path
@param {boolean} multi - if true, treat the output as multiple section
*/
const probeProcAsync = async (path, multi) => {
  let stdout = await child.execAsync(`cat /proc/${path}`)
  return multi
    ? parseMultiSectionOutput(stdout)
    : parseSingleSectionOutput(stdout)
}

/**
Callback versoin of dmidecode
*/
const dmiDecode = cb => {
  let count = dminames.length
  let dmidecode = {}

  const end = () => (!--count) && cb(null, dmidecode)

  dminames.forEach(name =>
    child.exec(`dmidecode -s ${name}`, (err, stdout) =>
      end(!err && stdout.length &&
        (dmidecode[camelCase(name)] = stdout.toString().split('\n')[0].trim()))))
}

/**
Async version of dmidecode, returns undefined for barcelona
*/
const dmiDecodeAsync = async () => barcelona ? undefined : Promise.promisify(dmiDecode)()

/**
Probe .release.json file. Returns null if `cwd` is not `/wisnuc/appifi`
*/
const probeReleaseAsync = async () => {
  if (process.cwd() === '/wisnuc/appifi') {
    try {
      return JSON.parse(await fs.readFileAsync('/wisnuc/appifi/.release.json'))
    } catch (e) {}
  }
  return null
}

/**
Probe .revision file. Returns null if `cwd` is not `/wisnuc/appifi`
*/
const probeRevisionAsync = async () => {
  if (process.cwd() === '/wisnuc/appifi') {
    try {
      return (await fs.readFileAsync('/wisnuc/appifi/.revision')).toString().trim()
    } catch (e) {}
  }
  return null
}

/**
Init module and set `system`

@fires SystemUpdate
*/
const init = () =>
  Promise.all([
    probeProcAsync('cpuinfo', true),
    probeProcAsync('meminfo', false),
    dmiDecodeAsync(),
    probeReleaseAsync(),
    probeRevisionAsync()
  ])
    .then(arr => {
      system = {
        cpuInfo: arr[0],
        memInfo: arr[1],
        ws215i: barcelona ? barcelona.romcodes : undefined,
        dmidecode: arr[2],
        release: arr[3],
        commit: arr[4]  // for historical reason, this is named commit
      }
      broadcast.emit('SystemUpdate', null, system)
    })

router.get('/', (req, res) => res.status(200).json(system))

init()

/**
See API documents.
*/
module.exports = router
