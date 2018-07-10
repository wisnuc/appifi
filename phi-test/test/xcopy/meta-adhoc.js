const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const UUID = require('uuid')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const sinon = require('sinon')
const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const fakeNfsAsync = require('test/lib/nfs')
const { UUIDDE, UUIDF } = fakeNfsAsync

const Watson = require('phi-test/lib/watson')
const { sortF, getConflicts, shake, generate } = require('src/fruitmix/xcopy/xtree')

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

const drivePairs = [
  {
    src: { type: 'vfs', drive: 'home' },
    dst: { type: 'vfs', drive: 'pub' }
  },
  {
    src: { type: 'vfs', drive: 'home' },
    dst: { type: 'nfs', drive: 'u1' }
  },
  {
    src: { type: 'nfs', drive: 'u1' },
    dst: { type: 'vfs', drive: 'home' }
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

const dirPairs = [
  { src: [], dst: [] },
//  { src: ['foo'], dst: [] },
//  { src: [], dst: ['hello'] },
  { src: ['foo'], dst: ['hello'] },
//  { src: ['foo', 'bar'], dst: ['hello', 'world'] },
//  { src: ['common', 'foo'], dst: ['common', 'hello'] },
//  { src: ['common', 'foo', 'bar'], dst: ['common', 'hello', 'world'] }
]

const contexts = []
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
  try {
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
  } catch (e) {
    console.log('error in prepareTreeAsync', e)
    throw e
  }
  }

  /**
  1. remove extra props according to type, and move
  */
  const formatMetaTree = (type, tree) => {
    // postvisit
    const visit = n => {
      if (n.type === 'directory') {
        // if (move) n.children = n.children.filter(c => c.status !== 'copied')
        n.children.forEach(c => visit(c))
      } else if (n.type === 'file') {
        if (type === 'vfs') n.hash = n.sha256
        delete n.sha256
        delete n.file
      } else {
        throw new Error('invalid metadata node type')
      }
      delete n.policy // TODO why append policy to metadata
      delete n.rename
      delete n.path
      delete n.status
    }
    visit(tree)
    return tree
  }

  /**
  children is from either vfs or nfs via user.treeAsync
  1. extra props should be removed
  2. should be sort
  */
  const formatTree = (type, children) => {
    let t = { type: 'directory', name: '', children }

    const visit = node => {
      delete node.uuid
      delete node.mtime
      if (node.type === 'directory') {
        node.children = node.children || []
        node.children.sort(sortF)
        node.children.forEach(c => visit(c))
      } else if (node.type === 'file') {
        delete node.metadata
        if (type === 'nfs') delete node.hash
      } else {
        throw new Error('invalid data node type')
      }
    }

    visit(t)
    return t
  }

  const metaArgs = [
/**
    {
      st: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'dir001',
            children: []
          },
          {
            type: 'file',
            name: alonzo.name,
            file: alonzo.path,
            size: alonzo.size,
            sha256: alonzo.hash
          }
        ]
      },
      dt: { type: 'directory', name: '', children: [] },
      policies: { dir: [null, null], file: [null, null] }
    },
*/
    {
      st: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'dir001',
            children: [
              {
                type: 'directory',
                name: 'dir002',
                children: [
                  {
                    type: 'directory',
                    name: 'dir003'
                  }
                ]
              },
              {
                type: 'file',
                name: 'church.jpg',
                file: alonzo.path,
                size: alonzo.size,
                sha256: alonzo.hash
              }
            ]
          },
          {
            type: 'file',
            name: alonzo.name,
            file: alonzo.path,
            size: alonzo.size,
            sha256: alonzo.hash
          }
        ]
      },
      dt: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'dir001',
            children: [
              {
                type: 'directory',
                name: 'dir002',
                children: [
                  {
                    type: 'directory',
                    name: 'dir003'
                  }
                ]
              },
              {
                type: 'file',
                name: 'church.jpg',
                file: alonzo.path,
                size: alonzo.size,
                sha256: alonzo.hash
              }
            ]
          },
          {
            type: 'file',
            name: alonzo.name,
            file: alonzo.path,
            size: alonzo.size,
            sha256: alonzo.hash
          }
        ]
      },
      policies: { dir: [null, null], file: [null, null] }
    },
