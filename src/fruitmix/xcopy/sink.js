/**
results for timeline 

[ { uuid: 'e2e8e15d-6fc7-4047-a3fa-ac0383471659',
    pdir: '5b079c29-19ec-46dc-a6c9-c8d11d0bd56a',
    name: 'pdf.pdf',
    size: 433994,
    mtime: 1529586214955,
    hash: 'ebb031c3945e884e695dbc63c52a5efcd075375046c49729980073585ee13c52',
    metadata: { type: 'PDF' },
    place: 0,
    namepath: [ 'foo', 'pdf.pdf' ] } ]
[ { uuid: '4f0efa94-78c5-456e-b6bf-af6980c4385c',
    pdir: '5b079c29-19ec-46dc-a6c9-c8d11d0bd56a',
    name: 'church',
    size: 39499,
    mtime: 1529586214699,
    hash: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408',
    metadata: { type: 'JPEG', w: 235, h: 314 },
    place: 0,
    namepath: [ 'foo', 'church' ] } ]

results for visiting / search

[ { uuid: '1270704a-5d6b-420f-89de-c3bbbf552607',
    pdir: 'cf0fce81-aa83-4786-9a41-da03937596bb',
    type: 'directory',
    name: 'foo',
    mtime: 1529586310303,
    place: 0,
    namepath: [ 'foo' ] },
  { uuid: '2127b528-c886-49c0-b234-8f2b3ca0fcdf',
    pdir: '1270704a-5d6b-420f-89de-c3bbbf552607',
    type: 'directory',
    name: 'bar',
    mtime: 1529586309871,
    place: 0,
    namepath: [ 'foo', 'bar' ] },
  { uuid: '03e6f9ac-d4ee-47bd-8856-4c52b439a7b1',
    pdir: '1270704a-5d6b-420f-89de-c3bbbf552607',
    type: 'file',
    name: 'alonzo',
    size: 39499,
    mtime: 1529586309875,
    hash: '8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408',
    metadata: { type: 'JPEG', w: 235, h: 314 },
    place: 0,
    namepath: [ 'foo', 'alonzo' ] },
  { pdir: '1270704a-5d6b-420f-89de-c3bbbf552607',
    type: 'file',
    name: 'hello',
    size: 6,
    mtime: 1529586310047,
    place: 0,
    namepath: [ 'foo', 'hello' ] },
  { uuid: '2f9ade57-35e7-435d-801e-cdf421334a72',
    pdir: '1270704a-5d6b-420f-89de-c3bbbf552607',
    type: 'file',
    name: 'pdf.pdf',
    size: 433994,
    mtime: 1529586310139,
    hash: 'ebb031c3945e884e695dbc63c52a5efcd075375046c49729980073585ee13c52',
    metadata: { type: 'PDF' },
    place: 0,
    namepath: [ 'foo', 'pdf.pdf' ] } ]

*/


/**
entry {
  drive:  // vfs drive uuid or nfs drive
  pdir:   // vfs dir uuid or nfs dir path
  type:   // directory or file
  name:   // directory or file name
}
*/
class Sink extends EventEmitter {

  constructor (vfs, nfs, user, props) {
    super()

    if (!vfs) throw new Error('vfs is not provided')
    if (!nfs) throw new Error('nfs is not provided')

    this.vfs = vfs
    this.nfs = nfs
    this.user = user
    this.type = props.type
    this.srcs = props.srcs
    this.dst = props.dst
    this.task = null
    this.allFinished = false

    this.next()
  }

  next () {
    if (this.srcs.length === 0) {
      this.allFinished = true
      return
    }

    let index = this.srcs.find(x => x.drive !== this.srcs[0].drive || x.pdir !== this.srcs[0].pdir)
    let entries
    if (index === -1) {
      entries = this.srcs
      this.srcs = []
    } else {
      entries = this.srcs.slice(0, index)
      this.srcs = this.srcs.slice(index)
    }

    this.task = new Task(this.vfs, this.nfs, this.user, {
      type: this.type,
      src: {
        drive: entries[0].drive,
        dir: entries[0].pdir,
      },
      dst: this.dst,
      entries: entries.map(x => x.name)
    })

    this.task.on('finish', () => this.next())
  }

  view () {
    return { 
      batch: true,
      type: this.type,
      srcs: this.srcs,
      dst: this.dst,
      task: this.task ? this.task.view() : null,
      allFinished: this.allFinished
    }
  }

  updateNode (nodeUUID, props, callback) {
    if (this.task) {
      this.task.updateNode(nodeUUID, props, callback)
    } else {
      let err = new ('task already finished')
      err.status = 403
      process.nextTick(() => callback(err))
    }
  }

  // TODO
  destroy () {
  }

}

module.exports = Sink
