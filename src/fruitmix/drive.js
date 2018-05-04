const forbidden = e => Object.assign(e, { code: 'EFORBIDDEN', status: 403 })
const notFound = e => Object.assign(e, { code: 'ENOTFOUND', status: 404 })

/**
Fruitmix Drive API

@mixin
*/
const driveapi = {

  /**
  @callback driveapi~getDriveListCallback
  @param {error} err
  @param {Drive[]} list
  */

  /**
  Returns a list of drives that the given user can read the drive metadata.

  @param {object} user
  @param {driveapi~getDriveListCallback} callback 
  */
  getDriveList2 (user, callback) {
    let list = this.driveList.drives.filter(drv => this.userCanReadDriveMetadata(user, drv))
    process.nextTick(() => callback(null, list))
  },

  /**
  Returns the created drive

  @param {object} user
  @param {object} props
  @param {function} callback - `(err, drive) => {}` where `drive` is a drive object.
  @todo vfs has no callback function 
  */
  createDrive (user, props, callback) {
    if (!user.isAdmin) {
      process.nextTick(() => callback(forbidden(new Error('Only admin can create drive'))))
    }

    // this.driveList.createPublicDriveAsync
  }
}

/**
A uuid string (version 4, random)

@typedef {string} UUID
*/

/**
@typedef {Object} PublicDrive
@prop {UUID} uuid - drive uuid
@prop {'public'} type
@prop {UUID[] | '*'} writelist 
@prop {UUID[] | '*'} readlist - not used, read-only
*/

/**
@typedef {Object} PrivateDrive
@prop {UUID} uuid - drive uuid
@prop {'private'} type
@prop {UUID} owner - user uuid
*/

/**
@typedef {PrivateDrive | PublicDrive} Drive
*/

module.exports = driveapi
