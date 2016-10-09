import path from 'path'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

const expect = chai.expect
const should = chai.should()

import deepEqual from 'deep-equal'

import { mkdirpAsync, rimrafAsync, mkdirp, rimraf, fs } from 'src/fruitmix/util/async'

import { createDrive } from 'src/fruitmix/lib/drive'

const cwd = process.cwd()
const driveUUID01 = '880af12c-e545-4035-b4f7-7999f76dd656'
const userUUID01 = '1b7901c0-0629-47cb-95cf-b31a703cac71'

describe(path.basename(__filename) + ': testing collation', function() {

  const createForest = (props, callback)  => {
    let forest = createDrive() 
    let node = forest.createNode(null, props)
    forest.requestCollation(node)
    forest.once('collationsStopped', () => {
      callback(null, forest)
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

    it('createCollatedForest should create a forest matching hierarchy (callback)', function(done) {

      createForest(props, (err, forest) => {
        if (err) return done(err)

        let expected = [
          'root|null', 
            'folder1|root', 
              'folder2|folder1', 
            'folder3|root'
        ].sort()

        let flattened = nameArray(forest.roots[0])
        expect(flattened).to.deep.equal(expected)
        done()
      })
    })

    it('createCollatedForest should create a forest matching hierarchy (async)', () => 
      (async () => {
        let forest = await createCollatedForestAsync(props)
        return nameArray(forest.roots[0])
      })().should.eventually.deep.equal([
        'root|null', 
          'folder1|root', 
            'folder2|folder1', 
          'folder3|root'
      ].sort()))

    it('collations should find newly added folder3/folder4 (callback)', function(done) {

      createForest(props, (err, forest) => {
        if (err) return done(err) 

        mkdirp('tmptest/folder3/folder4', err => {
          if (err) return done(err)
          
          let f3node = namedNode(forest.roots[0], 'folder3')
          forest.requestCollation(f3node)

          forest.once('collationsStopped', () => {
            expect(nameArray(forest.roots[0])).to.deep.equal([
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

        let forest = await createCollatedForestAsync(props)
        let root = forest.roots[0]
        await mkdirpAsync('tmptest/folder3/folder4')
        await Promise.promisify(callback => 
          forest.requestCollation(namedNode(root, 'folder3'))
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

      createForest(props, (err, forest) => {
        if (err) return done(err)

        rimraf('tmptest/folder1/folder2', err => {
          if (err) return done(err)

          let f2node = namedNode(forest.roots[0], 'folder2')
          forest.requestCollation(f2node)

          forest.once('collationsStopped', () => {
            expect(nameArray(forest.roots[0])).to.deep.equal([
              'root|null',
                'folder1|root',
                'folder3|root'
            ].sort())

            console.log(forest.roots[0])
            done()
          })
        })
      })
    })



  })
})
