import fs from 'fs';
import chai from 'chai';
import path from 'path';
import UUID from 'node-uuid';
import xattr from 'fs-xattr';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import validator from 'validator';
import child from 'child_process';
import {
  readTimeStamp,
  readXstat,
  readXstatAsync,
  updateXattrPermission,
  updateXattrHash,
  copyXattr
} from 'src/fruitmix/file/xstat.js';

Promise.promisifyAll(fs);
const uuidArr = [
	'c3256d90-f789-47c6-8228-9878f2b106f6',
	'6c15ff0f-b816-4b2e-8a2e-2f7c4902d13c',
	'b6d7a826-0635-465f-9034-1f5a69181f68',
	'e4197ec7-c588-492c-95c4-be6172318932',
	'494e2130-56c6-477c-ba4f-b87226eb7ebd',
	'52285890-5556-47fb-90f3-45e14e741ccd',
	'6648fe47-bcf0-43cb-9f64-996620595bd7',
	'238e1fa5-8847-43e6-860e-cf812d1f5e65',
	'146e05a5-d31b-4601-bc56-a46e66bb14eb'
];
const htime1 = 1483415455656;
const UNINTERESTED_MAGIC_VERSION = 0;
const debug = true;
const expect = chai.expect;
const sha256_1 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const sha256_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9825';
const FRUITMIX = 'user.fruitmix';
const uuid_1 = '1e5e8983-285b-45c0-b819-90df13618ce7';
const uuid_2 = '398dbbb8-6677-4d3c-801a-0aa822ec9e7b';
const uuid_3 = '09452888-4b8e-488e-b86f-e219a041eb0a';
const uuid_4 = 'fef30128-c940-426d-a934-d55ca17b6ab2';
const hash_1 = '7803e8fa1b804d40d412bcd28737e3ae027768ecc559b51a284fbcadcd0e21be';
const hash_2 = '21cb9c64331d69f6134ed25820f46def3791f4439d2536b270b2f57f726718c7';
const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false;

