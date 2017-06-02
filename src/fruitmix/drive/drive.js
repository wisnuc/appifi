const path = require('path')
const EventEmitter = require('events')
const deepFreeze = require('deep-freeze')

/**
Drive module exports a DriveList Singleton

### Description

#### Change

(user, drive) relationship are maintained in both module in previous version. Now it is solely maintained in drive module.

making drive directory is NOT the responsibility of this module. In another word, drive means drive object and uuid, not underlying file system implementation. file module is responsible for that.

@module
*/

/**

@typedef {Object} PrivateDrive
@prop {string} uuid - drive identity
@prop {string} type - 'private'
@prop {string} owner - user uuid of the owner
*/

/**

relational constraint: 
+ no user in both writelist and realist (intersection is empty set)

@typedef {Object} PublicDrive
@prop {string} uuid - drive identity
@prop {string} type - 'public'
@prop {string[]} writelist - list of distinct users who have write permission
@prop {string[]} readlist - list of distinct users who have read permission
*/

/**
DriveList manages drives, but not their directories on file system
*/
class DriveList extends EventEmitter {

  /**
  Construct an uninitialzied DriveList
  */
  constructor() {
    super()
    this.lock = false
    this.drives = []
    deepFreeze(this.drives)
  }

  async initAsync(fpath, tmpDir) {
    
    try {
      this.drives = JSON.parse(await fs.readFileAsync(fpath))
    }
    catch (e) {
      if (e.code !== 'ENOENT') throw e
      this.drives = []
    }

    deepFreeze(this.drive)
    this.fpath = fpath
    this.tmpDir = tmpDir
  }

  async commitDrivesAsync(currDrives, nextDrives) {
  
    if (currentDrives !== this.drives) throw E.ECOMMITFAIL()
    if (this.lock === true) throw E.ECOMMITFAIL() 

    this.lock = true
    try {
      saveObjectAsync(this.fpath, this.tmpDir, nextDrives)
      this.drives = nextDrives
      deepFreeze(this.drives)
    }
    finally {
      this.lock = false
    }
  }

  async createPrivateDrives(owner) {

    let home = { type: 'private', owner, tag }

    let nextDrives = [...this.drives, drive]
    await this.commitDrivesAsync(this.drives, [...this.drives, drive])
    this.drives = nextDrives
    deepFreeze(this.drives)
    return drive
  }

  async createPublicDrive(opts) {

    let drive = {
      type: 'public',
      writelist: opts.writelist || [],
      readlist: opts.readlist || [], 
    }

    let nextDrives = [...this.drives, drive]
    await this.commitDriveAsync(this.drives, nextDrives)
    this.drives = nextDrives
    deepFreeze(this.drives)
    return drive 
  } 

  async updatePublicDrive(driveUUID, props) {
    
    let drive = this.drives.find(drv => drv.uuid === driveUUID)
    if (!drive) throw new Error('not found')
    if (drive.type === 'private') throw new E.EFORBIDDEN()
    // something  
  }
}

module.exports = new DriveList()

