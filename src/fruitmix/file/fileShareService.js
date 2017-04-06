import { isUUID, complement, validateProps } from '../lib/types'
import E from '../lib/error'
import { createFileShareDoc, updateFileShareDoc } from './fileShareDoc'


class FileShareService {

  constructor(fileData, fileShareData) {
    this.fileData = fileData
    this.fileShareData = fileShareData
  }

  async load() {
    await this.fileShareData.load()
  }

  async createFileShare(userUUID, post) {
    if(!isUUID(userUUID)) throw new E.EINVAL()
    if(typeof post !== 'object' || post === null) throw new E.EINVAL()

    validateProps(post, ['writelist', 'readlist', 'collection'])

    let {writelist, readlist, collection} = post

    // collection format and share permisiion check
    if(!Array.isArray(collection)) throw new E.EINVAL()
    if(!collection.length) throw new E.EINVAL()
    if(!collection.every(isUUID)) throw new E.EINVAL()
    if(!collection.every(uuid => {
      let drive = this.fileData.findNodeByUUID(uuid).getDrive()
      if(drive.type === 'private') return userUUID === drive.owner
      else return drive.shareAllowed && [...drive.writelist, ...drive.readlist].includes(userUUID)
    }))
      throw new E.EACCESS()

    // writelist format check
    if(!Array.isArray(writelist)) throw new E.EINVAL()
    if(!writelist.every(isUUID))throw new  E.EINVAL()

    // readlist format check
    if(!Array.isArray(readlist)) throw new E.EINVAL()
    if(!readlist.every(isUUID)) throw new  E.EINVAL()

    let doc = createFileShareDoc(this.fileData, userUUID, post)
    return await this.fileShareData.createFileShare(doc)
  }

  async updateFileShare(userUUID, shareUUID, patch) {
    if(!isUUID(userUUID)) throw new E.EINVAL()
    if(!isUUID(shareUUID)) throw new E.EINVAL()

    let share = this.getFileShareByUUID(shareUUID)
    if(share.doc.author !== userUUID) throw new E.EACCESS()
    
    if(!Array.isArray(patch)) throw new E.EINVAL()
    patch.forEach(op => {
      if(typeof op !== 'object') throw new E.EINVAL()

      validateProps(op, ['path', 'operation', 'value'])

      if(complement([op.path], ['writelist', 'readlist', 'collection']).length !== 0)
        throw new E.EINVAL()
      if(op.operation !== 'add' && op.operation !== 'delete')
        throw new E.EINVAL()

      if(!Array.isArray(op.value)) throw new E.EINVAL()
      if(!op.value.every(isUUID)) throw new E.EINVAL()

      if(op.path === 'collection') {
        if(!op.value.every(uuid => {
          let drive = this.fileData.findNodeByUUID(uuid).getDrive()
          if(drive.type === 'private') return userUUID === drive.owner
        else return drive.shareAllowed && [...drive.writelist, ...drive.readlist].includes(userUUID)
        }))
          throw new E.EACCESS()
      }      
    })

    let newDoc = updateFileShareDoc(this.fileData, share.doc, patch)
    return await this.fileShareData.updateFileShare(newDoc)
  }

  async deleteFileShare(userUUID, shareUUID) {
    if(!isUUID(userUUID)) throw new E.EINVAL()
    if(!isUUID(shareUUID)) throw new E.EINVAL()

    let share = this.getFileShareByUUID(shareUUID)
    if(share.doc.author !== userUUID) throw new E.EACCESS()

    await this.fileShareData.deleteMediaShare(shareUUID)
  }

  getFileShareByUUID(shareUUID) {
    if(!isUUID(shareUUID)) throw new E.EINVAL()
    let share = this.fileShareData.findShareByUUID(shareUUID)
    if(share) return share
    else throw new E.ENOENT()
  }

  async getUserFileShares(userUUID) {
    if(!isUUID(userUUID)) throw new E.EINVAL()
    return await this.fileShareData.getUserFileShares(userUUID)
  }

  register(ipc) {
    ipc.register('getUserFileShares', (args, callback) => 
      this.getUserFileShare(args.userUUID).asCallback(callback))
    
    ipc.register('createFileShare', (args, callback) => 
      this.createFileShare(args.userUUID, args.post).asCallback(callback))

    ipc.register('updateFileShare', (args, callback) => 
      this.updateFileShare(args.userUUID, args.shareUUID, args.patch).asCallback(callback))

    ipc.register('deleteFileShare', (args, callback) => 
      this.deleteFileShare(args.userUUID, args.shareUUID).asCallback(callback))
  }
}

const createFileShareService = (fileData, fileShareData) => {
  return new FileShareService(fileData, fileShareData)
}

export { createFileShareService }


