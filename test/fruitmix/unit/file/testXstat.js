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
const expect = chai.expect;
const FRUITMIX = 'user.fruitmix';
const UNINTERESTED_MAGIC_VERSION = 0;
const sha256_1 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const sha256_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9825';
const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false;

describe('xstat.js', () => {

	let cwd = process.cwd();
	let tmpFoder = 'tmptest';
	let tmpFile = 'testfile.js';
	let tmpCoFile = 'testcofile.js';
	let fpath = path.join(cwd, tmpFoder);
	let ffpath = path.join(fpath, tmpFile);
	let ffcopath = path.join(fpath, tmpCoFile);
	let testdatafoder = 'testdata';
	let jpgA = path.join(cwd, testdatafoder, 'a.jpg');
	let jpgB = path.join(cwd, testdatafoder, 'b.jpg');

	describe('readTimeStamp', () => {
		let timeStamp;
		before(done => {
			let uuid = UUID.v4();
			rimraf(tmpFoder, err => {
				if(err) return done(err);
				mkdirp(tmpFoder , err => {
					if(err) return done(err);
					fs.stat(fpath, (err, stats) => {
						if (err) { return done(err) }
						timeStamp = stats.mtime.getTime();
						done();
					});
				});
			});
		});
		after(() => rimraf(tmpFoder, () => {}) );

		it('get the right timeStamp', done => {
			readTimeStamp(fpath, (err, mtime) => {
				if(err) return done(err);
				expect(mtime).to.equal(timeStamp);
				done();
			});
		});
	});

	describe('readXstat', () => {
		beforeEach(done => {
			rimraf(tmpFoder, err => {
				if(err) return done(err);
				mkdirp(tmpFoder, err => {
					if(err) return done(err);
					done();
				});
			});
		});
		// after(() => rimraf(tmpFoder, () => {}) );

		it('should return error if the file is a symbolic', done => {
			readXstat(path.join(cwd, testdatafoder, 'symbolicfile'), (err, attr) => {
				expect(err).to.be.an('error');
				done();
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
						done(e)
					}
				});
			});
		});

		it('new folder should return default attr', done => {
			readXstat(fpath, (err, attr) => {
				expect(isUUID(attr.uuid)).to.be.ture;
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

	});

});