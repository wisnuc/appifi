import path from 'path'
import crypto from 'crypto'

import { expect } from 'chai'
import UUID from 'node-uuid'
import validator from 'validator'

import mkdirp from 'mkdirp' // FIXME
import rimraf from 'rimraf'

import uuids from '../util/uuids'
import { rimrafAsync, mkdirpAsync, fs, xattr } from '../util/async'
import { createDrive } from 'src/fruitmix/lib/drive'

const uuid1 = 'c0765cd5-acd1-4b53-bb17-7834ebdca6c1' 
const uuid2 = 'd7114148-e2bd-42f8-88f9-a980a1a4d29c' 
const uuid3 = 'f4fadbe2-5fc2-4538-abbd-92191f92dfe6' 
const uuid4 = '997892a5-8166-48dd-ab7c-59a4d1a3523a' 
const uuid5 = '188b73c0-f14e-4a83-a79f-fc8cc37c8c3d' 

const cwd = process.cwd()
const FRUITMIX = 'user.fruitmix'
const preset1 = JSON.stringify({
    uuid:uuid1,
    owner:[uuid2],
    writelist: [],
    readlist:[]
  })

const fixed01 = {
  label: 'fixed01',
  fixedOwner: true,
  URI: 'fruitmix',
  uuid: uuid1,
  owner: [uuid2],
  writelist: [],
  readlist: [],
  cache: true
}

const variable01 = {
  label: 'variable01',
  fixedOwner: false,
  URI: 'fruitmix',
  uuid: uuids[0],
  owner: [uuids[1]],
  writelist: [],
  readlist: [],
  cache: true
}