describe('xstat.js', function(){

  let cwd = process.cwd();
  let tmpFolder = 'tmptest';
  let tmpPic = '20141213.jpg';
  let fpath = path.join(cwd, tmpFolder);
  let picpath = path.join(cwd, 'testpic', tmpPic);

	let tmpFile = 'testfile.js';
	let tmpCoFile = 'testcofile.js';
	let ffpath = path.join(fpath, tmpFile);
	let ffcopath = path.join(fpath, tmpCoFile);
	let testdatafoder = 'testpic';
	let jpgA = path.join(cwd, testdatafoder, 'a.jpg');
	let jpgB = path.join(cwd, testdatafoder, 'b.jpg');

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
//-----------------
	describe('readXstat, updateXattrHash, updateXattrPermission, copyXattr', () => {
		beforeEach(done => {
			rimraf(tmpFolder, err => {
				if(err) return done(err);
				mkdirp(tmpFolder, err => {
					if(err) return done(err);
					done();
				});
			});
		});
		after(() => rimraf(tmpFolder, () => {}) );

		// readXstat
		it('should return error if the file is a symbolic', done => {
			readXstat(path.join(cwd, testdatafoder, 'symbolicfile'), (err, attr) => {
				expect(err).to.be.an('error');
				done();
			});
		});

		it('Default settings are not in JSON format', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify('hello hello'), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.abspath).to.equal(fpath);
					done();
				});
			});
		});

		it('Old format UUID illegal should set default values', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid : 'hello'
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.abspath).to.equal(fpath);
					done();
				});
			});
		});

		it('Old format owner illegal should set default values', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid : uuidArr[0],
				owner: 'hello'
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.abspath).to.equal(fpath);
					done();
				});
			});
		});

		it('Old format writelist illegal should set default values', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid : uuidArr[0],
				owner: [uuidArr[1]],
				writelist: 'hello'
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.abspath).to.equal(fpath);
					done();
				});
			});
		});

		it('Old format readlist illegal should set default values', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid : uuidArr[0],
				owner: [uuidArr[1]],
				writelist: [uuidArr[2]],
				readlist: 'hello'
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.abspath).to.equal(fpath);
					done();
				});
			});
		});

		it('File attr old format has hash no htime', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					owner: [uuidArr[1]],
					writelist: [uuidArr[2]],
					readlist: [uuidArr[3]],
					hash: sha256_1
				}), err => {
					if(err) return done(err);
					readXstat(ffpath, (err, attr) => {
						if(err) return done(err);
						expect(isUUID(attr.uuid)).to.be.true;
						expect(attr.abspath).to.equal(ffpath);
						done();
					})
				});
			});
		});
		
		it('File attr old format magic illegal', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					owner: [uuidArr[1]],
					writelist: [uuidArr[2]],
					readlist: [uuidArr[3]],
					hash: sha256_1,
					htime: 1483415455656,
					magic: 'hello'
				}), err => {
					if(err) return done(err);
					readXstat(ffpath, (err, attr) => {
						if(err)return done(err);
						expect(isUUID(attr.uuid)).to.be.true;
						expect(attr.abspath).to.equal(ffpath);
						done();
					});
				});
			});
		});

		it('Read the attr attribute on the file should return the correct format', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					owner: [uuidArr[1]],
					writelist: [uuidArr[2]],
					readlist: [uuidArr[3]],
					hash: sha256_1,
					htime: 1483415455656,
					magic: 'JPEG'
				}), err => {
					if(err) return done(err);
					readXstat(ffpath, (err, attr) => {
						if(err) return done(err);
						xattr.get(ffpath, FRUITMIX, (err, attr) => {
							if(err) return done(err);
							let data = JSON.parse(attr);
							expect(data.uuid).to.equal(uuidArr[0]);
							expect(data.owner).to.equal(undefined);
							expect(data.writelist[0]).to.equal(uuidArr[2]);
							expect(data.readlist[0]).to.equal(uuidArr[3]);
							expect(data.magic).to.equal(UNINTERESTED_MAGIC_VERSION);
							done();
						});
					});
				});
			});
		});

		it('magic upgrade', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					owner: [uuidArr[1]],
					writelist: [uuidArr[2]],
					readlist: [uuidArr[3]]
				}), err => {
					if(err) return done(err);
					readXstat(ffpath, (err, attr) => {
						if(err) return done(err);
						xattr.get(ffpath, FRUITMIX, (err, attr) => {
							if(err) return done(err);
							let data = JSON.parse(attr);
							expect(data.magic).to.equal(UNINTERESTED_MAGIC_VERSION);
							done();
						});
					});
				});
			});
		});

		it('JPEG format pictures should return the correct magic', done => {
			readXstat(jpgA, (err, attr) => {
				if(err) return done(err);
				expect(isUUID(attr.uuid)).to.be.true;
				expect(attr.magic).to.equal('JPEG');
				expect(attr.abspath).to.equal(jpgA);
				done();
			});
		});

		it('not interested in file magic for digital version number and check the digital version', done => {
			readXstat(jpgB, (err, attr) => {
				if(err) return done(err);
				expect(isUUID(attr.uuid)).to.be.true;
				expect(attr.magic).to.equal(undefined);
				expect(attr.abspath).to.equal(jpgB);
				xattr.get(jpgB, FRUITMIX, (err, xstat) => {
					try{
						let str = JSON.parse(xstat);
						expect(str.magic).to.equal(UNINTERESTED_MAGIC_VERSION);
						done();
					}catch(e){
						done(e);
					}
				});
			});
		});

		it('new folder should return default attr', done => {
			readXstat(fpath, (err, attr) => {
				expect(isUUID(attr.uuid)).to.be.true;
				expect(attr.abspath).to.equal(fpath);
				done();
			});
		});

		it('old version should format data', done => {
			fs.writeFile(ffpath, 'dwdw', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					owner: [uuidArr[1]],
					writelist: undefined,
					readlist: undefined,
					abspath: ffpath
				}), err => {
					if(err) return done(err);
					readXstat(ffpath, (err, attr) => {
						if(err) return done(err);
						expect(attr.owner).to.equal(undefined);
						expect(attr.writelist).to.equal(undefined);
						expect(attr.readlist).to.equal(undefined);
						expect(attr.magic).to.equal(undefined);
						xattr.get(ffpath, FRUITMIX, (err, xattr) => {
							if(err) return done(err);
							try{
								let str = JSON.parse(xattr);
								expect(str.magic).to.equal(UNINTERESTED_MAGIC_VERSION);
								done();
							}catch(e){
								done(e)
							}
						});
					});
				});
			});
		});

		it('the wrong format(writelist bad format on foder) will return a new reset attr', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: 'panda',
				abspath: 'shanghai',
				magic: 'JPEG'
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.abspath).to.equal(fpath);
					expect(attr.magic).to.equal(undefined);
					done();
				});
			});
		});

		it('the wrong format(writelist bad format on file) will return a new reset attr', done => {
			fs.writeFile(ffpath, 'hello', err => {
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: 'panda',
					abspath: 'shanghai',
					magic: 'JPEG'
				}), err => {
					if(err) return done(err);
					readXstat(ffpath, (err, attr) => {
						if(err) return done(err);
						expect(isUUID(attr.uuid)).to.be.true;
						expect(attr.abspath).to.equal(ffpath);
						expect(attr.magic).to.equal(undefined);
						xattr.get(ffpath, FRUITMIX, (err, xattr) => {
							if(err) return done(err);
							try{
								let str = JSON.parse(xattr);
								expect(str.magic).to.equal(UNINTERESTED_MAGIC_VERSION);
								done();
							}catch(err){
								done(err);
							}
						});
					});
				});
			});
		});

		// updateXattrHash
		it('update folder hash should thrown error', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				abspath: fpath
			}), err => {
				if(err) return done(err);
				updateXattrHash(fpath, uuidArr[0], sha256_1, htime1, (err, res) => {
					expect(err).to.be.an('error');
					done();
				});
			});
		});

		it('update hash uuid mismatch', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					abspath: ffpath
				}), err => {
					if(err) return done(err);
					updateXattrHash(ffpath, uuidArr[1], sha256_1, htime1, (err, res) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});
		});

		it('Will be modified hash is not legitimate', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					hash: sha256_1,
					htime: htime1
				}), err => {
					if(err) return done(err);
					updateXattrHash(ffpath, uuidArr[0], sha256_2, htime1, (err, res) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});
		});

		it('update hash magic wrongful', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					hash: sha256_1,
					htime: htime1,
					magic: ''
				}), err => {
					if(err) return done(err);
					updateXattrHash(ffpath, uuidArr[0], sha256_2, htime1, (err, res) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});
		});

		it('update hash outdated should thrown error', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				xattr.set(ffpath, FRUITMIX, JSON.stringify({
					uuid: uuidArr[0],
					hash: sha256_1,
					htime: htime1,
					magic: 0
				}), err => {
					if(err) return done(err);
					updateXattrHash(ffpath, uuidArr[0], sha256_1, 2132131, (err, res) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});
		});

	});

