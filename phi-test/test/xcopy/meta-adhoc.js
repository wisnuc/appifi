const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fakeNfsAsync = require('test/lib/nfs')
const { UUIDDE, UUIDF } = fakeNfsAsync

const Watson = require('phi-test/lib/watson')
const { generate } = require('src/fruitmix/xcopy/xtree')


const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')

const FILES = require('../lib').FILES

const { alonzo, foo } = FILES

const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  createTime: 1523867673407,
  status: 'ACTIVE',
  phicommUserId: 'alice'
}

const clone = x => JSON.parse(JSON.stringify(x))

describe(path.basename(__filename), () => {
    let watson, user, home, pub, n1, n2

    // create tree before test
    /** 
      return object {
        type: 'vfs' or 'nfs',
        drive: 'home',            <- translate into drive UUID or drive Id
        dir: ['hello', 'world'],  <- translate into dir uuid or dir pat (via mkpath) 
        chilren                   <- create tree in target fs (vai mktree)
      }
    */
    const prepareTreeAsync = async _t => {
      let t = clone(_t)
      if (t.drive === 'home') {
        t.drive = user.home.uuid
      } else if (t.drive === 'pub') {
        t.drive = user.pub.uuid
      } else if (t.drive === 'u1') {
        t.drive = UUIDDE
      } else if (t.drive === 'u2') {
        t.drive = UUIDF
      } else {
        throw new Error(`unrecognized drive name ${t.drive}`)
      }

      t.dir = t.dir.length === 0 
        ? t.type === 'vfs' ? t.drive : ''
        : await user.mkpathAsync({
            type: t.type,
            drive: t.drive,
            dir: t.type === 'vfs' ? t.drive : '',
            namepath: t.dir 
          })

      if (t.children.length) await user.mktreeAsync(t)
      return t
    }

    // strip off props for each node
    const strip = (t, props) => {
      props.forEach(p => { delete t[p] })
      if (t.children) t.children.forEach(c => strip(c, props))
      return t
    }

    const filter = (t, f) => {
      t.children = t.children.filter(c => f(c)) 
      t.children.filter(c => c.type === 'directory').forEach(d => filter(d, f))
      return t
    }

    const visit = (t, f) => {
      f(t)
      if (t.children) t.children.forEach(c => visit(c, f))
      return t
    }

    const metaArg = {
      st: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'dir001'
          },
          {
            type: 'file',
            name: alonzo.name,
            file: alonzo.path,
            size: alonzo.size,
            sha256: alonzo.hash
          },
        ]
      },
      dt: {
        type: 'directory',
        name: '',
        children: [
        ]
      },
      policies: {
        dir: [null, null],
        file: [null, null]
      }
    }

    let metaLanguage = generate(metaArg) 

    let drivePairs = [
      { 
        src: { type: 'vfs', drive: 'home' }, 
        dst: { type: 'vfs', drive: 'pub' },
      },
      {
        src: { type: 'vfs', drive: 'home' },
        dst: { type: 'nfs', drive: 'u1' }
      },
      {
        src: { type: 'nfs', drive: 'u1' },
        dst: { type: 'vfs', drive: 'home' },
      },
      {
        src: { type: 'nfs', drive: 'u1' },
        dst: { type: 'nfs', drive: 'u1' }
      },
      {
        src: { type: 'nfs', drive: 'u1' },
        dst: { type: 'nfs', drive: 'u2' }
      }
    ]

    let dirPairs = [
      { src: [], dst: [] },
      { src: ['foo'], dst: [] },
      { src: [], dst: ['hello'] },
      { src: ['foo'], dst: ['hello'] },
      { src: ['foo', 'bar'], dst: ['hello', 'world'] },
      { src: ['common', 'foo'], dst: ['common', 'hello'] },
      { src: ['common', 'foo', 'bar'], dst: ['common', 'hello', 'world'] }
    ]

    let contexts = []
    drivePairs.forEach(drivePair => dirPairs.forEach(dirPair => {
      let { src, dst } = drivePair
     
      // bypass cases that src path contains dst path or vice versa
      if (src.drive === dst.drive) {
        let srcDir = dirPair.src
        let dstDir = dirPair.dst
        if (srcDir.length === 0 || dstDir.length === 0) return
        if (srcDir.every((s, i) => s === dstDir[i]) || dstDir.every((d, i) => d === srcDir[i])) return
      }

      let prefix
      if (src.type === 'vfs' && dst.type === 'vfs') {
        prefix = ''
      } else if (src.type === 'vfs' && dst.type === 'nfs') {
        prefix = 'e'
      } else if (src.type === 'nfs' && dst.type === 'vfs') {
        prefix = 'i'
      } else if (src.type === 'nfs' && dst.type === 'nfs') {
        prefix = 'n'
      } else {
        throw new Error(`invalid src or dst type in drivePair, ${drivePair}`)
      }

      contexts.push({
        type: prefix + 'copy', 
        src: Object.assign({}, drivePair.src, { dir: dirPair.src }),
        dst: Object.assign({}, drivePair.dst, { dir: dirPair.dst }) 
      })
      contexts.push({
        type: prefix + 'move', 
        src: Object.assign({}, drivePair.src, { dir: dirPair.src }),
        dst: Object.assign({}, drivePair.dst, { dir: dirPair.dst }) 
      })
    })) 

    beforeEach(async function () {
      await rimrafAsync(tmptest)
      await mkdirpAsync(fruitmixDir)
      let fake = await fakeNfsAsync(tmptest)
      let boundVolume = fake.createBoundVolume(fake.storage, fakeNfsAsync.UUIDBC)

      let userFile = path.join(fruitmixDir, 'users.json')
      await fs.writeFileAsync(userFile, JSON.stringify([alice], null, '  '))

      let opts = { fruitmixDir, boundVolume }
      let fruitmix = new Fruitmix(opts)
      let app = new App({ fruitmix, log: { skip: 'all', error: 'none' } })
      await new Promise(resolve => fruitmix.once('FruitmixStarted', () => resolve()))

      watson = new Watson({ app })
      await new Promise((rs, rj) => watson.login('alice', 'alice', err => err ? rj(err) : rs()))

      fruitmix.nfs.update(fake.storage)
      user = watson.users.alice
    })

    let number = 0
    const padNum = num => '0'.repeat(4 - num.toString().length) + num

    metaLanguage.forEach(_stages => {
      contexts.forEach(ctx => {
        it(`${padNum(number++)} ${ctx.type} from ${ctx.src.drive}:/${ctx.src.dir.join('/')} to ${ctx.dst.drive}:/${ctx.dst.dir.join('/')}`, async function () {
          let src = await prepareTreeAsync(Object.assign({}, ctx.src, { children: metaArg.st.children }))
          let dst = await prepareTreeAsync(Object.assign({}, ctx.dst, { children: metaArg.dt.children }))
          let stages = [..._stages]
          let task = await user.createTaskAsync({
            type: ctx.type,
            src: { drive: src.drive, dir: src.dir },
            dst: { drive: dst.drive, dir: dst.dir },
            entries: src.children.map(c => c.name)
          }) 

          let stage, view
          while (stages.length) {
            stage = stages.shift() 
            view = await user.watchTaskAsync(task.uuid)

            console.log(view)

            if (stages.length) {
              expect(view.finished).to.equal(false)
            } else {
              expect(view.finished).to.equal(true)
            }

            /**
            if src is vfs, assert hash, otherwise drop hash.
            if op is move, drop copied

            if dst is vfs, assert hash, otherwise drop hash. (both)

            stm is src meta
            std is src data
            dtm is dst meta
            dtd is dst data
            */

            let stm = clone(stage.st)
            if (ctx.type.includes('move')) {
              filter(stm, n => n.status !== 'copied')
            }

            visit(stm, n => {
              if (n.type === 'file') {
                if (n.sha256) {
                  n.hash = n.sha256
                  delete n.sha256
                } 
                delete n.file 
              }
              delete n.path
              delete n.status        
            })

            let props = ['uuid', 'mtime', 'metadata']
            let std = strip({ type: 'directory', name: '', children: await user.treeAsync(src) }, props)

            expect(std).to.deep.equal(stm)

            let dtm = clone(stage.dt)
            visit(dtm, n => {
              if (n.type === 'file') {
                if (n.sha256) {
                  n.hash = n.sha256
                  delete n.sha256
                }
                delete n.file
              }
              delete n.path      
              delete n.status
            })

            let dtd = strip({ type: 'directory', name: '', children: await user.treeAsync(dst) }, props)
            expect(dtd).to.deep.equal(dtm)
          }
        })
      })
    })
})

