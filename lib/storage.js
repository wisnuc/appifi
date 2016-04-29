'use strict'

const fs = require('fs')
const path = require('path')
const child = require('child_process')
const async = require('async')

const udevinfo = require('./udevinfo.js')
const procmounts = require('./procmounts.js')
const btrfsfishow = require('./btrfsfishow.js')
const btrfsUsage = require('./btrfsUsage.js')
const blockPaths = require('./blockPaths.js')

/*
 * task 1: collect path => query udevinfo
 * task 2: procmount => btrfs fi usage & btrfs dev usage
 * task 3: btrfs fi show
 *
 * there is a chance that btrfs fi show information is incomplete:
 *
 * if the drive is online, and then removed
 */
module.exports = (done) => {

  let db = {

    ata_ports : [],
    blocks : [],
    mounts: [],
    volumes: [],
    volumeUsages: [],
  }

  let task1 = (done) => {

    blockPaths((err, paths) => {

      // console.log(err)
      if (err) return done(err, paths)
      udevinfo(paths, (err, sysfsDevs) => {

        if (err) return done(err, sysfsDevs)

        sysfsDevs.forEach(dev => {
          
          let ss = dev.props.subsystem
          if (ss === 'ata_port') {
            db.ata_ports.push(dev)
            dev.blockDevName = null
          }
          else if (ss === 'block') {
            db.blocks.push(dev)
          }
        })

        db.ata_ports.forEach(port => {
          
          let portParent = port.sysfsProps[1]
        
          for (let i = 0; i < db.blocks.length; i++) {
            
            let b = db.blocks[i]
            if (b.path.startsWith(portParent.path)) {
              // found
              port.blockDevName = b.props.devname
              return
            }
          }
        })
      
        done(null, null)
      }) 
    })
  }

  let task2 = (done) => {

    procmounts((err, mounts) => {

      if (err) return done(err, mounts)
      db.mounts = mounts

      let bmnts = mounts.filter(m => m.fs_type === 'btrfs')
      if (bmnts.length === 0) return done(null, null)
    
      async.map(bmnts,
        (m, done) => btrfsUsage(m.mountpoint, (e, r) => done(e, r)), 
        (e, usages) => {
          if (e) done(e, usages)
          db.volumeUsages = usages
          done(null, null)
      })
    })
  }

  let task3 = (done) => btrfsfishow((e, r) => {

    if (e) return done(e, r)
    db.volumes = r
    done(null, null)
  })

  async.parallel([task1, task2, task3], (e, r) => {
  
    if (e) 
      done(e, r)
    else 
      done(null, db)
  })
}








