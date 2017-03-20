

class FileShareService {

  constructor() {
    this.fd = fileData
    this.fsd = fileShareData
  }

  async creatFileShare(user, post) {
    if(!isUUID(user)) throw new E.EINVAL()
    if(typeof post !== 'object' || post === null) throw new E.EINVAL()

    validateProps(post, ['writelist', 'readlist', 'collection'])

    let {writelist, readlist, collection} = post

    // collection format and share permisiion check
    if(!Array.isArray(collection)) throw new E.EINVAL()
    if(!collection.length) throw new E.EINVAL()
    if(!contents.every(isUUID)) throw new E.EINVAL()
    if(!contents.every(uuid => {
      let root = this.fd.uuidMap.get(uuid).root
      if(root.type === 'private') return user === root.ower
      else return root.shareAllowed
    }))
      throw new E.EACCESS()

    // writelist format check
    if(!Array.isArray(writelist)) throw new E.EINVAL()
    if(!writelist.every(isUUID))throw new  E.EINVAL()

    // readlist format check
    if(!Array.isArray(readlist)) throw new E.EINVAL()
    if(!readlist.every(isUUID)) throw new  E.EINVAL()

    let doc = creatFileShareDoc(user, this.fd, post)
    return await this.fsd.creatFileShare(doc)
  }

  async updateFileShare(user, shareUUID, patch) {

  }

  async deleteFileShare(user, shareUUID) {

  }
}


