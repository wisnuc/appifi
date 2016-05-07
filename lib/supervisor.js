const fs = require('fs')
const child = require('child_process')

const request = require('superagent')

const udevInfo = require('./udevInfoAsync')
const probeMounts = require('./procMountsAsync')
const probeSwaps = require('./procSwapsAsync')
const probeVolumes = require('./btrfsfishowAsync')
const probeUsage = require('./btrfsusageAsync')

const dockerPidFile = '/run/wisnuc/app/docker.pid'
const dockerVolumesDir = '/run/wisnuc/volumes'
const configFilePath = '/etc/wisnuc.json'

const configDefault = { lastUsedVolume: null }

let config = configDefault

class InvalidError extends Error {

  constructor(message) {
    super(message)
    this.message = message
    this.name = 'InvalidError'
  }
}

class OperationFailError extends Error {

  constructor(message) {
    super(message)
    this.message = message
    this.name = 'OperationFailError'
  }
}

async function delay(duration) {

  return  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

async function readConfig() {

  return new Promise((resolve, reject) => {
  
    fs.readFile(configFilePath, (err, data) => {

      let conf = configDefault
      if (err)
        resolve(conf)
      else {
        try {
          conf = JSON.parse(data.toString())
        }
        catch (e) {
          conf = configDefault
        }
        resolve(conf)
      }
    })
  })
}

async function saveConfig(config) {

  return new Promise((resolve, reject) => {
    fs.writeFile(configFilePath, JSON.stringify(config, null, '  '), (err) => {
      if (err) console.log(err)
      resolve()
    }) 
  })  
}

async function daemonPid() {

  return new Promise((resolve, reject) => 
    fs.readFile(dockerPidFile, 'utf8', (err, data) => 
      err ? resolve(0) : resolve(parseInt(data.toString()))))
}

async function daemonInfo() {

  return new Promise((resolve, reject) => 
    request.get('http://127.0.0.1:1688/info')
      .set('Accept', 'application/json')
      .end((err, res) => err ? resolve(err) : resolve(res.body)))
}

async function probeDaemon() {

  let r = await Promise.all([daemonPid(), daemonInfo()])
  return {pid: r[0], info: r[1]}
}

async function probeDaemon2() {

  return await new Promise((resolve, reject) => {
    child.exec(`ps aux | grep docker | grep "docker daemon"`, (err, stdout, stderr) => {

      /** the assumption is only one instance of daemon now **/
      let cmdline = toLines(stdout).find(line => {
      /*  [ 'root', '12670', '0.0', '1.9', '555028', '39444', '?', 'Ssl', 'May03', '0:25', 'docker', 'daemon', // 12 total
            '--exec-root="/run/wisnuc/volumes/da2ba49b-1d16-4f6e-8005-bfaedd110814/root"', 
            '--graph="/run/wisnuc/volumes/da2ba49b-1d16-4f6e-8005-bfaedd110814/graph"',
            '--host="127.0.0.1:1688"',
            '--pidfile="/run/wisnuc/app/docker.pid"' ] */
        // console.log(line)
        let p = line.split(/\s+/)
        // console.log(p)
        if (p.length = 16 &&
            p[10] === 'docker' && 
            p[11] === 'daemon' &&
            p[12].startsWith('--exec-root="/run/wisnuc/volumes/') && 
            p[12].endsWith('/root"') &&
            p[13].startsWith('--graph="/run/wisnuc/volumes/') &&
            p[13].endsWith('/graph"') &&
            p[14] === '--host="127.0.0.1:1688"' &&
            p[15] === '--pidfile="/run/wisnuc/app/docker.pid"') return true
        return false
      })

      if (!cmdline) return resolve({running: false})
      let p = cmdline.split(/\s+/)
      let pid = parseInt(p[1])
      let pp = p[12].split(/\//)
      let volume = pp[pp.length - 2]
      resolve({running: true, pid, volume})
    })
  }) 
}

// probeDaemon2().then(r => console.log(r)).catch(e => console.log(e))

async function daemonStart(uuid) {
/*
  let x = await daemonPid()
  if (x) {
    console.log(`docker daemon already started as pid ${x}`)
    return
  }
*/

  let d = probeDaemon2()
  if (d.running) {
    console.log(`docker daemon already started as pid ${d.pid}`)
  }

  await new Promise((resolve, reject) => {
    child.exec(`mkdir -p /run/wisnuc/app`, (err, stdout, stderr) => {
      err ? reject(stderr) : resolve(stdout)
    })
  })

  let out = fs.openSync('/dev/null', 'w')
  let err = fs.openSync('/dev/null', 'w')
  let mountpoint = `${dockerVolumesDir}/${uuid}`
  let opts = {
    cwd: mountpoint,
  //  detached: true, 
  //  stdio: ['ignore', out, err]
  }
 
  let args = [
    `daemon`, 
    `--exec-root="${mountpoint}/root"`, 
    `--graph="${mountpoint}/graph"`, 
    `--host="127.0.0.1:1688"`,  
    `--pidfile="${dockerPidFile}"`
  ]

  let daemon = child.spawn('docker', args, opts)
  console.log(`docker daemon started as ${daemon.pid}`)

  daemon.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  daemon.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
  });

  daemon.on('exit', (code, signal) => {
    daemon = null
    if (code) console.log(`daemon exits with exitcode ${code}`)
    if (signal) console.log(`daemon exits with signal ${signal}`)
  })
}

