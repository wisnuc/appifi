import path from 'path'
import express from 'express'

import { storeState } from '../appifi/lib/reducers' 

import Debug from 'debug'
const debug = Debug('system:mir')

const router = express.Router()

const detectWisnuc = async (blocks, volumes) => {

  // mounted, non volume blocks with filesystem, may be disk or partition
  let blks = blocks.filter(blk => blk.isFileSystem && !blk.isVolume && blk.isMounted)

  // mounted, non missing volumes 
  let vols = volumes.filter(vol => !vol.missing && vol.isMounted)

  // mfs: mounted file system, including volume and block
  await Promise.map([...blks, ...vols], Promise.promisify(mfs, callback => 
    fs.stat(path.join(mfs.mountpoint, 'wisnuc'), (err, stats) => {
      if (!err && stats.isDirectory()) mfs.hasWisnuc = true
      callback()
    })))
}

router.get('/', (req, res) => {

  let storage = storeState().storage
  if (!storage)
    return res.status(500).end()

  let ports = storage.ports.map(port => ({
    path: port.path,
    subsystem: port.props.subsystem
  }))

  let blocks = storage.blocks.map(blk => Object.assign({
    name: blk.name,
    devname: blk.props.devname,
    path: blk.path,
    removable: blk.sysfsProps[0].attrs.removable === "1",
    size: parseInt(blk.sysfsProps[0].attrs.size)
  }, blk.stats))

  let usages = storage.usages

  let volumes = storage.volumes.map(vol => { 

    let usage = usages.find(usg => usg.mountpoint === vol.stats.mountpoint)
    if (usage) delete usage.mountpoint

    let mapped = Object.assign({}, vol, vol.stats, { usage })
    delete mapped.stats

    mapped.devices = vol.devices.map(dev => ({
      name: path.basename(dev.path),
      devname: dev.path,
      id: dev.id,
      size: dev.size,
      used: dev.used 
    }))
    
    return mapped
  })

  detectWisnuc(blocks,volumes).asCallback(() => {

    let ret = Object.assign({}, storage, { ports, blocks, volumes }) 
    delete ret.mounts
    delete ret.swaps
    delete ret.usages

    debug('mapped storage with wisnuc detection', ret)

    res.status(200).json(ret)
  })
})

/**

  target: ['sda'],  // if mkfs is NOT provided, which means starts from existing disk
                    // target must be single file system
                    // this can be either 1 block name or 1 uuid representing a btrfs volume
                    // for wisnuc device, 1 btrfs volume uuid is required
                    // for non-wisnuc device, 1 block name is also OK but the filesystem must be either ext4, or ntfs

                    // if mkfs IS provided, which means creating new filesystem
                    // this must 1 to N non-duplicated block names
                    // for wisnuc device, mkfs.type must be 'btrfs' and all blocks must be ATA disk
                    // for non-wisnuc device
                    //  if mkfs.type is btrfs, all blocks must be disk, either ATA/SCSI or USB
                    //  if mkfs.type is ext4, only one block is allowed, can be either ATA/SCSI or USB disk, or partition
                    //  if mkfs.type is ntfs, only one block is allowed, can be either ATA/SCSI or USB disk, or partition

  mkfs: {           
    type: 'btrfs'
  }

  init: {           // this must be provided if mkfs is provided
    username:       // if mkfs is NOT provided (starting from existing disk), if init is provided, the /wisnuc folder will be erased and re-created.
    password:
  }

**/
router.post('/', (req, res) => {

  const mir = req.body 

  

})

export default router

