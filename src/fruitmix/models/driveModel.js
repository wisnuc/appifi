import Promise from 'bluebird'

import validator from 'validator'

import { openOrCreateCollectionAsync } from './collection'

/** 

Schema

{
  label: a string

  fixedOwner: true: only one owner, cannot be changed; false: shared drive

  URI: 'fruitmix', 'appifi', 'peripheral:uuid=', 'peripheral:label=', 
      noticing that the uuid or label are file system uuid or label, not partition uuid or label, 
      the former are stored inside file system, if you reformat the file system, they are changed.
      the latter are GUID partition table uuid, they persists after reformatting the partition. 
      they are only changed when the partition table updated.

  uuid: drive uuid
  owner: []
  writelist: []
  readlist: []

  cache: true or false
}

**/

class DriveModel {

  constructor(collection) {
    this.collection = collection
  }

  // this function requires the uuid to be passed in
  // because the folder should be created before update model database
  createDrive({ 
    label, 
    fixedOwner, 
    URI, 
    uuid, 
    owner,
    writelist, 
    readlist, 
    cache 
  }, callback) {

    let conf = {label, fixedOwner, URI, uuid, owner, writelist, readlist, cache}

    let list = this.collection.list

    // this function returns err or undefined
    this.collection.updateAsync(list, [...list, conf]).asCallback(callback)
  }
}

const createDriveModelAsync = async (filepath, tmpfolder) => {

  let collection = await openOrCreateCollectionAsync(filepath, tmpfolder)
  if (collection) 
    return new DriveModel(collection)
  return null
}

export { createDriveModelAsync }