async function daemonStop() {

  let x = await daemonPid()
  if (x) process.kill(x)
}

async function daemonStopAndReboot() {

  
}

function toLines(output) { 
  return output.toString().split(/\n/).filter(l => l.length).map(l => l.trim())
}

async function portsPaths() {
  return new Promise((resolve, reject) => 
    child.exec('find /sys/class/ata_port -type l', (err, stdout, stderr) =>
      err ? reject(err) : resolve(toLines(stdout)))
  )
}

async function probePorts() {
  let paths = await portsPaths()
  return udevInfo(paths)
}

async function blockPaths() {
  return new Promise((resolve, reject) =>
    child.exec('find /sys/class/block -type l', (err, stdout, stderr) => 
      err ? reject(err) : resolve(toLines(stdout))))
}

async function probeBlocks() {
  let paths = await blockPaths()
  paths = paths.filter(p => p.startsWith('/sys/class/block/sd'))
  return udevInfo(paths)
}

function volumeMount(volume, mounts) {
  return mounts.find((mnt) => volume.devices.find((dev) => dev.path === mnt.device))
}

function blockVolume(block, volumes) {
  return volumes.find((vol) => vol.devices.find((dev) => dev.path === block.props.devname))
}

function blockMount(block, volumes, mounts) {

  let volume = blockVolume(block, volumes)
  return (volume) ? volumeMount(volume, mounts) :
    mounts.find((mnt) => mnt.device === block.props.devname)
}

function blockPartitions(block, blocks) {

  return blocks.filter((blk) => {
    blk.props.devtype === 'partition' &&
    blk.sysfsProps[1].path === block.props.devpath
  })
}

async function probeStorage(storage) {

  let result = await Promise.all([probePorts(), probeBlocks(), probeVolumes(), probeMounts(), probeSwaps()])
  return {
    ports: result[0],
    blocks: result[1],
    volumes: result[2],
    mounts: result[3],
    swaps: result[4]
  }
}

async function execAnyway(cmd) {

  let debug = false
  return new Promise((resolve, reject) => 
    child.exec(cmd, (err, stdout, stderr) => {
      debug && console.log('---- execAnyway')
      debug && console.log({cmd, err, stdout, stderr})
      resolve({cmd, err, stdout, stderr})
    })
  )
}

async function mountVolumeAnyway(uuid, mountpoint, opts) {

  await execAnyway(`mkdir -p ${mountpoint}`)
  if (opts)
    execAnyway(`mount -t btrfs -o {opts} UUID=${uuid} ${mountpoint}`)
  else
    execAnyway(`mount -t btrfs UUID=${uuid} ${mountpoint}`)
}

function uuidToMountpoint(uuid) {
  return '/run/wisnuc/volumes/' + uuid
}

async function mountVolumesAnyway(volumes, mounts) {
  
  let unmounted = volumes.filter(vol => volumeMount(vol, mounts) === undefined)
  let tasks = unmounted.map(vol => mountVolumeAnyway(vol.uuid, uuidToMountpoint(vol.uuid), vol.missing ? 'degraded,ro' : null))
  await Promise.all(tasks)
}

async function probeUsages(mounts) {

  let filtered = mounts.filter(mnt => mnt.fs_type === 'btrfs' && mnt.mountpoint.startsWith('/run/wisnuc/volumes/') && !mnt.mountpoint.endsWith('/graph/btrfs'))

  return await Promise.all(filtered.map(mnt => probeUsage(mnt.mountpoint)))
}