describe(path.basename(__filename), function() {

/** api removed
  describe('test attach drive', function() {

    beforeEach(function() {
      
    })

    it('should have a root with given props, and path', function() {
      
      let props = {
        uuid: uuid1,
        type: 'folder',
        owner: [uuid2],
        writelist:[uuid3],
        readlist:[uuid4],
        name: path.join(cwd, 'tmptest')
      } 
  
      let ffs = createDrive()
      ffs.attachDrive(props)
    })    
  })
**/

  describe('test cache for drive', function() {

    let { uuid, owner, writelist, readlist } = fixed01

    beforeEach(function() {
      return (async () => {
        await rimrafAsync('tmptest')
        await mkdirpAsync('tmptest')
      })()
    })

    it('should build cache on simple folder hierarchy w/o xattr', function(done) {

      const named = (list, name) => {
        let l = list.find(l => l.name === name)
        if (!l) throw new Error('named item not found in list')
        return l
      }

      mkdirpAsync('tmptest/folder1/folder2')
        .then(() => mkdirpAsync('tmptest/folder3'))
        .then(() => {

          let props = {
            uuid: uuid1,
            type: 'folder',
            owner: [uuid2],
            writelist:[uuid3],
            readlist:[uuid4],
            name: path.join(cwd, 'tmptest')
          } 

          let ffs = createDrive()
          let node = ffs.createNode(null, props)
          ffs.scan(node, () => {
            let arr = []
            node.preVisit(n => {
              arr.push({
                parent: n.parent === null ? null : n.parent.uuid,
                uuid: n.uuid,
                type: n.type,
                owner: n.owner,
                writelist: n.writelist,
                readlist: n.readlist,
                name: n.parent === null ? path.basename(n.name) : n.name
              })
            })

            expect(named(arr, 'folder1').parent).to.equal(named(arr, 'tmptest').uuid)
            expect(named(arr, 'folder2').parent).to.equal(named(arr, 'folder1').uuid)
            expect(named(arr, 'folder3').parent).to.equal(named(arr, 'tmptest').uuid)
            done()
          })

        }).catch(e => done(e))
    })
  })

  describe('test createFolder', function() {

    const driveUUID = uuid1
    const ownerUUID = uuid2
    const writerUUID = uuid3
    const readerUUID = uuid4
    const strangerUUID = uuid5

    const driveProps = {
      uuid: driveUUID,
      type: 'folder',
      owner: [ownerUUID],
      writelist:[writerUUID],
      readlist:[readerUUID],
      name: path.join(cwd, 'tmptest')
    } 

    let ffs, root
  
    beforeEach(function() {
      return (async () => {
        await rimrafAsync('tmptest')
        await mkdirpAsync('tmptest/folder1/folder2')
        await mkdirpAsync('tmptest/folder3')
        ffs = createDrive()
        root = ffs.createNode(null, driveProps)
        await new Promise(resolve => ffs.scan(root, () => resolve()))
      })()
    })

    it('creating a folder in root by drive owner should return dir node with name, undefined wr list, and drive owner as owner', function(done) {

      ffs.createFolder(ownerUUID, root, 'hello', (err, node) => {
        if (err) return done(err)
        expect(node.parent).to.equal(root)
        expect(node.isDirectory()).to.be.true
        expect(node.name).to.equal('hello')
        expect(node.writelist).to.be.undefined
        expect(node.readlist).to.be.undefined
        expect(node.owner).to.deep.equal([ownerUUID])
        done()
      })
    })

    it('creating a folder in root by drive owner should have xattr w/ the same uuid w/ node, drive owner as owner, w/o wr list', function(done) {
      ffs.createFolder(ownerUUID, root, 'world', (err, node) => {
        if (err) return done(err)

        xattr.get(path.join(cwd, 'tmptest', 'world'), 'user.fruitmix', (err, attr) => {
          try { 
            let stamp = JSON.parse(attr)
            expect(stamp.owner).to.deep.equal([ownerUUID])
            expect(stamp.uuid).to.equal(node.uuid)
            expect(stamp.hasOwnProperty('writelist')).to.be.false
            expect(stamp.hasOwnProperty('readlist')).to.be.false
            done()
          }
          catch(e) {
            done(e)
          }
        })
      })
    })

    it('creating a folder in root by writer should return dir node with name, undefined wr list and writer as owner', function(done) {
      ffs.createFolder(writerUUID, root, 'hello', (err, node) => {
        if (err) return done(err)
        expect(node.parent).to.equal(root)
        expect(node.isDirectory()).to.be.true
        expect(node.name).to.equal('hello')
        expect(node.writelist).to.be.undefined
        expect(node.readlist).to.be.undefined
        expect(node.owner).to.deep.equal([writerUUID])
        done()
      }) 
    })

    it('creating a folder in root by writer should have xattr w/ the same uuid w/ node, writer as owner, w/o wr list', function(done) {
      ffs.createFolder(writerUUID, root, 'world', (err, node) => {
        if (err) return done(err)
        xattr.get(path.join(cwd, 'tmptest', 'world'), 'user.fruitmix', (err, attr) => {
          try { 
            let stamp = JSON.parse(attr)
            expect(stamp.owner).to.deep.equal([writerUUID])
            expect(stamp.uuid).to.equal(node.uuid)
            expect(stamp.hasOwnProperty('writelist')).to.be.false
            expect(stamp.hasOwnProperty('readlist')).to.be.false
            done()
          }
          catch(e) {
            done(e)
          }
        })
      })
    })

    it('creating a folder in root by reader should fail with EPERM', function(done) {
      ffs.createFolder(readerUUID, root, 'hello', (err, node) => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EACCESS')
        done()
      })
    })

    it('creating a folder in root by reader should fail w/o creating the folder <<<< TODO', function(done) {
      done()
    })

    it('creating a folder in root by stranger should fail with EPERM', function(done) {
      ffs.createFolder(strangerUUID, root, 'world', (err, node) => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EACCESS')
        done()
      })
    })

    it('creating a folder in root by stranger should fail w/o creating the folder <<<< TODO', function(done) {
      done()
    })

    it('should return error if folder exists (in root) ??? ', function(done) {
      ffs.createFolder(ownerUUID, root, 'folder1', (err, node) => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EEXIST')
        done()
      })
    })

    it('should return error if folder exists (in subfolder) ???', function(done) {

      let folder1 = root.children.find(c => c.name === 'folder1') 
      ffs.createFolder(writerUUID, folder1, 'folder2', (err, node) => {
        expect(err).to.be.an('error')
        expect(err.code).to.equal('EEXIST')
        done()
      }) 
    })
  })
})


