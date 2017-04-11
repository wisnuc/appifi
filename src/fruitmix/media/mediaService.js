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

    // let media = this.mediaData

    // let arr = []
    // this.hashMap.forEach((digestObj, digest) => {
    //   if (digestObj.nodes.find(node => node.userReadable(userUUID)))
    //     arr.push(Object.assign({}, digestObj.meta, { digest }))
    // })

    // return arr
    
  }

  register(ipc){
    ipc.register('getMeta', (args, callback) => this.getMeta(args).asCallback(callback))

  }
}

