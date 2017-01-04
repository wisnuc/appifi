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
      readTimeStamp(fpath, (err, mtime) => {
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
      readXstat(filepath, (err, xstat) => {
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
        expect(xstat.writelist).to.be.an('undefined')
        expect(xstat.readlist).to.be.an('undefined')
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })

    it('should return default object contains magic if attr non-exist (for file)', (done) => {
      readXstat(picpath, (err, xstat) => {
        if(err) return done(err)
        expect(isUUID(xstat.uuid)).to.be.true
        expect(xstat.isFile()).to.be.true
        expect(xstat.writelist).to.be.an('undefined')
        expect(xstat.readlist).to.be.an('undefined')
        expect(xstat.magic).to.deep.equal('JPEG')
        expect(xstat.abspath).to.deep.equal(picpath)
        done()
      })
    })

    //  old-format: has owner property
    //  folder in old-format

    it('should return default object if uuid is invalid in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: 'Alice',
        owner: [uuid_1]
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return default object if owner is a string in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: 'Alice'
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        }) 
      })     
    })

    it('should return default object if owner is an object in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: { name: 'Alice' }
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return default object if owner is an uuid in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: uuid_2
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return default object if object exists in owner array in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2, {name: 'Alice'}]
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return default object if writelist is invalid in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        writelist: 'Alice',
        readlist: [uuid_3]
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return default object if readlist is invalid in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        writelist: [uuid_3],
        readlist: 'Alice'
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return default object if writelist and readlist is not both exist or undefined in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        writelist: [uuid_3],
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should delete owner property in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        writelist: [uuid_3],
        readlist: [uuid_4]
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.deep.equal(uuid_1)
          expect(!xstat.owner).to.be.true
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.deep.equal([uuid_3])
          expect(xstat.readlist).to.deep.equal([uuid_4])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    //  file in old-format

    it('should return default object if hash and htime not both exist or undefined for file in old-format', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        hash: '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be'
      }), err => {
        if(err) return done(err)
        readXstat(picpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isFile()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.hash).to.be.an('undefined')
          expect(xstat.htime).to.be.an('undefined')
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should return default object if hash is invalid in old-format', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        hash: 'abcd',
        htime: 1482996729689
      }), err => {
        if(err) return done(err)
        readXstat(picpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isFile()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.hash).to.be.an('undefined')
          expect(xstat.htime).to.be.an('undefined')
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })
    
    it('should return default object if htime is not an integer in old-format', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        hash: '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be',
        htime: '1482996729689'
      }), err => {
        if(err) return done(err)
        readXstat(picpath, (err, xstat) => {
          if(err) return done(err)
          expect(isUUID(xstat.uuid)).to.be.true
          expect(xstat.uuid).to.not.equal(uuid_1)
          expect(xstat.isFile()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.hash).to.be.an('undefined')
          expect(xstat.htime).to.be.an('undefined')
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

  })
  // ============================================================================================================
  describe('updateXattrPermission', function(){

    beforeEach((done) => {
      rimraf(tmpFolder, err => {
        if(err) return done(err)
        mkdirp(tmpFolder, err => {
          if(err) return done(err)
          xattr.set(fpath, FRUITMIX, JSON.stringify({
            uuid: uuid_1,
            writelist: [uuid_2],
            readlist: [uuid_3]
          }), err => {
            if (err) return done(err)
            done()
          })
        })
      })
    })

    afterEach((done) => {
      rimraf(tmpFolder, err => {
        if(err) throw new Error('delete tmpTestFoder failed')
        done()
      })
    })

    // validate uuid
    it('should return error if uuid is invalid', (done) => {
      updateXattrPermission(fpath, 'Alice',[uuid_1], [uuid_2], (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid uuid')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    // validate writelist
    it('should return error if writelist is a string', (done) => {
      updateXattrPermission(fpath, uuid_1, 'Alice', [uuid_2], (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid writelist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return error if writelist is a number', (done) => {
      updateXattrPermission(fpath, uuid_1, 123, [uuid_2], (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid writelist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return error if writelist is an object', (done) => {
      updateXattrPermission(fpath, uuid_1, {name: 'Alice'}, [uuid_2], (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid writelist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return error if writelist is an array contains object', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2, {name: 'Alice'}], [uuid_3], (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid writelist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    // validate readlist
    it('should return error if readlist is a string', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2], 'Alice', (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid readlist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return error if readlist is a number', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2], 123, (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid readlist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return error if readlist is an object', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2], {name: 'Alice'}, (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid readlist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return error if readlist is an array contains object', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2], [uuid_3, {name: 'Alice'}], (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid readlist')
        expect(err.code).to.equal('EINVAL')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    // uuid mismatch
    it('should return error if uuid mismatch', (done) => {
      updateXattrPermission(fpath, uuid_2, [uuid_1], [uuid_3], (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('instance mismatch')
        expect(err.code).to.equal('EMISMATCH')
        readXstat(fpath, (err, xstat) => {
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    // permission could be modified only for folder
    it('should return error if target is not a directory', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        magic: 'JPEG'
      }), err => {
        if(err) return done(err)
        updateXattrPermission(picpath, uuid_1, [uuid_2], [uuid_3], (err, xstat) => {
          expect(err).to.be.an('error')
          expect(err.message).to.equal('not a directory')
          expect(err.code).to.equal('ENOTDIR')
          done()
        })
      })
    })

    it('should return the permission value after change', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2, uuid_3], [uuid_4], (err, xstat) => {
        if(err) return done(err)
        expect(xstat.uuid).to.equal(uuid_1)
        expect(xstat.writelist).to.deep.equal([uuid_2, uuid_3])
        expect(xstat.readlist).to.deep.equal([uuid_4])
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })

    // writelist or readlist undefined
    it('should return undefined if writelist is undefined', (done) => {
      updateXattrPermission(fpath, uuid_1, undefined, [uuid_2], (err, xstat) => {
        if(err) return done(err)
        expect(xstat.uuid).to.equal(uuid_1)
        expect(xstat.writelist).to.be.an('undefined')
        expect(xstat.readlist).to.deep.equal([uuid_2])
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })

    it('should return undefined if readlist is undefined', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2], undefined, (err, xstat) => {
        if(err) return done(err)
        expect(xstat.uuid).to.equal(uuid_1)
        expect(xstat.writelist).to.deep.equal([uuid_2])
        expect(xstat.readlist).to.be.an('undefined')
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })

    it('should return undefined if writelist and readlist are undefined', (done) => {
      updateXattrPermission(fpath, uuid_1, undefined, undefined, (err, xstat) => {
        if(err) return done(err)
        expect(xstat.uuid).to.equal(uuid_1)
        expect(xstat.writelist).to.be.an('undefined')
        expect(xstat.readlist).to.be.an('undefined')
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })

    // repeat value in writelist or readlist 
    it('should return writelist with non-repeat value', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2, uuid_2, uuid_3], [uuid_4], (err, xstat) => {
        if(err) return done(err)
        expect(xstat.uuid).to.equal(uuid_1)
        expect(xstat.writelist).to.deep.equal([uuid_2, uuid_3])
        expect(xstat.readlist).to.deep.equal([uuid_4])
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })

    it('should return readlist with non-repeat value', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2], [uuid_3, uuid_3, uuid_4], (err, xstat) => {
        if(err) return done(err)
        expect(xstat.uuid).to.equal(uuid_1)
        expect(xstat.writelist).to.deep.equal([uuid_2])
        expect(xstat.readlist).to.deep.equal([uuid_3, uuid_4])
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })

    it('should return readlist only contains value that non-exist in writelist', (done) => {
      updateXattrPermission(fpath, uuid_1, [uuid_2, uuid_2,uuid_3], [uuid_3, uuid_4], (err, xstat) => {
        if(err) return done(err)
        expect(xstat.uuid).to.equal(uuid_1)
        expect(xstat.writelist).to.deep.equal([uuid_2, uuid_3])
        expect(xstat.readlist).to.deep.equal([uuid_4])
        expect(xstat.abspath).to.deep.equal(fpath)
        done()
      })
    })
  })
 

});

  



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
  

