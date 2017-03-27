/**
 * Created by jianjin.wu on 2017/3/24.
 * @description the operation of file
 */
import FileService from './fileService'

class FileOperation extends FileService {

  constructor() {
    super()
  }

  //TODO this may be either file or directory
  getFileOrDirectory({ user, query, params }, callback) {

    let e
    let node = super.data.findNodeByUUID(params.nodeUUID)

    if (!node) {
      e = new Error('node not found')
      e.code = 'ENOENT'
      return callback(e)
    }

    // if (node.isDirectory()) {
    //
    //   let ret = query.navroot ?
    //     super.navList(user.uuid, node.uuid, query.navroot) :
    //     super.list(user.uuid, node.uuid)
    //
    //   if (ret instanceof Error) {
    //     res.status(500).json({
    //       code: ret.code,
    //       message: ret.message
    //     })
    //   }
    //   else {
    //     res.status(200).json(ret)
    //   }
    // }
    // else if (node.isFile()) {
    //   let filepath = filer.readFile(user.uuid, node.uuid)
    //   res.status(200).sendFile(filepath)
    // }
    // else {
    //   res.status(404).end() // TODO
    // }
  }

  //TODO delete a directory or file
  deleteFileOrDirectory({ userUUID, targetUUID }, callback) {

  }

  register(ipc) {
    ipc.register('getFileOrDirectory', this.getFileOrDirectory.bind(this))
    ipc.register('deleteFileOrDirectory', this.deleteFileOrDirectory.bind(this))
  }
}

export default FileOperation