async function probeStorageWithUsages() {

  let storage = await probeStorage()
  await mountVolumesAnyway(storage.volumes, storage.mounts)
  let mounts = await probeMounts()
  let usages = await probeUsages(mounts)
  return Object.assign({}, storage, {mounts, usages})
}

async function probeSystem() {

  let storage = await probeStorage()
  await mountVolumesAnyway(storage.volumes, storage.mounts)
  let mounts = await probeMounts()
  let usages = await probeUsages(mounts)
  let daemon = await probeDaemon2()
  return Object.assign({}, storage, {mounts, usages, daemon})
}

/*
 *  if disk not ata fail
 *  if disk belongs to docker volume, fail (user must delete docker volume first)
 *  if disk belongs to non-docker volume, and the volume is rootfs, fail
 *  if disk belongs to rootfs, fail
 * 
 *  umount volumes containing disk, if fail, fail
 *  umount non volume disks, if fail, fail
 *  
 *  mkfs.btrfs, if fail, fail
 *  
 */
async function createVolume(blknames, opts) {

  let result, debug = true
  if (!blknames.length) throw new InvalidError('device names empty')

  // undupe
  blknames = blknames.filter((blkname, index, self) => index === self.indexOf(blkname))

  debug && console.log('---- blknames')
  debug && console.log(blknames)

  // probe storage
  let storage = await probeStorage()
  let daemon = await probeDaemon2()

  // validate
  blknamesValidation(blknames, storage.blocks, storage.volumes, storage.mounts, storage.swaps, daemon)

  // find mounted mountpoints
  let mps = blknamesMounted(blknames, storage.blocks, storage.volumes, storage.mounts)
  debug && console.log('---- blknames mounted:')
  debug && console.log(mps)

  // umount mounted
  await Promise.all(mps.map(mp => new Promise((resolve, reject) => {
    child.exec(`umount ${mp}`, (err, stdout, stderr) => 
      err ? reject(err) : resolve(stdout))
  })))
  debug && console.log('---- unmount mounted blknames successfully')


  let stdout = await new Promise((resolve, reject) => {
    child.exec(`mkfs.btrfs -f ${blknames.join(' ')}`, (err, stdout, stderr) => {
      err ? reject(err) : resolve(stdout)
    })   
  })
  debug && console.log('---- mkfs.btrfs successfully')

  storage = await probeStorageWithUsages()
  return storage.volumes.find(vol => 
    (vol.devices.length === blknames.length) &&
      vol.devices.every(dev => blknames.find(bn => bn === dev.path)))  
 
  /////////////////////////////////////////////////////////////////////////////

  function blknamesValidation(blknames, blocks, volumes, mounts, swaps, daemon) {

    blknames.forEach((blkname) => {

      // find corresponding block (object)
      let block = blocks.find((blk) => blk.props.devname === blkname)

      if (!block) throw new InvalidError(blkname + ' not found')
      if (block.props.devtype !== 'disk') throw new InvalidError(blkname + ' is not a disk')
      if (block.props.id_bus !== 'ata') throw new InvalidError(blkname + ' is not ata disk')

      // check if the block belongs to a volume
      let volume = blockVolume(block, volumes)
      if (volume) {
        if (daemon.running && daemon.volume === volume.uuid) throw new InvalidError(`${blkname} is a device of running app engine volume, stop app engine before proceeding`)
        let mnt = volumeMount(volume, mounts)
        if (mnt && mnt.mountpoint === '/') throw new InvalidError(`${blkname} is a device of system volume`)
      }
      else {                      
        let parts = blockPartitions(block, blocks)
        parts.forEach(part => {
          let mnt = blockMount(part, volumes, mounts)
          if (mnt && mnt.mountpoint === '/')  throw new InvalidError(`${blkname} contains root partition ${part.devname}`)
          if (swaps.find(swap => swap.filename === part.devname)) throw new InvalidError(`${blkname} contains swap partition ${part.devname}`)
        })
      }
    })    
  }

  function blknamesMounted(blknames, blocks, volumes, mounts, swaps) {

    let mountpoints = []
    blknames.forEach((blkname) => {

      let block = blocks.find((blk) => blk.props.devname === blkname)
      let volume = blockVolume(block, volumes)
      if (volume) {
        let mnt = volumeMount(volume, mounts)
        if (mnt) mountpoints.push(mnt.mountpoint)
      }
      else {                      
        let parts = blockPartitions(block, blocks)
        parts.forEach(part => {
          let mnt = blockMount(part, volumes, mounts)
          if (mnt) mountpoints.push(mnt.mountpoint)
        })
      }
    })    
    return mountpoints.filter((mp, pos, self) => self.indexOf(mp) === pos) 
  }
}

