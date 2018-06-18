const Promise = require('bluebird')
const path = require('path')
// const fs = Promise.promisifyAll(require('fs'))
const request = require('supertest')

class User {
  constructor (ctx, username, password) {
    this.ctx = ctx
    this.username = username
    this.password = password
  }

  refreshToken (callback) {
    this.ctx.listBasicUsers((err, basicUsers) => {
      if (err) return callback(err)
      let me = basicUsers.find(u => u.username === this.username)
      if (!me) {
        let err = new Error('user not found')
        callback(err)
      } else {
        this.ctx.getToken(me.uuid, this.password, (err, token) => {
          if (err) return callback(err)
          this.uuid = me.uuid
          this.token = token
          callback(null, token)
        })
      }
    })
  }

  refreshDrives (callback) {
    this.ctx.getDrives(this.token, (err, drives) => {
      if (err) return callback(err)
      this.drives = drives
      this.home = this.drives.find(d => d.type === 'private' && d.tag === 'home')
      this.pub = this.drives.find(d => d.type === 'public' && d.tag === 'built-in')
      callback(null, drives)
    })
  }

  mkdir (_drive, _dir, name, callback) {
    let drive = _drive === 'home' ? this.home.uuid : _drive
    let dir = _dir || drive

    this.ctx.mkdir(this.token, drive, dir, name, callback)
  }

  async mktreeAsync (props) {
    return this.ctx.mktreeAsync(Object.assign({ token: this.token }, props))
  }

  mktree (drive, dir, children, callback) {
    this.mktreeAsync(drive, dir, children)
      .then(() => callback())
      .catch(e => callback(e))
  }

  post (url) {
    return request(this.ctx.app.express)
      .post(url)
      .set('Authorization', 'JWT ' + this.token)
  }

  patch (url) {
    return request(this.ctx.app.express)
      .patch(url)
      .set('Authorization', 'JWT ' + this.token)
  }

  listDir (driveUUID, dirUUID, callback) {
    this.ctx.listDir(this.token, driveUUID, dirUUID, callback)
  }

  async listDirAsync (driveUUID, dirUUID) {
    return Promise.promisify(this.listDir).bind(this)(driveUUID, dirUUID)
  }

  listNfsDir (driveId, dirPath, callback) {
    this.ctx.listNfsDir(this.token, driveId, dirPath, callback)
  }

  async listNfsDirAsync (driveId, dirPath) {
    return Promise.promisify(this.listNfsDir).bind(this)(driveId, dirPath)
  }

  createTask (args, callback) {
    this.ctx.createTask(this.token, args, callback)
  }

  async createTaskAsync (args) {
    return Promise.promisify(this.createTask).bind(this)(args)
  }

  getTask(uuid, callback) {
    this.ctx.getTask(this.token, uuid, callback)
  }

  async getTask(taskUUID) {
    return Promise.promisify(this.createTask).bind(this)(args)
  }

  patchTask (taskUUID, nodeUUID, args, callback) {
    this.ctx.patchTask(this.token, taskUUID, nodeUUID, args, callback)
  }

  async patchTaskAsync (taskUUID, nodeUUID, args) {
    return Promise.promisify(this.patchTask).bind(this)(taskUUID, nodeUUID, args)
  }

  stepTask (taskUUID, callback) {
    this.ctx.stepTask(this.token, taskUUID, callback)
  }

  async stepTaskAsync (taskUUID) {
    return Promise.promisify(this.stepTask).bind(this)(taskUUID)
  }

  getFiles (args, callback) {
    this.ctx.getFiles(this.token, args, callback)
  } 

  async getFilesAsync (args) {
    return Promise.promisify(this.getFiles).bind(this)(args)
  }

  async getFilesStepByStep (args, step) {
    let x, last, arr = []

    while (true) {
      x = await this.getFilesAsync(Object.assign({ order: 'find', last, count: step }, args))
      arr = [...arr, ...x]
      if (x.length < step) return arr

      let tail = x[step - 1]
      last = [tail.place, tail.type, tail.namepath.join('/')].join('.')
    }
  }
}

class Watson {
  /**
  @param {object} opts
  @param {object} opts.app - app
  @param {object} opts.server - server ip address
  */
  constructor (opts) {
    if (opts.app) {
      this.app = opts.app
    } else {
      this.server = opts.server
    }

    this.users = {}
  }

