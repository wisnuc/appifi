import fs from 'fs';
import chai from 'chai';
import path from 'path';
import UUID from 'node-uuid';
import xattr from 'fs-xattr';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import validator from 'validator';
import {
  readTimeStamp,
  readXstat,
  readXstatAsync,
  updateXattrPermission,
  updateXattrHash,
  copyXattr
} from 'src/fruitmix/file/xstat.js';

const debug = true;
const expect = chai.expect;
const FRUITMIX = 'user.fruitmix';
const uuid_1 = '1e5e8983-285b-45c0-b819-90df13618ce7';
const uuid_2 = '398dbbb8-6677-4d3c-801a-0aa822ec9e7b';
const uuid_3 = '09452888-4b8e-488e-b86f-e219a041eb0a';
const uuid_4 = 'fef30128-c940-426d-a934-d55ca17b6ab2';
const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false;

describe('xstat.js', function(){

  let cwd = process.cwd();
  let tmpFolder = 'tmpTestFolder';
  let tmpFile = '20141213.jpg';
  let fpath = path.join(cwd, tmpFolder);
  let picpath = path.join(cwd, 'testpic', tmpFile);

  describe('readTimeStamp', function(){

    let timeStamp;
    before(function(done){
      rimraf(tmpFolder, function(err){
        if(err) return done(err);
        mkdirp(tmpFolder ,function(err){
          if(err) return done(err);
          fs.stat(fpath, function(err, stats){
            if (err) { return done(err); }
            timeStamp = stats.mtime.getTime();
            done();
          });
        });
      });
    });

    after(() => rimraf(tmpFolder, () => {}));

    it('should read timeStamp', function(done){
      readTimeStamp(fpath, function(err, mtime){
        if(err) return done(err);
        expect(mtime).to.equal(timeStamp);
        done();
      });
    });

  });

  describe('readXstat', function(){

    beforeEach((done) => {
      rimraf(tmpFolder, err => {
        if(err) return done(err)
        mkdirp(tmpFolder, err => {
          if(err) return done(err)
          done()
        })
      })
    })

    afterEach((done) => {
      rimraf(tmpFolder, err => {
        if(err) throw new Error('delete tmpTestFoder failed')
        done()
      })
    })

    it('shoule return error if target is not a directory or file', (done) => {
      let filepath = path.join(cwd, 'testpic/symbolic.jpg')
      readXstat(filepath, (err,xstat) => {
        expect(err).to.be.an('error');
        expect(err.message).to.equal('not a directory or file')
        expect(err.code).to.equal('ENOTDIRORFILE')
        done()
      })
    })

    it('should return default object if attr non-exist (for folder)', (done) => {
      readXstat(fpath, (err, xstat) => {
        if(err) return done(err)
        expect(isUUID(xstat.uuid)).to.be.true
        expect(xstat.isDirectory()).to.be.true
        expect(xstat.abspath).to.equal(fpath)
        done()
      })
    })

    it('should return default object contains magic if attr non-exist (for file)', (done) => {
      readXstat(picpath, (err, xstat) => {
        if(err) return done(err)
        expect(isUUID(xstat.uuid)).to.be.true
        expect(xstat.isFile()).to.be.true
        expect(xstat.magic).to.deep.equal('JPEG')
        expect(xstat.abspath).to.equal(picpath)
        done()
      })
    })

    it('should return default object if uuid is invalid in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: 'Alice',
        owner: [uuid_1],
        writelist: [uuid_2],
        readlist: [uuid_3]
      }))
      readXstat(fpath, (err, xstat) => {
        if(err) return done(err)
        console.log(xstat)
        expect(isUUID(xstat.uuid)).to.be.true
        expect(xstat.isDirectory()).to.be.true
        expect(xstat.abspath).to.equal(fpath)
        done()
      })
    })

    // it('should delete owner property in old-format', (done) => {
    //   xattr.set(fpath, FRUITMIX, JSON.stringify({
    //     uuid: uuid_1,
    //     owner: [uuid_2],
    //     writelist: [uuid_3],
    //     readlist: [uuid_4]
    //   }))
    //   readXstat(fpath, (err, xstat) => {
    //     if(err) return done(err)
    //     expect(xstat.uuid).to.deep.equal(uuid_1)
    //     expect(!xstat.owner).to.be.true
    //     expect(xstat.abspath).to.equal(fpath)
    //     done()
    //   })
    // })

  //   it('should return default object if xattr non-exist', function(done){
  //     readXstat(fpath, function(err, attr){
  //       if(err) return done(err);
  //       expect(isUUID(attr.uuid)).to.be.true;
  //       expect(attr.isDirectory()).to.be.ture;
  //       expect(attr.abspath).to.equal(fpath);
  //       expect(attr.owner).to.be.a('array');
  //       done();
  //     });
  //   });

  //   it('should return preset object', function(done){
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       name: 'panda',
  //       age : 23
  //     }), function(err){
  //       if(err) return done(err);
  //       readXstat(fpath, function(err, attr){
  //         if(err) return done(err);
  //         expect(attr.name).to.equal('panda');
  //         expect(attr.age).to.equal(23);
  //         expect(attr.isDirectory()).to.be.ture;
  //         expect(attr.abspath).to.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return error if owner not provided', function(done){
  //     readXstat(fpath, {}, function(err, attr){
  //       expect(err).to.be.an('error');
  //       done();
  //     });
  //   });

  //   it('should return error if the second argument is not an object or undefind', function(done){
  //     readXstat(fpath, 'handsome boy', (err, attr) => {
  //       expect(err).to.be.an('error');
  //       done();
  //     });
  //   });

  //   it('should return a new uuid if preset uuid is a string', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: 'panda',
  //       owner: [uuidArr[0]]
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(isUUID(attr.uuid)).to.be.true;
  //         expect(attr.owner).to.deep.equal([uuidArr[0]]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return a new uuid if preset uuid is an object', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: { name: 'panda' },
  //       owner: [uuidArr[0]]
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(isUUID(attr.uuid)).to.be.true;
  //         expect(attr.owner).to.deep.equal([uuidArr[0]]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return a new uuid if preset uuid is an array', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: [],
  //       owner: [uuidArr[0]]
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(isUUID(attr.uuid)).to.be.true;
  //         expect(attr.owner).to.deep.equal([uuidArr[0]]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return preset uuid(uuid,owner)', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[1],
  //       owner: [uuidArr[0]]
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.uuid).to.deep.equal(uuidArr[1]);
  //         expect(attr.owner).to.deep.equal([uuidArr[0]]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return empty owner array if preset owner (xattr) is an object', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: { name: 'panda' }
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.owner).to.be.deep.equal([]);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return empty array if perset owner is an undefined', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: undefined
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.owner).to.be.deep.equal([]);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return empty array if perset owner is an uuid', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: uuidArr[0]
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.owner).to.be.deep.equal([]);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return empty array if perset owner is an empty array', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: []
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.owner).to.be.deep.equal([]);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return empty array if perset owner is an object array', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: [{ name: 'panda' }]
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.owner).to.be.deep.equal([]);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return preset array', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: [uuidArr[1], uuidArr[2]]
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.owner).to.be.deep.equal([uuidArr[1], uuidArr[2]]);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return preset array without is not uuid', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: [uuidArr[1], uuidArr[2],'panda']
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.owner).to.be.deep.equal([uuidArr[1], uuidArr[2]]);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return undefined if cwd is a folder(because folder without hash attribute)', done => {
  //     xattr.set(fpath, FRUITMIX, JSON.stringify({
  //       uuid: uuidArr[0],
  //       owner: [uuidArr[1]],
  //       hash: sha256_1
  //     }), err => {
  //       if(err) return done(err);
  //       readXstat(fpath, (err, attr) => {
  //         if(err) return done(err);
  //         expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
  //         expect(attr.owner).to.be.deep.equal([uuidArr[1]]);
  //         expect(attr.writelist).to.be.an('undefined');
  //         expect(attr.readlist).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         expect(attr.hash).to.be.an('undefined');
  //         expect(attr.abspath).to.deep.equal(fpath);
  //         done();
  //       });
  //     });
  //   });

  //   it('should return undefined if htime non-exist', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           hash: sha256_1
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.be.an('undefined');
  //             expect(attr.readlist).to.be.an('undefined');
  //             expect(attr.hash).to.be.an('undefined');
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  //   it('should return preset value', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           hash: sha256_1,
  //           htime: stat.mtime.getTime()
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.be.an('undefined');
  //             expect(attr.readlist).to.be.an('undefined');
  //             expect(attr.hash).to.deep.equal(sha256_1);
  //             expect(attr.htime).to.deep.equal(stat.mtime.getTime());
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  //   it('should return undefined if hash value is a string', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           hash: 'panda',
  //           htime: stat.mtime.getTime()
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.be.an('undefined');
  //             expect(attr.readlist).to.be.an('undefined');
  //             expect(attr.hash).to.be.an('undefined');
  //             expect(attr.htime).to.be.an('undefined');
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  //   it('should return undefined if hash value is an object', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           hash: { name: 'panda' },
  //           htime: stat.mtime.getTime()
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.be.an('undefined');
  //             expect(attr.readlist).to.be.an('undefined');
  //             expect(attr.hash).to.be.an('undefined');
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  //   it('should return undefined if hash value is an array', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           hash: [],
  //           htime: stat.mtime.getTime()
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.be.an('undefined');
  //             expect(attr.readlist).to.be.an('undefined');
  //             expect(attr.hash).to.be.an('undefined');
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  //   it('should return all preset value(uuid,owner,writelist,readlist,hash,htime,abspath)', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           writelist: [uuidArr[2]],
  //           readlist: [uuidArr[3]],
  //           hash: sha256_1,
  //           htime: stat.mtime.getTime()
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.deep.equal([uuidArr[2]]);
  //             expect(attr.readlist).to.deep.equal([uuidArr[3]]);
  //             expect(attr.hash).to.deep.equal(sha256_1);
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  //   it('should return undefined if readlist is undefined (NOT the definiton)', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           writelist: [uuidArr[2]],
  //           hash: sha256_1,
  //           htime: stat.mtime.getTime()
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.deep.equal([uuidArr[2]]);
  //             expect(attr.readlist).to.deep.equal([]);
  //             expect(attr.hash).to.deep.equal(sha256_1);
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  //   it('should return undefined if writelist is undefined (NOT the definition)', done => {
  //     fs.writeFile(ffpath, '', (err) => {
  //       if(err) return done(err);
  //       fs.stat(ffpath, (err,stat) => {
  //         xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //           uuid: uuidArr[0],
  //           owner: [uuidArr[1]],
  //           readlist: [uuidArr[2]],
  //           hash: sha256_1,
  //           htime: stat.mtime.getTime()
  //         }), err => {
  //           if(err) return done(err);
  //           readXstat(ffpath, (err, attr) => {
  //             if(err) return done(err);
  //             expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //             expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //             expect(attr.writelist).to.deep.equal([]);
  //             expect(attr.readlist).to.deep.equal([uuidArr[2]]);
  //             expect(attr.hash).to.deep.equal(sha256_1);
  //             expect(attr.abspath).to.deep.equal(ffpath);
  //             done();
  //           });
  //         });
  //       });
  //     });
  //   });

  });

  // describe('update data', () => {

  //   beforeEach(done => {
  //     rimraf(tmpFoder, err => {
  //       if(err) return done(err);
  //       mkdirp(tmpFoder, err => {
  //         if(err) return done(err);
  //         fs.writeFile(ffpath, '', err => {
  //           if(err) return done(err);
  //           fs.stat(ffpath, (err, stat) => {
  //             xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //               uuid: uuidArr[0],
  //               owner: [uuidArr[1]],
  //               writelist: [uuidArr[2]],
  //               readlist: [uuidArr[3]],
  //               hash: sha256_1,
  //               htime: stat.mtime.getTime()
  //             }), err => {
  //               if(err) return done(err);
  //               done();
  //             });
  //           });
  //         });
  //       });
  //     });
  //   });

  //   // remove test foder
  //   after(() => {
  //     rimraf(tmpFoder, err => {
  //       if(err) throw new Error('delete tmpTestFoder failed');
  //     });
  //   });

  //   describe('updateXattrOwner', () => {

  //     it('should returns the owner value after the change', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrOwner(ffpath, uuidArr[0], [uuidArr[4],uuidArr[5]], (err, attr) => {
  //           if(err) return done(err);
  //           expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //           expect(attr.owner).to.deep.equal([uuidArr[4],uuidArr[5]]);
  //           expect(attr.writelist).to.deep.equal([uuidArr[2]]);
  //           expect(attr.readlist).to.deep.equal([uuidArr[3]]);
  //           expect(attr.hash).to.deep.equal(sha256_1);
  //           expect(attr.htime).to.deep.equal(stat.mtime.getTime());
  //           done();
  //         });
  //       });
  //     });

  //     it('Should return error if UUID is not equal', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrOwner(ffpath, uuidArr[1], [uuidArr[4],uuidArr[5]], (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //   });

  //   describe('updateXattrPermission', () => {

  //     it('should returns the permission value after the change', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrPermission(ffpath, uuidArr[0], [uuidArr[4]], [uuidArr[5]], (err, attr) => {
  //           if(err) return done(err);
  //           expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //           expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //           expect(attr.writelist).to.deep.equal([uuidArr[4]]);
  //           expect(attr.readlist).to.deep.equal([uuidArr[5]]);
  //           expect(attr.hash).to.deep.equal(sha256_1);
  //           expect(attr.htime).to.deep.equal(stat.mtime.getTime());
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if UUID is not equal', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrPermission(ffpath, uuidArr[1], [uuidArr[4]], [uuidArr[5]], (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //   });

  //   describe('updateXattrHash', () => {

  //     it('should returns the hash value after the change', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHash(ffpath, uuidArr[0], sha256_2, stat.mtime.getTime(), (err, attr) => {
  //           if(err) return done(err);
  //           expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //           expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //           expect(attr.writelist).to.deep.equal([uuidArr[2]]);
  //           expect(attr.readlist).to.deep.equal([uuidArr[3]]);
  //           expect(attr.hash).to.deep.equal(sha256_2);
  //           expect(attr.htime).to.deep.equal(stat.mtime.getTime());
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if UUID is not equal', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHash(ffpath, uuidArr[1], sha256_2, stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });     

  //   });

  //   describe('updateXattrHashMagic', () => {

  //     it('should store hash and magic in xattr with correct htime (no htime before)', done => {

  //       let attr = {
  //         uuid: uuidArr[0],
  //         owner: []
  //       }
  
  //       xattr.set(ffpath, 'user.fruitmix', JSON.stringify(attr), err => {
  //         fs.stat(ffpath, (err, stat) => {
  //           updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, 'audio', stat.mtime.getTime(), (err, attr) => {
  //             if (err) return done(err)
  //             xattr.get(ffpath, 'user.fruitmix', (err, data) => {
  //               if (err) return done(err)
  //               let x = JSON.parse(data)
  //               expect(x.uuid).to.equal(uuidArr[0])
  //               expect(x.owner).to.deep.equal([])
  //               expect(x.hash).to.equal(sha256_2)
  //               expect(x.magic).to.equal('audio')
  //               expect(x.htime).to.equal(stat.mtime.getTime())
  //               done()
  //             })
  //           })
  //         })
  //       })
  //     })

  //     it('Need to return the modified hash and magic values', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, 'audio', stat.mtime.getTime(), (err, attr) => {
  //           if(err) return done(err);
  //           expect(attr.uuid).to.deep.equal(uuidArr[0]);
  //           expect(attr.owner).to.deep.equal([uuidArr[1]]);
  //           expect(attr.writelist).to.deep.equal([uuidArr[2]]);
  //           expect(attr.readlist).to.deep.equal([uuidArr[3]]);
  //           expect(attr.hash).to.deep.equal(sha256_2);
  //           expect(attr.magic).to.deep.equal('audio');
  //           expect(attr.htime).to.deep.equal(stat.mtime.getTime());
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if UUID is not equal', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[1], sha256_2, 'audio', stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if hash value is a string', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], 'sha256_2', 'audio', stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if hash value is an object', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], { name: 'panda' }, 'audio', stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if hash value is an array', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], [1, 2,], 'audio', stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if typeof magic is an array', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, [1], stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if typeof magic is an object', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, { name: 'panda' }, stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if typeof magic is undefined', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, undefined, stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if the length of magic is 0', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, '', stat.mtime.getTime(), (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //     it('should return error if htime is not equal', done => {
  //       fs.stat(ffpath, (err, stat) => {
  //         if(err) return done(err);
  //         updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, 'audio', stat.mtime.getTime()-1, (err, attr) => {
  //           expect(err).to.be.an('error');
  //           done();
  //         });
  //       });
  //     });

  //   });

  // });

  // describe('copyXattr', () => {
  //   beforeEach(done => {
  //     rimraf(tmpFoder, err => {
  //       if(err) return done(err);
  //       mkdirp(tmpFoder, err => {
  //         if(err) return done(err);
  //         fs.writeFile(ffpath, '', err => {
  //           if(err) return done(err);
  //           fs.stat(ffpath, (err, stat) => {
  //             xattr.set(ffpath, FRUITMIX, JSON.stringify({
  //               uuid: uuidArr[0],
  //               owner: [uuidArr[1]],
  //               writelist: [uuidArr[2]],
  //               readlist: [uuidArr[3]],
  //               hash: sha256_1,
  //               htime: stat.mtime.getTime()
  //             }), err => {
  //               if(err) return done(err);
  //               fs.writeFile(ffcopath, '', err => {
  //                 if(err) return done(err);
  //                 done();
  //               });
  //             });
  //           });           
  //         });
  //       })
  //     });
      
  //   });

  //   it('Need to return a copy of the value', done => {
  //     done();
  //   });

  // });
  
});
