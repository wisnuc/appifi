const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')

const { forceXstat, forceXstatAsync } = require('../lib/xstat')
const Transform = require('../lib/transform')
const { btrfsCloneAsync } = require('../utils/btrfs')
const fileCopy = require('../forest/filecopy')

const fileDupAsync = async (src, tmp, dst, xstat) => {
  await btrfsCloneAsync(tmp, src)
  try {
    if (xstat.hash) {
      let stat = await fs.lstatAsync(src)
      if (stat.mtime.getTime() === xstat.mtime) {
        await forceXstatAsync(tmp, { hash: xstat.hash })
      }
    }
    await fs.linkAsync(tmp, dst)
  } catch (e) {
    // console.log(e)
    throw e
  } finally {
    fs.unlink(tmp, () => {})
  }
}

/**
  1. user
  2. srcDriveUUID
  3. srcDirUUID
  4. dstDriveUUID
  5. dstDirUUID
*/
class CopyTask extends EventEmitter {

  constructor (ctx, user, props) {
    super()
    this.ctx = ctx
    this.uuid = UUID.v4()
    this.user = user
    this.userUUID = user.uuid

    this.src = props.src
    this.dst = props.dst
    this.entries = props.entries

    // generate dir uuid
    let mkdirs = new Transform({
      name: 'mkdirs',
      /**
      x {
        src: { drive, dir },
        dst: { drive, dir },
        dirs
      }
      **/
      transform: (x, callback) => {
        ;(async () => {
          let dst = ctx.getDriveDirPath(user, x.dst.drive, x.dst.dir)
          await Promise.map(x.dirs, dir => mkdirpAsync(path.join(dst, dir.name)))

          let { entries } = await ctx.getDriveDirAsync(user, x.dst.drive, x.dst.dir)
          let dirs = entries.filter(file => file.type === 'directory')

          // TODO assert 
          let arr = x.dirs.map(dir => ({
            name: dir.name,
            src: { drive: x.src.drive, dir: dir.uuid },
            dst: { drive: x.dst.drive, dir: dirs.find(d => d.name === dir.name).uuid }
          }))
          return arr
        })()
          .then(x => callback(null, x))
          .catch(e => console.log(e) || callback(e))
      }
    })

    // dirwalk consumes a 
    let dirwalk = new Transform({
      name: 'dirwalk',
      push(x) {
        this.pending = [...this.pending, ...x]
        this.schedule()
      },

      /**
      This function is the equivalent of readdir and lstat that operating on
      a fruitmix file system

      x {
        src: { drive, dir },
        dst: { drive, dir }
      }
      y1 {
        src: { drive, dir },
        dst: { drive, dir },
        dirs
      },
      y2 {
        src: { drive, dir }
        dst: { drive, dir } 
        files
      }
      */
      transform: function (x, callback) {
        ctx.getDriveDirAsync(user, x.src.drive, x.src.dir)
          .then(({ entries }) => {
            let dirs = entries.filter(x => x.type === 'directory')
            let files = entries.filter(x => x.type === 'file')
            if (dirs.length) mkdirs.push({ src: x.src, dst: x.dst, dirs })
            callback(null, { src: x.src, dst: x.dst, files })
          })
          .catch(callback)
      }
    })

    let dup = new Transform({
      name: 'dup',

      /**
      x {
        src: { drive, dir },  // uuid
        dst: { drive, dir },  // uuid
        files: []             // xstat
      }
      **/ 
      push (x) {
        let src = ctx.getDriveDirPath(user, x.src.drive, x.src.dir)
        let dst = ctx.getDriveDirPath(user, x.dst.drive, x.dst.dir) 
        x.files.forEach(file => {
          this.pending.push({
            name: file.name,
            src: path.join(src, file.name),
            tmp: path.join(ctx.getTmpDir(), UUID.v4()),
            dst: path.join(dst, file.name),
            xstat: file
          })
        }) 
        this.schedule()
      },
      transform: (x, callback) => 
        fileDupAsync(x.src, x.tmp, x.dst, x.xstat)
          .then(() => callback())
          .catch(callback)
    }) 

    mkdirs.pipe(dirwalk).pipe(dup)
    mkdirs.on('data', data => {})
    mkdirs.on('step', () => {
      console.log('step ---------------------------------- ')
      mkdirs.print()
      if (mkdirs.isStopped()) {
        this.emit('stopped')
      }
    })

    dup.push({
      src: props.src,
      dst: props.dst,
      files: this.entries.filter(entry => entry.type === 'file')
    })
   
    mkdirs.push({
      src: props.src,
      dst: props.dst,
      dirs: this.entries.filter(entry => entry.type === 'directory')
    }) 
  }

  view() {
    return {
      uuid: this.uuid,
      user: this.user.uuid,
      type: 'copy',
      src: this.src,
      dst: this.dst,
      entries: this.entries
    }
  }
}

module.exports = CopyTask

