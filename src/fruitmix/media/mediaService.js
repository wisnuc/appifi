import E from '../lib/error'
import Thumb from './thumb'
import config from '../cluster/config'
import path from 'path'
const tb = new Thumb(40)

module.exports = class MediaService {

  constructor(model, fileData, fileShareData, mediaData, mediaShareData) {

    this.model = model
    this.fileData = fileData
    this.fileShareData = fileShareData
    this.mediaData = mediaData
    this.mediaShareData = mediaShareData
  } 

  // determine whether local users
  async isLocalUser(useruuid) {
    // find user by uuid
    let user = this.model.users.find(u => u.uuid === useruuid)
    if (!user) throw new Error('user not found')
    return user.type === 'local'
  }

  findMediaPath(digest) {

    let media = this.mediaData.findMediaByHash(digest)
    if (!media) throw new E.ENOENT()

    let nodes = Array.from(media.nodes)
    for (let n of nodes) {
      return n.abspath()
    }
  }

  async getMeta(userUUID) {
    // userUUID must be local user
    let user = await this.isLocalUser(userUUID)
    if (!user) throw new E.EACCESS()

    let allMedia = this.mediaData.getAllMedia(userUUID)
    return allMedia
  }

  // need to check authorazation 
  async readMedia({userUUID, digest}) {

    let media = this.mediaData.findMediaByHash(digest)
    if (!media) throw new E.ENOENT()

    let props = this.mediaData.mediaProperties(userUUID, media)
    if (props.permittedToShare || props.authorizedToRead ||
      props.sharedWithOthers || props.sharedWithMe) {
      return this.findMediaPath(digest)
    } else {
      throw new E.ENOENT()
    }
  }

  getThumb({ requestId, digest, query }, callback) {

    let src = this.findMediaPath(digest)
    tb.request({ requestId, src, digest, query }, (err, data) => {
      if (err)
        return callback(err)

      return callback(null, data)
    })
  }

  abort({ requestId, digest, query }, callback) {

    tb.abort({ requestId, digest, query })
    callback(null, true)
  }

  register(ipc) {
    ipc.register('getMeta', (args, callback) => this.getMeta(args).asCallback(callback))
    ipc.register('readMedia', (args, callback) => this.readMedia(args).asCallback(callback))
    ipc.register('getThumb', this.getThumb.bind(this))
    ipc.register('abort', this.abort.bind(this))
  }
}

