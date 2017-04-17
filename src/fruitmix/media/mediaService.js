import E from '../lib/error'

module.exports = class MediaService {

  constructor(model, fileData, fileShareData, mediaData, mediaShareData) {

    this.model = model
    this.fileData = fileData
    this.fileShareData = fileShareData
    this.mediaData = mediaData
    this.mediaShareData = mediaShareData
  } 

  async getMeta(userUUID) {
    // userUUID must be local user
    let user = await this.model.isLocalUser(userUUID)
    if (!user) throw E.EACCESS()

    let allMedia = this.mediaData.getAllMedia(userUUID)
    return allMedia
  }

  // need to check authorazation 
  async readMedia({userUUID, digest}) {
    let digestObj = this.mediaData.findMediaByUUID(digest)
    if (!digestObj) throw E.ENOENT()

    let props = this.mediaData.mediumProperties(userUUID, digest)
    if (props.permittedToShare || props.authorizedToRead ||
      props.sharedWithOthers || props.sharedWithMe) {

      let nodes = digestObj.nodes
      if (nodes.length === 0) throw E.ENODENOTFOUND()
      return nodes.namepath()
    } else {
      throw E.ENOENT()
    }
  }

  async getThumbnail({userUUID, digest, query}) {
    
  }
  register(ipc) {
    ipc.register('getMeta', (args, callback) => this.getMeta(args).asCallback(callback))
    ipc.register('readMedia', (args, callback) => this.readMedia(args).asCallback(callback))
  }
}

