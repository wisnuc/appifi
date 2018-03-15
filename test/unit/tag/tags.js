const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const UUID = require('uuid')
const xattr = require('fs-xattr')

const chai = require('chai')
const expect = chai.expect

const createTag = require('src/tags/tags')

const Debug = require('debug')
const debug = process.env.hasOwnProperty('DEBUG') ? Debug('test') : () => {}

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {
  beforeEach(async () => {
    await rimrafAsync(tmptest)
    await mkdirpAsync(tmptest)
    await mkdirpAsync(path.join('tmptest/tmp'))
  })

  it('empty tag', done => {
    let tag = createTag(tmptest)
    expect(tag.tags).to.deep.equal([])
    expect(tag.currMaxIndex).to.deep.equal(-1)
    done()
  })

  it('create new tag', done => {
    let tag = createTag(tmptest)
    tag.createTagAsync({ name: 'test' })
      .then(t => {
        expect(tag.tags.length).to.equal(1)
        expect(tag.currMaxIndex).to.equal(0)
        let t1 = tag.tags[0]
        expect(t1.name).to.deep.equal('test')
        done()
      })
      .catch(done)
  })

  describe('after create new tag', async () => {
    let t , tagObj
    beforeEach(async () => {
      tagObj = createTag(tmptest)
      t = await tagObj.createTagAsync({ name: 'test1' })
      expect(t.name).to.equal('test1')
      expect(t.id).to.equal(0)
    })

    it('update tag name to test2', done => {
      let tag = createTag(tmptest)
      tag.updateTagAsync(t.id, { name:'test2' })
        .then(t1 => {
          expect(t1.id).to.deep.equal(t.id)
          expect(t1.name).to.deep.equal('test2')
          done()
        })
        .catch(done)
    })
    it('delete tag', done => {
      let tag = createTag(tmptest)
      tag.deleteTagAsync(t.id)
        .then(x => {
          expect(tag.tags).to.deep.equal([])
          expect(tag.currMaxIndex).to.deep.equal(0)
          done()
        })
        .catch(done)
    })

    describe('after delete', () => {
      beforeEach(async () => {
        await tagObj.deleteTagAsync(t.id)
      })

      it('create tag id should equal 1', done => {
        let tag = createTag(tmptest)
        tag.createTagAsync({ name: 'test' })
          .then(t => {
            expect(tag.tags.length).to.equal(1)
            expect(tag.currMaxIndex).to.equal(1)
            let t1 = tag.tags[0]
            expect(t1.name).to.deep.equal('test')
            done()
          })
          .catch(done)
      })
    })
  })
})