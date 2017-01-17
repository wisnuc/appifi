import fs from 'fs'
import chai from 'chai'
import path from 'path'
import UUID from 'node-uuid'
import xattr from 'fs-xattr'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import validator from 'validator'
import {
	readTimeStamp,
  readXstat,
  readXstatAsync,
  updateXattrOwner,
  updateXattrPermission,
  updateXattrHash,
  updateXattrHashMagic,
  copyXattr,
  copyXattrAsync,
  testing
} from 'src/fruitmix/file/xstat.js'

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
const expect = chai.expect;
const FRUITMIX = 'user.fruitmix';
const UNINTERESTED_MAGIC_VERSION = 0;
const sha256_1 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const sha256_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9825';
const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false;

describe('xstat.js', () => {

	let cwd = process.cwd();
	let tmpFolder = 'tmptest';
	let tmpFile = 'testfile.js';
	let tmpCoFile = 'testcofile.js';
	let fpath = path.join(cwd, tmpFolder);
	let ffpath = path.join(fpath, tmpFile);
	let ffcopath = path.join(fpath, tmpCoFile);
	let testdatafoder = 'testdata';
	let jpgA = path.join(cwd, testdatafoder, 'a.jpg');
	let jpgB = path.join(cwd, testdatafoder, 'b.jpg');

	describe('readTimeStamp', () => {
		let timeStamp;
		before(done => {
			let uuid = UUID.v4();
			rimraf(tmpFolder, err => {
				if(err) return done(err);
				mkdirp(tmpFolder , err => {
					if(err) return done(err);
					fs.stat(fpath, (err, stats) => {
						if (err) { return done(err) }
						timeStamp = stats.mtime.getTime();
						done();
					});
				});
			});
		});
		after(() => rimraf(tmpFolder, () => {}) );

		it('get the right timeStamp', done => {
			readTimeStamp(fpath, (err, mtime) => {
				if(err) return done(err);
				expect(mtime).to.equal(timeStamp);
				done();
			});
		});
	});

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

		it('Correct update hash', done => {
			fs.writeFile(ffpath, 'hello', err => {
				if(err) return done(err);
				fs.lstat(ffpath, (err, stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						writelist: [uuidArr[1]],
						readlist: [uuidArr[2]],
						hash: sha256_1,
						htime: stat.mtime.getTime(),
						magic: 0
					}), err => {
						if(err) return done(err);
						updateXattrHash(ffpath, uuidArr[0], sha256_2, stat.mtime.getTime(), (err, res) => {
							if(err) return done(err);
							expect(res.hash).to.equal(sha256_2);
							done();
						});
					});
				});
			});
		});

	});

});