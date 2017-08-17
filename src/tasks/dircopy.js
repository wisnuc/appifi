const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const UUID = require('uuid')

const { forceXstatAsync } = require('../lib/xstat')
const Transform = require('../lib/transform')
const { btrfsCloneAsync } = require('../utils/btrfs')

// arrow version
// const f = af => (x, callback) => af(x).then(y => callback(null, y)).catch(callback)

const f = function (af) {
  return function (x, callback) {
    af(x)
      .then(y => callback(null, y))
      .catch(callback)
  }
}

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

class CopyTask extends EventEmitter {

  constructor (ctx, user, props) {
    super()

    this.ctx = ctx
    this.uuid = UUID.v4()

    // required by fruitmix
    this.user = user

    let srcdrv = props.src.drive
    let dstdrv = props.dst.drive

    // x { src, dst, dirs } -> dirwalk [ { src, dst } ]
    let mkdirs = new Transform({
      name: 'mkdirs',
      transform: f(async function (x) {
        let dst = ctx.getDriveDirPath(user, dstdrv, x.dst)
        await Promise.map(x.dirs, dir => mkdirpAsync(path.join(dst, dir.name)))

        let { entries } = await ctx.getDriveDirAsync(user, dstdrv, x.dst)
        let dirs = entries.filter(file => file.type === 'directory')

        // TODO assert 
        return x.dirs.map(dir => ({
          name: dir.name,
          src: dir.uuid,
          dst: dirs.find(d => d.name === dir.name).uuid
        }))
      })
    })

    // x { src, dst } 
    // -> mkdirs { src, dst, dirs }
    // -> dup { src, dst, files }
    let dirwalk = new Transform({
      name: 'dirwalk',
      push(x) {
        this.pending = [...this.pending, ...x]
        this.schedule()
      },
      transform: f(async function(x) {
        let { entries } = await ctx.getDriveDirAsync(user, srcdrv, x.src)
        let dirs = entries.filter(x => x.type === 'directory')
        let files = entries.filter(x => x.type === 'file')
        if (dirs.length) mkdirs.push({ src: x.src, dst: x.dst, dirs })
        return { src: x.src, dst: x.dst, files }
      })
    })

    let dup = new Transform({
      name: 'dup',

      /** x { src, dst, files } **/
      push (x) {
        if (!x.files.length) return
        let src = ctx.getDriveDirPath(user, srcdrv, x.src)
        let dst = ctx.getDriveDirPath(user, dstdrv, x.dst) 
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
      src: props.src.dir,
      dst: props.dst.dir,
      files: props.entries.filter(entry => entry.type === 'file')
    })
   
    mkdirs.push({
      src: props.src.dir,
      dst: props.dst.dir,
      dirs: props.entries.filter(entry => entry.type === 'directory')
    }) 

    this.view = function () {
      return {
        uuid: this.uuid,
        user: user.uuid,
        type: 'copy',
        src: props.src,
        dst: props.dst,
        entries: props.entries
      }
    }
  }

}

module.exports = CopyTask