  listBasicUsers (callback) {
    request(this.app.express)
      .get('/users')
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  getToken (userUUID, password, callback) {
    request(this.app.express)
      .get('/token')
      .auth(userUUID, password)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body.token))
  }

  getDrives (token, callback) {
    request(this.app.express)
      .get('/drives')
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  listDir (token, driveUUID, dirUUID, callback) {
    request(this.app.express)
      .get(`/drives/${driveUUID}/dirs/${dirUUID}`)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  // TODO
  listNfsDir (token, driveId, dirPath, callback) {
    request(this.app.express)
      .get(`/phy-drives/${driveId}`)
      .set('Authorization', 'JWT ' + token)  
      .query({ path: dirPath })
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
      
  }

  getFiles (token, args, callback) {
    request(this.app.express)
      .get('/files')
      .set('Authorization', 'JWT ' + token)
      .query(args)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  login (username, password, callback) {
    let u = new User(this, username, password)
    u.refreshToken(err => {
      if (err) return callback(err)
      u.refreshDrives(err => {
        if (err) return callback(err)
        this.users[u.username] = u
        callback(null, u)
      })
    })
  }

  mkdir (token, driveUUID, dirUUID, name, callback) {
    request(this.app.express)
      .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
      .set('Authorization', 'JWT ' + token)
      .field(name, JSON.stringify({ op: 'mkdir' }))
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null, res.body[0].data)
      })
  }

  nfsMkdir (token, driveId, dir, name, callback) {
    request(this.app.express)
      .post(`/phy-drives/${driveId}`)
      .set('Authorization', 'JWT ' + token)
      .query({ path: dir })
      .field('directory', name)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null)
      })
  }

  newfile (token, driveUUID, dirUUID, name, file, size, sha256, callback) {
    request(this.app.express)
      .post(`/drives/${driveUUID}/dirs/${dirUUID}/entries`)
      .set('Authorization', 'JWT ' + token)
      .attach(name, file, JSON.stringify({ op: 'newfile', size, sha256 }))
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null, res.body[0].data)
      })
  }

  nfsNewfile (token, driveId, dir, name, file, callback) {
    request(this.app.express)
      .post(`/phy-drives/${driveId}`)
      .set('Authorization', 'JWT ' + token)
      .query({ path: dir })
      .attach('file', file, name)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null)
      })
  }

  /**
  @param {string} parent - dir uuid for vfs, dir path for nfs
  */
  async visitNode (node, parent, af) {
    // vfs api returns xstat, nfs api returns nothing
    let xstat = await af(node, parent)
    if (xstat) Object.assign(node, { xstat })

    let children = node.children
    if (children) {
      for (let i = 0; i < children.length; i++) {
        if (xstat) {
          await this.visitNode(children[i], xstat.uuid, af)
        } else {
          await this.visitNode(children[i], path.join(parent, node.name), af)
        }
      }
    }
  }

  async mktreeAsync (props) {
    let { token, type, drive, dir, children } = props
    let cs = JSON.parse(JSON.stringify(children))

    if (type === 'vfs') {
      for (let i = 0; i < cs.length; i++) {
        await this.visitNode(cs[i], dir, async ({ type, name, file, size, sha256 }, dir) =>
          type === 'directory'
            ? new Promise((resolve, reject) =>
              this.mkdir(token, drive, dir, name, (err, xstat) =>
                err ? reject(err) : resolve(xstat)))
            : new Promise((resolve, reject) =>
              this.newfile(token, drive, dir, name, file, size, sha256, (err, xstat) =>
                err ? reject(err) : resolve(xstat))))
      }
    } else {
      for (let i = 0; i < cs.length; i++) {
        await this.visitNode(cs[i], dir, async ({ type, name, file, size, sha256 }, dir) =>
          type === 'directory'
            ? new Promise((resolve, reject) =>
              this.nfsMkdir(token, drive, dir, name, (err, stat) =>
                err ? reject(err) : resolve()))
            : new Promise((resolve, reject) =>
              this.nfsNewfile(token, drive, dir, name, file, (err, stat) =>
                err ? reject(err) : resolve())))
      }
    }

    return cs
  }

  xcopy (token, props, callback) {
    request(this.app.express)
      .post('/tasks')
      .send(props)
      .expect(200)
      .end((err, res) => {
        if (err) return callback(err)
        callback(null, res.body)
      })
  }

  stepTask (token, taskUUID, callback) {
    request(this.app.express)
      .patch(`/tasks/${taskUUID}`)
      .set('Authorization', 'JWT ' + token)
      .send({ op: 'step' })
      .expect(200)
      .end((err, res) => {
        if (err) {
          console.log('ERROR', err, res.body)
          callback(err)
        } else {
          let step = res.body
          request(this.app.express)
            .patch(`/tasks/${taskUUID}`)
            .set('Authorization', 'JWT ' + token)
            .send({ op: 'watch' })
            .expect(200)
            .end((err, res) => {
              if (err) return callback(err)
              let watch = res.body
              callback(null, { step, watch })
            })
        }
      })
  }

  createTask (token, args, callback) {
    request(this.app.express)
      .post('/tasks')
      .set('Authorization', 'JWT ' + token)
      .send(args)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  getTask (token, taskUUID, callback) {
    request(this.app.express)
      .get(`/tasks/${taskUUID}`)
      .set('Authorization', 'JWT ' + token)
      .expect(200)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
  }

  patchTask (token, taskUUID, nodeUUID, args, callback) {
    request(this.app.express)
      .patch(`/tasks/${taskUUID}/nodes/${nodeUUID}`)
      .set('Authorization', 'JWT ' + token)
      .send(args)
      .expect(200)
      .end((err, res) => {
        if (err) {
          console.log('ERROR patchTask', err.res && res.body)
          callback(err)
        } else {
          let patch = res.body
          request(this.app.express)
            .patch(`/tasks/${taskUUID}`)
            .set('Authorization', 'JWT ' + token)
            .send({ op: 'watch' })
            .expect(200)
            .end((err, res) => {
              if (err) return callback(err)
              let watch = res.body
              callback(null, { patch, watch })
            })
        }
      })
  }
}

module.exports = Watson
