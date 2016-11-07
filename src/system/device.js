var path = require('path')
var fs = require('fs')
var child = require('child_process')

const dminames = [
  'bios-vendor',
  'bios-version',
  'bios-release-date',
  'system-manufacturer',
  'system-product-name',
  'system-version',
  'system-serial-number',
  'system-uuid',
  'baseboard-manufacturer',
  'baseboard-product-name',
  'baseboard-version',
  'baseboard-serial-number',
  'baseboard-asset-tag',
  'chassis-manufacturer',
  'chassis-type',
  'chassis-version',
  'chassis-serial-number',
  'chassis-asset-tag',
  'processor-family',
  'processor-manufacturer',
  'processor-version',
  'processor-frequency'
]

// this function change string format 'processor-family' to js style 'processorFamily'
const stylize = text => text.split(/[_\- ()]/)
  .map((w, idx) => idx === 0 ? 
    w.charAt(0).toLowerCase() + w.slice(1) : 
    w.charAt(0).toUpperCase() + w.slice(1))
  .join('')

const K = x => y => x

const probeProcfs = (path, cb) =>
  child.exec(`cat /proc/${path}`, (err, stdout) => err ? cb(err) :
    cb(null, stdout.toString().split('\n')        // split to lines
      .map(l => l.trim()).filter(l => l.length)         // trim and remove empty line
      .map(l => l.split(':').map(w => w.trim()))        // split to word array (kv)
      .filter(arr => arr.length === 2 && arr[0].length) // filter out non-kv
      .reduce((obj, arr) => 
        K(obj)(obj[stylize(arr[0])] = arr[1]), {})))    // merge into one object

const probeWs215i = cb => 
  fs.stat('/proc/BOARD_io', err =>
    err ? ((err.code === 'ENOENT') ? cb(null, false) : cb(err)) 
      : cb(null, true))

// only for ws215i
const mtdDecode = cb => {

  let count = 3, serial, p2p, mac
  const end = () => (!--count) && cb(null, { serial, p2p, mac })

  child.exec('dd if=/dev/mtd0ro bs=1 skip=1697760 count=11', (err, stdout) => 
    end(!err && (serial = stdout.toString())))

  child.exec('dd if=/dev/mtd0ro bs=1 skip=1697664 count=20', (err, stdout) => 
    end(!err && (p2p = stdout.toString())))

  child.exec('dd if=/dev/mtd0ro bs=1 skip=1660976 count=6 | xxd -p', (err, stdout) => 
    end(!err && (mac = stdout.trim().match(/.{2}/g).join(':'))))
}

const dmiDecode = cb => {

  let count = dminames.length, dmidecode = {}
  const end = () => (!--count) && cb(null, dmidecode)
  
  dminames.forEach(name => 
    child.exec(`dmidecode -s ${name}`, (err, stdout) => 
      end(!err && stdout.length && 
        (dmidecode[stylize(name)] = stdout.toString().split('\n')[0].trim()))))
}

const systemProbe = cb => 
  probeProcfs('cpuinfo', (err, cpuInfo) => err ? cb(err) :
      probeProcfs('meminfo', (err, memInfo) => err ? cb(err) : 
          probeWs215i((err, isWs215i) => err ? cb(err) : 
            isWs215i ? 
              mtdDecode((err, ws215i) => 
                err ? cb(err) : cb(null, {cpuInfo, memInfo, ws215i})) :
              dmiDecode((err, dmidecode) => 
                err ? cb(err) : cb(null, {cpuInfo, memInfo, dmidecode})))))

export default systemProbe
// systemProbe((err, info) => console.log(err || info))
