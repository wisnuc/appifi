import path from 'path'
import clone from 'clone'
import Debug from 'debug'
import { initFruitmix, probeFruitmix } from '../fruitmix/tools'

const debug = Debug('system:adapter')

//
// input: storage, stated
// output: { port, blocks, volumes }
//
const adaptStorage = storage => {

  // adapt ports
  let ports = storage.ports.map(port => ({
    path: port.path,
    subsystem: port.props.subsystem
  }))

  // add name, devname, path, removable and size, merged into stats
  let blocks 
  blocks = storage.blocks.map(blk => Object.assign({
    name: blk.name,
    devname: blk.props.devname,
    path: blk.path,
    removable: blk.sysfsProps[0].attrs.removable === "1",
    size: parseInt(blk.sysfsProps[0].attrs.size)
  }, blk.stats))

  // process volumes
  let volumes = storage.volumes.map(vol => { 

    // find usage for this volume
    let usage = storage.usages.find(usg => usg.mountpoint === vol.stats.mountpoint)

    // this is possible if volume mount failed, which is observed on at least one machine
    if (!usage) {

      let mapped = Object.assign({}, vol, vol.stats) // without usage
      delete mapped.stats

      mapped.devices = vol.devices.map(dev => {
        name: path.basename(dev.path), // tricky
        path: dev.path,
        id: dev.id,
        used: dev.used,
      })

      return mapped
    }

    // copy level 1 props
    let copy = {
      overall: usage.overall,
      system: usage.system,
      metadata: usage.metadata,
      data: usage.data,
      unallocated: usage.unallocated
    }

    // copy volume object, merge stats and usage
    let mapped = Object.assign({}, vol, vol.stats, { usage: copy })
    delete mapped.stats

    // copy level 2 (usage for each volume device) into devices
    mapped.devices = vol.devices.map(dev => {

      let devUsage = usage.devices.find(ud => ud.name === dev.path)
      return {
        name: path.basename(dev.path), // tricky
        path: dev.path,
        id: dev.id,
        used: dev.used,
        size: devUsage.size,
        unallocated: devUsage.unallocated,
        system: devUsage.system,
        metadata: devUsage.metadata,
        data: devUsage.data
      }
    })
    
    return mapped
  })

  return { ports, blocks, volumes }
}

const probeFruitmixAsync = Promise.promisify(probeFruitmix)

const probeAllFruitmixesAsync = async storage => {

  let mps = [] 
  let copy = clone(storage)

  copy.volumes.forEach(vol => {
    if (vol.isMounted && !vol.isMissing) mps.push({
      ref: vol,
      mp: vol.mountpoint
    })
  })

  // only ext4 probed
  copy.blocks.forEach(blk => {
    if (!blk.isVolumeDevice && blk.isMounted && blk.isExt4)
      mps.push({
        ref: blk,
        mp: blk.mountpoint
      })
  })

  debug('probe all, mps', mps)

  await Promise
    .map(mps, obj => probeFruitmixAsync(obj.mp).reflect())
    .each((inspection, index) => {
      if (inspection.isFulfilled())
        mps[index].ref.wisnuc = inspection.value() 
      else {
        debug('probe fruitmix failed', inspection.reason())
        mps[index].ref.wisnuc = 'ERROR'
      }
    })

  debug('copy', copy)
  return copy
}

const probeAllFruitmixes = (storage, callback) => 
  probeAllFruitmixesAsync(storage).asCallback(callback)

export { adaptStorage, initFruitmix, probeFruitmix, probeAllFruitmixes, probeAllFruitmixesAsync }

