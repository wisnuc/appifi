import { isUUID, complement, validateProps } from '../lib/types'
import E from '../lib/error'
import { createFileShareDoc, updateFileShareDoc } from './fileShareDoc'


class FileShareService {

  constructor(fileData, fileShareData) {
    this.fileData = fileData
    this.fileShareData = fileShareData
  }

  async createFileShare(user, post) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(typeof post !== 'object' || post === null) throw new E.EINVAL()

    validateProps(post, ['writelist', 'readlist', 'collection'])

    let {writelist, readlist, collection} = post

    // collection format and share permisiion check
    if(!Array.isArray(collection)) throw new E.EINVAL()
    if(!collection.length) throw new E.EINVAL()
    if(!collection.every(isUUID)) throw new E.EINVAL()
    if(!collection.every(uuid => {
      let drive = this.fileData.findNodeByUUID(uuid).getDrive()
      if(drive.type === 'private') return user === drive.owner
      else return drive.shareAllowed && [...drive.writelist, ...drive.readlist].includes(user)
    }))
      throw new E.EACCESS()

    // writelist format check
    if(!Array.isArray(writelist)) throw new E.EINVAL()
    if(!writelist.every(isUUID))throw new  E.EINVAL()

    // readlist format check
    if(!Array.isArray(readlist)) throw new E.EINVAL()
    if(!readlist.every(isUUID)) throw new  E.EINVAL()

    let doc = createFileShareDoc(this.fileData, user, post)
    return await this.fileShareData.createFileShare(doc)
  }

  async updateFileShare(user, shareUUID, patch) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(!isUUID(shareUUID)) throw new E.EINVAL()

    let share = this.getFileShare(shareUUID)
    if(share.doc.author !== user) throw new E.EACCESS()
    
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
          if(drive.type === 'private') return user === drive.owner
        else return drive.shareAllowed && [...drive.writelist, ...drive.readlist].includes(user)
        }))
          throw new E.EACCESS()
      }      
    })

    let newDoc = updateFileShareDoc(this.fileData, share.doc, patch)
    return await this.fileShareData.updateFileShare(newDoc)
  }

  async deleteFileShare(user, shareUUID) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(!isUUID(shareUUID)) throw new E.EINVAL()

    let share = this.getFileShare(shareUUID)
    if(share.doc.author !== user) throw new E.EACCESS()

    await this.fileShareData.deleteMediaShare(shareUUID)
  }

  getFileShare(shareUUID) {
    if(!isUUID(shareUUID)) throw new E.EINVAL()
    let share = this.fileShareData.findShareByUUID(shareUUID)
    if(share) return share
    else throw new E.ENOENT()
  }

  register(ipc) {
    ipc.register('getFileShare', (args, callback) => 
      this.getFileShare(args.shareUUID).asCallback(callback))
    
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


