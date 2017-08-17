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
    let srcStats = { dirs: 0, files: 0, size: 0 }
    let dstStats = { dirs: 0, files: 0, size: 0 }

    // x { src, dst, dirs } -> dirwalk [ { src, dst } ]
    let mkdirs = new Transform({
      name: 'mkdirs',
      transform: f(async function (x) {
        let dstDirPath = ctx.getDriveDirPath(user, dstdrv, x.dst)
        await Promise.map(x.dirs, dir => mkdirpAsync(path.join(dstDirPath, dir.name)))

        dstStats.dirs += x.dirs.length

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

        // generating new dirs and files
        srcStats.dirs += dirs.length
        srcStats.files += files.length
        srcStats.size += files.reduce((sum, file) => sum + file.size, 0)  

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
      transform: (x, callback) => {
        fileDupAsync(x.src, x.tmp, x.dst, x.xstat)
          .then(() => {
            dstStats.files += 1
            dstStats.size += x.xstat.size
            callback()
          })
          .catch(e => {
            console.log(e) 
            callback(e)
          })
      }
    }) 

    mkdirs.pipe(dirwalk).pipe(dup)
    mkdirs.on('data', data => {})
    mkdirs.on('step', () => {
      // console.log('step ---------------------------------- ')
      // mkdirs.print()
      if (mkdirs.isStopped()) {
        this.emit('stopped')
        // console.log('stats', srcStats, dstStats)
      }
    })

    let files = props.entries.filter(entry => entry.type === 'file')
    dup.push({ src: props.src.dir, dst: props.dst.dir, files })
    srcStats.files += files.length
    srcStats.size += files.reduce((sum, file) => sum + file.size, 0)
    
  
    let dirs = props.entries.filter(entry => entry.type === 'directory')
    mkdirs.push({ src: props.src.dir, dst: props.dst.dir, dirs })
    srcStats.dirs += dirs.length

    this.view = function () {
      return {
        uuid: this.uuid,
        type: 'copy',
        src: props.src,
        dst: props.dst,
        entries: props.entries,
        
        srcStats,
        dstStats,

        isStopped: mkdirs.isStopped()
      }
    }
  }

}

module.exports = CopyTask