/**
    {
      st: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'dir001',
            children: [
              {
                type: 'directory',
                name: 'dir002',
                children: [
                  {
                    type: 'directory',
                    name: 'dir003'
                  },
                  {
                    type: 'file',
                    name: 'file003',
                    file: alonzo.path,
                    size: alonzo.size,
                    sha256: alonzo.hash
                  }
                ]
              },
              {
                type: 'file',
                name: 'file002',
                file: alonzo.path,
                size: alonzo.size,
                sha256: alonzo.hash
              }
            ]
          },
          {
            type: 'file',
            name: 'file001',
            file: alonzo.path,
            size: alonzo.size,
            sha256: alonzo.hash
          }
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
*/
  ]

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
    await new Promise((resolve, reject) =>
      watson.login('alice', 'alice', err => err ? reject(err) : resolve()))

    fruitmix.nfs.update(fake.storage)
    user = watson.users.alice
  })

  let number = 0
  const padNum = num => '0'.repeat(6 - num.toString().length) + num

  metaArgs.forEach(metaArg => {
    let language = generate(metaArg)
    console.log('language count', language.length)
    language.forEach(_stages => {
      contexts.forEach(ctx => {
        let srcPathStr = `${ctx.src.drive}:/${ctx.src.dir.join('/')}`
        let dstPathStr = `${ctx.dst.drive}:/${ctx.dst.dir.join('/')}`
        it(`${padNum(number++)} ${ctx.type} from ${srcPathStr} to ${dstPathStr} `, async function () {
          this.timeout(10000)
          let src, dst
          try {
            src = await prepareTreeAsync(Object.assign({}, ctx.src, { children: metaArg.st.children }))
          } catch (e) {
            console.log('error when preparing src tree')

            await Promise.delay(1000)

            throw e
          }

          try {
            dst = await prepareTreeAsync(Object.assign({}, ctx.dst, { children: metaArg.dt.children }))
          } catch (e) {
            console.log('error when preparing dst tree')
            throw e
          }

          let stages = [..._stages]
          let task = await user.createTaskAsync({
            type: ctx.type,
            src: { drive: src.drive, dir: src.dir },
            dst: { drive: dst.drive, dir: dst.dir },
            entries: src.children.map(c => c.name),
            policies: metaArg.policies
          })

          let stage, view
          while (stages.length) {
            stage = stages.shift()
            view = await user.watchTaskAsync(task.uuid)
            let stm = formatMetaTree(src.type, ctx.type.includes('move')
              ? shake(clone(stage.st))
              : clone(stage.st))
            let std = formatTree(src.type, await user.treeAsync(src))
            expect(std).to.deep.equal(stm)

            let dtm = formatMetaTree(dst.type, clone(stage.dt))
            let dtd = formatTree(dst.type, await user.treeAsync(dst))
            expect(dtd).to.deep.equal(dtm)

            if (stages.length) {
              expect(view.finished).to.equal(false)

              let c0 = getConflicts(stage.st)[0]
              expect(c0).to.be.an('object')
              expect(c0.path.slice(1)).to.equal(view.nodes[0].src.path)

              let { policy, applyToAll } = stages[0].resolution
              let arg  = { policy, applyToAll }
              await user.updateTaskAsync(task.uuid, view.nodes[0].src.uuid, { policy, applyToAll })
            } else {
              expect(view.nodes).to.deep.equal([])
              expect(view.finished).to.equal(true)
            }

          }
        })
      })
    })
  }) // end of metaArgs.forEach

  console.log('test count', number)

})
