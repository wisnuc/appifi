import path from 'path'
import { assert, expect } from 'chai'
const sinon= require('sinon')
const collection=require('src/fruitmix/models/collection.js')
import fs from 'fs'
import Promise from 'bluebird'
import mkdirp from 'mkdirp'
//import { throwBusy, throwOutOfSync, throwInvalid, throwError } from '../utils/throw'

describe(path.basename(__filename), function(){
  describe('openOrCreateCollectionAsync', function(){
    it('throw an error if read file path error', function(done) {
      (async () => {
        await collection.openOrCreateCollectionAsync('//', '')
      })().then(()=>done(new Error()), (r)=>{r.code=='EISDIR'?done():done(r)})
    })
    it('throw an error if list is invalid', function(done) {
      (async () => {
        await collection.openOrCreateCollectionAsync('//', undefined)
      })().then(()=>done(new Error()), (r)=>{r.code=='EISDIR'?done():done(r)})
    })
    it('return an object which content 4 parts', function(done) {
      (async () => {
        let res=await collection.openOrCreateCollectionAsync('a', 'b')
                 expect(res).to.deep.equal({filepath:'a', tmpfolder:'b', list:[], locked: false})
      })().then(()=>done(), (r)=>done(r))
    })
  })
  describe('updateAsync', function(){
    let obj
    beforeEach(function(done){
      (async () => {
        obj=await collection.openOrCreateCollectionAsync('a', 'b')
      })().then(()=>done(), (r)=>done(r))
    })
    afterEach(function(done){
      (async () => {
        fs.unlink('a', ()=>{})
      })().then(()=>done(), (r)=>done(r))
    })
    it('throw error when list is null', function(done) {
      (async () => {
        await obj.updateAsync(null, {})
      })().then(()=>done(new Error()), (r)=>done())
    })
    it('throw error when newlist is null', function(done) {
      (async () => {
        await obj.updateAsync(null, {})
      })().then(()=>done(new Error()), (r)=>done())
    })
    it('throw error "EBUSY" where collection is locked', function(done) {
      (async () => {
        obj.locked=true; await obj.updateAsync({}, {})
      })().then(()=>done(new Error()), (r)=>{r.code=='EBUSY'?done():done(r)})
    })
    it('throw error where list is out of sync', function(done) {
      (async () => {
        obj.list=['a']; await obj.updateAsync(['b'], ['c'])
      })().then(()=>done(new Error()), (r)=>{r.code=='EOUTOFSYNC'?done():done(r)})
    })
/**
    it('tmp file removed after exec', function(done) {
      (async () => {
        sinon.stub(fs, 'mkdtempAsync').returns('ttt')
        sinon.spy(fs, 'rmdir')
        await fs.mkdirAsync('ttt')
       obj.list=['a']
       await obj.updateAsync(obj.list, ['c'])
       assert(fs.rmdir.calledOnce)
       assert(fs.rmdir.calledWith('ttt'))
        fs.mkdtempAsync.restore()
        fs.rmdir.restore()
      })().then(()=>done(), (r)=>done(r))
    })
    it('file written correctly', function(done) {
      (async () => {
        obj.list=['a']
                 await obj.updateAsync(obj.list, ['c'])
                 expect(JSON.parse((await fs.readFileAsync('a')).toString())).to.deep.equal(['c'])
      })().then(()=>done(), (r)=>done(r))
    })
**/
  })
})