/*
 * init
 * 
 * 1. read config
 * 2. probe everything
 * 3. if last set does not exist, do nothing (not set)
 * 4. if last set exists but no correspoding volume, do nothing (volume missing)
 * 5. if last set exists but corresponding volume missing, do nothing (volume incomplete)
 * 6. if last set exists and corresponding volume OK, start docker with the volume (volume complete)
 */
async function init() {

  config = await readConfig()
  let storage = await probeStorageWithUsages()
  let daemon = await probeDaemon2()

  // test already started? 
  if (daemon.running) {
    if (config.lastUsedVolume !== daemon.volume) {
      config.lastUsedVolume = daemon.volume
      await saveConfig()
      return
    }
  }

  if (!config.lastUsedVolume) {
    console.log('docker volume uuid not set')
    return
  }

  let volume = storage.volumes.find(vol => vol.uuid === config.lastUsedVolume)
  if (!volume) {
    console.log(`last used app engine volume (${config.lastUsedVolume}) not found`)
    return
  }

  if (volume.missing) {
    console.log(`last used app engine volume (${config.lastUsedVolume}) has missing drive`)
    console.log(JSON.stringify(volume, null, '  '))
    return
  }

  await daemonStart(volume.uuid)
}

init().then(r => console.log('supervisor inited')).catch(e => console.log(e))

async function daemonStartOperation(uuid) {

  let system = await probeSystem()
  let { daemon } = system

  if (daemon.running) {
    return system    
  }

  let volume = system.volumes.find(vol => vol.uuid === uuid)
  if (!volume || volume.missing) {
    return system
  }

  await daemonStart(volume.uuid)
}

async function daemonStopOperation() {

  let system = await probeSystem()
  let { daemon } = system

  if (!daemon.running) return

  process.kill(daemon.pid)

  // at least 800ms on virtualbox, maybe much longer on nuc or nas
  await delay(800)
}

async function testOperation() {

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('test operation timeout (deliberately)')
      resolve('hello')
    }, 3000)
  })
}

async function operation(req) {

  let f, args 
  if (req && req.operation) { 
    console.log(':: operation')
    console.log(req)

    args = (req.args && Array.isArray(req.args)) ? req.args : []
 
    switch (req.operation) {
      case 'test':
        f = testOperation
        break
      case 'daemonStart': 
        f = daemonStartOperation 
        break
      case 'daemonStop': 
        f = daemonStopOperation
        break
      default:
        break 
    }    
  }

  if (f) await f(...args)    
  return await probeSystem()
}

module.exports = (req, callback) => 
  operation(req)
    .then(r => callback(null, r))
    .catch(e => { 
      console.log(':: Operation Error')
      console.log(e)
      callback(e) 
    }) 


// probePorts().then(r => console.log(r))
// probeBlocks().then(r => console.log(r))
// probeMounts().then(r => console.log(r))
// probeSwaps().then(r => console.log(r))
// probeStorage().then(r => console.log(r))
// probeStorageWithUsages().then(r => console.log(r)).catch(e => console.log(e))
// createVolume(['/dev/sdb', '/dev/sdc']).then(r => console.log(r)).catch(e => e ? console.log(e) : null)

/* 
const blockMethods = {

  isDisk: function() {
    return this.props.devtype === 'disk'
  },

  isPartition: function() {
    return this.props.devtype === 'partition'
  },

  isBtrfsDisk: function() {
    return this.props.devtype === 'disk' && this.id_fs_usage === 'filesystem' && id_fs_type === 'btrfs'
  },

  isExt4Partition: function() {
    return  this.props.devtype === 'partition' &&
            this.props.id_fs_usage === 'filesystem' &&
            this.props.id_fs_type === 'ext4'
  },

  isSwapPartition: function() {
    return  this.props.devtype === 'partition' &&
            this.props.id_fs_usage === 'swap' &&
            this.id_fs_usage === 'other'
  },

  isFatPartition: function() {
    return  this.props.devtype === 'partition' &&
            this.props.id_fs_usage === 'filesystem' &&
            this.props.id_fs_type === 'vfat'
  },

  isMountablePartition: function() {
    return this.isFatPartition() || this.isExt4Partition()
  },
}
*/


