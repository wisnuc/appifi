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
      let rootnode = this.fileData.findNodeByUUID(uuid).root()
      if(rootnode.type === 'private') return user === rootnode.owner
      else return rootnode.shareAllowed && [...rootnode.writelist, ...rootnode.readlist].includes(user)
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

    let share = this.fileShareData.findShareByUUID(shareUUID)
    if(!share) throw new E.ENOENT()
    if(share.doc.author !== user) throw new E.EACCESS()
    
    if(!Array.isArray(patch)) throw new E.EINVAL()
    patch.forEach(op => {
      if(typeof op !== 'object') throw new E.EINVAL()

      validateProps(op, ['path', 'operation', 'value'])

      if(complement([op.path], ['writelist', 'readlist', 'collection']).length !== 0)
        throw new E.EINVAL()
      if(op.operation !== 'add' && op.operation !== 'delete'){
        throw new E.EINVAL()
      }
      if(!Array.isArray(op.value)) throw new E.EINVAL()
      if(!op.value.every(isUUID)) throw new E.EINVAL()

      if(op.path === 'collection') {
        if(!op.value.every(uuid => {
          let rootnode = this.fileData.findNodeByUUID(uuid).root()
          if(rootnode.type === 'private') return user === rootnode.owner
          else {
            return rootnode.shareAllowed && [...rootnode.writelist, ...rootnode.readlist].includes(user)
          }
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

    let share = this.fileShareData.findShareByUUID(shareUUID)
    if(!share) throw new E.ENOENT()
    if(share.doc.author !== user) throw new E.EACCESS()

    await this.fileShareData.deleteMediaShare(shareUUID)
  }

  async load() {
    console.log('fileShareService pretends to be loaded')
  }
}

const createFileShareService = (fileData, fileShareData) => {
  return new FileShareService(fileData, fileShareData)
}

export { createFileShareService }


