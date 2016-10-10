import path from 'path'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

const expect = chai.expect
const should = chai.should()

import deepEqual from 'deep-equal'

import { mkdirpAsync, rimrafAsync, mkdirp, rimraf, fs } from 'src/fruitmix/util/async'

import { createFiler } from 'src/fruitmix/lib/filer'

const cwd = process.cwd()
const driveUUID01 = '880af12c-e545-4035-b4f7-7999f76dd656'
const userUUID01 = '1b7901c0-0629-47cb-95cf-b31a703cac71'

describe(path.basename(__filename) + ': testing collation', function() {

  const createForest = (props, callback)  => {
    let filer = createFiler() 
    let node = filer.createNode(null, props)
    filer.requestCollation(node)
    filer.once('collationsStopped', () => {
      callback(null, filer)
    })
  }

  const createCollatedForestAsync = Promise.promisify(createForest)

  const nameArray = (node) => {

    let arr = []
    node.preVisit(node => {
      if (node.parent === null)
        arr.push('root|null')
      else if (node.parent.parent === null)
        arr.push(node.name + '|root')
      else
        arr.push(node.name + '|' + node.parent.name)
    })

    return arr.sort()
  }

  const namedNode = (node, name) => 
    node.preVisitFind(n => n.name === name)

  describe('test collation for drive', function() {

    let props = {
      uuid: driveUUID01,
      type: 'folder',
      owner: [userUUID01],
      writelist:[],
      readlist:[],
      name: path.join(cwd, 'tmptest')
    } 

    beforeEach(function() {
      return (async () => {
        await rimrafAsync('tmptest')
        await mkdirpAsync('tmptest/folder1/folder2')
        await mkdirpAsync('tmptest/folder3')
      })()
    })

    it('createCollatedForest should create a filer matching hierarchy (callback)', function(done) {

      createForest(props, (err, filer) => {
        if (err) return done(err)

        let expected = [
          'root|null', 
            'folder1|root', 
              'folder2|folder1', 
            'folder3|root'
        ].sort()

        let flattened = nameArray(filer.roots[0])
        expect(flattened).to.deep.equal(expected)
        done()
      })
    })

    it('createCollatedForest should create a filer matching hierarchy (async)', () => 
      (async () => {
        let filer = await createCollatedForestAsync(props)
        return nameArray(filer.roots[0])
      })().should.eventually.deep.equal([
        'root|null', 
          'folder1|root', 
            'folder2|folder1', 
          'folder3|root'
      ].sort()))

    it('collations should find newly added folder3/folder4 (callback)', function(done) {

      createForest(props, (err, filer) => {
        if (err) return done(err) 

        mkdirp('tmptest/folder3/folder4', err => {
          if (err) return done(err)
          
          let f3node = namedNode(filer.roots[0], 'folder3')
          filer.requestCollation(f3node)

          filer.once('collationsStopped', () => {
            expect(nameArray(filer.roots[0])).to.deep.equal([
              'root|null',
                'folder1|root',
                  'folder2|folder1',
                'folder3|root',
                  'folder4|folder3'
            ].sort())
            done()
          })
        })
      })
    })

    it('collations should find newly added folder3/folder4 (async)', () => 
      (async () => {

        let filer = await createCollatedForestAsync(props)
        let root = filer.roots[0]
        await mkdirpAsync('tmptest/folder3/folder4')
        await Promise.promisify(callback => 
          filer.requestCollation(namedNode(root, 'folder3'))
            .once('collationsStopped', () => callback()))()
        return nameArray(root)

      })().should.eventually.deep.equal([
        'root|null',
          'folder1|root',
            'folder2|folder1',
          'folder3|root',
            'folder4|folder3'
      ].sort()))

    it('collations should find newly removed folder1/folder2', function(done) {

      createForest(props, (err, filer) => {
        if (err) return done(err)

        rimraf('tmptest/folder1/folder2', err => {
          if (err) return done(err)

          let f2node = namedNode(filer.roots[0], 'folder2')
          filer.requestCollation(f2node)

          filer.once('collationsStopped', () => {
            expect(nameArray(filer.roots[0])).to.deep.equal([
              'root|null',
                'folder1|root',
                'folder3|root'
            ].sort())

            console.log(filer.roots[0])
            done()
          })
        })
      })
    })



  })
})