// -----------------------

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

    // it('should return default object contains magic if attr non-exist (for file)', (done) => {
    //   readXstat(picpath, (err, xstat) => {
    //     if(err) return done(err)
    //     expect(isUUID(xstat.uuid)).to.be.true
    //     expect(xstat.isFile()).to.be.true
    //     expect(xstat.writelist).to.be.an('undefined')
    //     expect(xstat.readlist).to.be.an('undefined')
    //     expect(xstat.magic).to.deep.equal('JPEG')
    //     expect(xstat.abspath).to.deep.equal(picpath)
    //     done()
    //   })
    // })

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

    it('should return undefined if writelist and readlist are undefined in old-format', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2]
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.deep.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
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
        hash: hash_1
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
        hash: hash_1,
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
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should return default object if magic is not a string in old-format', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        magic: 123
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
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
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

    it('should calculate magic if magic is non-exist in old-format', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
      }), err => {
        if(err) return done(err)
        readXstat(picpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.deep.equal(uuid_1)
          expect(!xstat.owner).to.be.true
          expect(xstat.isFile()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should update magic if magic is old-format', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        owner: [uuid_2],
        magic: 'JPEG image data, Exif standard: [TIFF image data, little-endian...'
      }), err => {
        if(err) return done(err)
        readXstat(picpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.deep.equal(uuid_1)
          expect(!xstat.owner).to.be.true
          expect(xstat.isFile()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    // folder in new format

    it('should return default object if uuid is invalid', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: 'Alice',
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

    it('should return default object if writelist is a string', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        writelist: 'Alice',
        readlist: [uuid_2]
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

    it('should return default object if writelist is an array contains object', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        writelist: [uuid_2, {name: 'Alice'}],
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

    it('should return default object if readlist is a string', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        writelist: [uuid_2],
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

    it('should return default object if readlist is an array contains object', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        writelist: [uuid_2],
        readlist: [uuid_3, {name: 'Alice'}]
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

    it('should return undefined if writelist is undefined', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        readlist: [uuid_2],
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.deep.equal([uuid_2])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return undefined if readlist is undefined', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        writelist: [uuid_2],
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return undefined if writelist and readlist are undefined', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    it('should return preset value if writelist and readlist are valid array', (done) => {
      xattr.set(fpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        writelist: [uuid_2],
        readlist: [uuid_3]
      }), err => {
        if(err) return done(err)
        readXstat(fpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.equal(uuid_1)
          expect(xstat.isDirectory()).to.be.true
          expect(xstat.writelist).to.deep.equal([uuid_2])
          expect(xstat.readlist).to.deep.equal([uuid_3])
          expect(xstat.abspath).to.deep.equal(fpath)
          done()
        })
      })
    })

    // file in new format

    it('should return default object if hash and htime not both exist or undefined', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        magic: 'JPEG'
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
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should return default object if hash is invalid', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: 'abcd',
        htime: 1482996729689,
        magic: 'JPEG'
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
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })
    
    it('should return default object if htime is not an integer', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        htime: '1482996729689',
        magic: 'JPEG'
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
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should return default object if magic is not a string or number', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        magic: [uuid_3]
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
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should return default object if magic is absent', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1
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
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should drop hash if outdated', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        htime: 1482996729689,
        magic: 'JPEG'
      }), err => {
        if(err) return done(err)
        readXstat(picpath, (err, xstat) => {
          if(err) return done(err)
          expect(xstat.uuid).to.deep.equal(uuid_1)
          expect(xstat.isFile()).to.be.true
          expect(xstat.writelist).to.be.an('undefined')
          expect(xstat.readlist).to.be.an('undefined')
          expect(xstat.hash).to.be.an('undefined')
          expect(xstat.magic).to.deep.equal('JPEG')
          expect(xstat.abspath).to.deep.equal(picpath)
          done()
        })
      })
    })

    it('should remove htime in xstat', (done) => {
      fs.stat(picpath, (err, stats) => {
        if(err) return done()
        xattr.set(picpath, FRUITMIX, JSON.stringify({
          uuid: uuid_1,
          hash: hash_1,
          htime: stats.mtime.getTime(),
          magic: 'JPEG'
        }), err => {
          if(err) return done(err)
          readXstat(picpath, (err, xstat) => {
            if(err) return done(err)
            xattr.get(picpath, FRUITMIX, (err, attr) => {
              if(err) return done(err)
              let attrObj = JSON.parse(attr)
              expect(attrObj.htime).to.equal(stats.mtime.getTime())

              expect(xstat.uuid).to.deep.equal(uuid_1)
              expect(xstat.isFile()).to.be.true
              expect(xstat.writelist).to.be.an('undefined')
              expect(xstat.readlist).to.be.an('undefined')
              expect(xstat.hash).to.deep.equal(hash_1)
              expect(xstat.htime).to.be.an('undefined')
              expect(xstat.magic).to.deep.equal('JPEG')
              expect(xstat.abspath).to.deep.equal(picpath)
              done()
            })
          })
        })
      })
      
    })

    it('should remove magic in xstat if it is uninterested magic version', (done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        magic: 0
      }), err => {
        if(err) return done(err)
        readXstat(picpath, (err, xstat) => {
          if(err) return done(err)
          xattr.get(picpath, FRUITMIX, (err, attr) => {
            if(err) return done(err)
            let attrObj = JSON.parse(attr)
            expect(attrObj.magic).to.deep.equal(0)

            expect(xstat.uuid).to.deep.equal(uuid_1)
            expect(xstat.isFile()).to.be.true
            expect(xstat.magic).to.be.an('undefined')
            expect(xstat.abspath).to.deep.equal(picpath)
            done()
          })
        })
      })
    })

  });

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
  });
 
  describe('updateXattrHash', function(){
    let htime
    fs.statAsync(picpath, (err, stats) => {
      if(err) return done(err)
      htime = stats.mtime.getTime()
    })

    beforeEach((done) => {
      xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        htime: htime,
        magic: 'JPEG'
      }), err => {
        if(err) return done(err)
        done()
      })
    })

    it('should return error if uuid is invalid', (done) => {
      updateXattrHash(picpath, 'Alice', hash_1, htime, (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid uuid')
        expect(err.code).to.equal('EINVAL')
        done()
      })
    })

    it('should return error if hash is invalid', (done) => {
      updateXattrHash(picpath, uuid_1, 'abcd', htime, (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid hash')
        expect(err.code).to.equal('EINVAL')
        done()
      })
    })

    it('should return error if htime is invalid', (done) => {
      updateXattrHash(picpath, uuid_1, hash_1, '1483524889848', (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('invalid htime')
        expect(err.code).to.equal('EINVAL')
        done()
      })
    })

    it('should return error if uuid mismatch', (done) => {
      updateXattrHash(picpath, uuid_2, hash_1, htime, (err, xstat) => {
        expect(err).to.be.an('error')
        expect(err.message).to.equal('instance mismatch')
        expect(err.code).to.equal('EMISMATCH')
        done()
      })
    })

    it('should return error if magic is not string', (done) => {
       xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        htime: htime,
        magic: 0
      }), err => {
        if(err) return done(err)
        updateXattrHash(picpath, uuid_1, hash_1, htime, (err, xstat) => {
          expect(err).to.be.an('error')
          expect(err.message).to.equal('invalid magic')
          expect(err.code).to.equal('EINVAL')
          done()
        })
      })
    })

    it('should return error if magic is en epmty string', (done) => {
       xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        htime: htime,
        magic: ''
      }), err => {
        if(err) return done(err)
        updateXattrHash(picpath, uuid_1, hash_1, htime, (err, xstat) => {
          expect(err).to.be.an('error')
          expect(err.message).to.equal('invalid magic')
          expect(err.code).to.equal('EINVAL')
          done()
        })
      })
    })

    it('should return error if timestamp mismatch', (done) => {
       xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        htime: htime,
        magic: 'JPEG'
      }), err => {
        if(err) return done(err)
        updateXattrHash(picpath, uuid_1, hash_1, 1482996729689, (err, xstat) => {
          expect(err).to.be.an('error')
          expect(err.message).to.equal('timestamp mismatch')
          expect(err.code).to.equal('EOUTDATED')
          done()
        })
      })
    })

    it('should return the value after change', (done) => {
       xattr.set(picpath, FRUITMIX, JSON.stringify({
        uuid: uuid_1,
        hash: hash_1,
        htime: htime,
        magic: 'JPEG'
      }), err => {
        if(err) return done(err)
        updateXattrHash(picpath, uuid_1, hash_2, htime, (err, xstat) => {
          expect(xstat.uuid).to.deep.equal(uuid_1)
          expect(xstat.hash).to.deep.equal(hash_2)
          expect(xstat.htime).to.deep.equal(htime)
          expect(xstat.magic).to.deep.equal('JPEG')
          done()
        })
      })
    })
  });

  describe('copyXattr', function(){
    let filepath = path.join(fpath, 'testfile.js')
    let copypath = path.join(fpath, 'copyfile.js')

    beforeEach((done) => {
      rimraf(tmpFolder, err => {
        if(err) return done(err)
        mkdirp(tmpFolder, err => {
          if(err) return done(err)
          fs.writeFile(filepath, '', err => {
            if(err) return done(err)
            fs.stat(filepath, (err, stats) => {
              xattr.set(filepath, FRUITMIX, JSON.stringify({
                uuid: uuid_1,
                hash: hash_1,
                htime: stats.mtime.getTime()
              }), err => {
                if(err) return done(err)
                fs.writeFile(copypath, '', err => {
                  if(err) return done(err)
                  done()
                })
              })
            })
          })
        })
      })
    });

    afterEach((done) => {
      rimraf(tmpFolder, err => {
        if(err) throw new Error('delete tmpTestFoder failed')
        done()
      })
    })

    it('should return copy value', (done) => {
      copyXattr(copypath, filepath, err => {
        if(err) return done(err)
        xattr.get(copypath, FRUITMIX, (err, attr) => {
          if(err) return done(err)
          let attrObj = JSON.parse(attr)
          expect(attrObj.uuid).to.deep.equal(uuid_1)
          expect(attrObj.hash).to.deep.equal(hash_1)
          done()
        })
      })
    })

  });

});

  

