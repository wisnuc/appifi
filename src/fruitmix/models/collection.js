import fs from 'fs'
import Promise from 'bluebird'
import mkdirp from 'mkdirp'

import { throwBusy, throwOutOfSync, throwInvalid, throwError } from '../util/throw'

Promise.promisifyAll(fs)

class Collection {
  
  constructor(filepath, tmpfolder, list) {
    this.filepath = filepath
    this.tmpfolder = tmpfolder
    this.list = list              // this is treated as immutable
    this.locked = false
  }

  /**
    throw EBUSY if locked
    throw EOUTOFSYNC if list is outdated

    since list is treated as immutable, newlist should be different from list
  **/
  async updateAsync(list, newlist, isAddUser) {

    if (this.locked) throwBusy()
    if (list !== this.list) throwOutOfSync()
    this.locked = true

    try {
      let tmpSubFolder = await fs.mkdtempAsync(this.tmpfolder)
      let tmpfile = `${tmpSubFolder}/tmpfile`
      let json = JSON.stringify(newlist, null, '  ')
      await fs.writeFileAsync(tmpfile, json)
      if (!isAddUser){
        await fs.renameAsync(tmpfile, this.filepath)
        fs.rmdir(tmpSubFolder, () => {})  // it doesn't matter if this fails 
        this.locked = false
        this.list = newlist
      }
    }
    catch (e) {
      this.locked = false
      throw e
    }
  } 
}

const openOrCreateCollectionAsync = async (filepath, tmpfolder) => {

  try {
    let data = await fs.readFileAsync(filepath)
    let list = JSON.parse(data.toString())
    if (!Array.isArray(list)) throwError('not an array')
    return new Collection(filepath, tmpfolder, list)
  }
  catch (e) {
    if (e.code !== 'ENOENT') throw e
    return new Collection(filepath, tmpfolder, [])
  }   
}

export { openOrCreateCollectionAsync }

const impromptu = async () => {

  await Promise.promisify(mkdirp)('tmptest')
  let list = await openOrCreateCollectionAsync('tmptest/userlist.json', 'tmptest')
  let l1 = list.list
  let l2 = [...l1, { joe: 'jane' }]
  await list.updateAsync(l1, l2)
  return l2
}

// impromptu().then(l => console.log(l)).catch(e => console.log(e))
