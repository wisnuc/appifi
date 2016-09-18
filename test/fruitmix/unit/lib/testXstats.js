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
  updateXattrOwner,
  updateXattrPermission,
  updateXattrHash,
  updateXattrHashMagic,
  copyXattr,
  copyXattrAsync,
  testing
} from 'src/fruitmix/lib/xstat.js';

const debug = true;
const expect = chai.expect;
const FRUITMIX = 'user.fruitmix';
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
const sha256_1 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const sha256_2 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9825';
const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false;

describe('xstat.js', function(){

	let cwd = process.cwd();
	let tmpFoder = 'tmpTestFoder';
	let tmpFile = 'tmpTestFile.js';
	let tmpCoFile = 'tmpTestCopyFile.js';
	let fpath = path.join(cwd, tmpFoder);
	let ffpath = path.join(fpath, tmpFile);
	let ffcopath = path.join(fpath, tmpCoFile);

	describe('readTimeStamp', function(){
		let timeStamp;
		before(function(done){
			let uuid = UUID.v4();
			rimraf(tmpFoder, function(err){
				if(err) return done(err);
				mkdirp(tmpFoder ,function(err){
					if(err) return done(err);
					fs.stat(fpath, function(err, stats){
						if (err) { return done(err); }
						timeStamp = stats.mtime.getTime();
						done();
					});
				});
			});
		});
		it('should read timeStamp', function(done){
			readTimeStamp(fpath, function(err, mtime){
				if(err) return done(err);
				expect(mtime).to.equal(timeStamp);
				done();
			});
		});
	});

	describe('readXstat', function(){

		beforeEach(done => {
			rimraf(tmpFoder, err => {
				if(err) return done(err);
				mkdirp(tmpFoder, err => {
					if(err) return done(err);
					done();
				});
			});
		});

		// remove test folder
		after(function(){
			rimraf(tmpFoder, err => {
				if(err) throw new Error('delete tmpTestFoder failed');
			});
		});

		it('should return null if the second argument is null', function(done){
			readXstat(fpath, null, function(err, attr){
				if(err) return done(err);
				expect(attr).to.be.null;
				done();
			});
		});

		it('should return default object if xattr non-exist', function(done){
			readXstat(fpath, function(err, attr){
				if(err) return done(err);
				expect(isUUID(attr.uuid)).to.be.true;
				expect(attr.isDirectory()).to.be.ture;
				expect(attr.abspath).to.equal(fpath);
				expect(attr.owner).to.be.a('array');
				done();
			});
		});

		it('should return preset object', function(done){
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				name: 'panda',
				age : 23
			}), function(err){
				if(err) return done(err);
				readXstat(fpath, function(err, attr){
					if(err) return done(err);
					expect(attr.name).to.equal('panda');
					expect(attr.age).to.equal(23);
					expect(attr.isDirectory()).to.be.ture;
					expect(attr.abspath).to.equal(fpath);
					done();
				});
			});
		});

		it('should return error if owner not provided', function(done){
			readXstat(fpath, {}, function(err, attr){
				expect(err).to.be.an('error');
				done();
			});
		});

		it('should return error if the second argument is not an object or undefind', function(done){
			readXstat(fpath, 'handsome boy', (err, attr) => {
				expect(err).to.be.an('error');
				done();
			});
		});

		it('should return a new uuid if preset uuid is a string', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: 'panda',
				owner: [uuidArr[0]]
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.owner).to.deep.equal([uuidArr[0]]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return a new uuid if preset uuid is an object', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: { name: 'panda' },
				owner: [uuidArr[0]]
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.owner).to.deep.equal([uuidArr[0]]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return a new uuid if preset uuid is an array', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: [],
				owner: [uuidArr[0]]
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(isUUID(attr.uuid)).to.be.true;
					expect(attr.owner).to.deep.equal([uuidArr[0]]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return preset uuid(uuid,owner)', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[1],
				owner: [uuidArr[0]]
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.uuid).to.deep.equal(uuidArr[1]);
					expect(attr.owner).to.deep.equal([uuidArr[0]]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return empty owner array if preset owner (xattr) is an object', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: { name: 'panda' }
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.owner).to.be.deep.equal([]);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return empty array if perset owner is an undefined', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: undefined
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.owner).to.be.deep.equal([]);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return empty array if perset owner is an uuid', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: uuidArr[0]
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.owner).to.be.deep.equal([]);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return empty array if perset owner is an empty array', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: []
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.owner).to.be.deep.equal([]);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return empty array if perset owner is an object array', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: [{ name: 'panda' }]
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.owner).to.be.deep.equal([]);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return preset array', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: [uuidArr[1], uuidArr[2]]
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.owner).to.be.deep.equal([uuidArr[1], uuidArr[2]]);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return preset array without is not uuid', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: [uuidArr[1], uuidArr[2],'panda']
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.owner).to.be.deep.equal([uuidArr[1], uuidArr[2]]);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return undefined if cwd is a folder(because folder without hash attribute)', done => {
			xattr.set(fpath, FRUITMIX, JSON.stringify({
				uuid: uuidArr[0],
				owner: [uuidArr[1]],
				hash: sha256_1
			}), err => {
				if(err) return done(err);
				readXstat(fpath, (err, attr) => {
					if(err) return done(err);
					expect(attr.uuid).to.be.deep.equal(uuidArr[0]);
					expect(attr.owner).to.be.deep.equal([uuidArr[1]]);
					expect(attr.writelist).to.be.an('undefined');
					expect(attr.readlist).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					expect(attr.hash).to.be.an('undefined');
					expect(attr.abspath).to.deep.equal(fpath);
					done();
				});
			});
		});

		it('should return undefined if htime non-exist', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						hash: sha256_1
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.be.an('undefined');
							expect(attr.readlist).to.be.an('undefined');
							expect(attr.hash).to.be.an('undefined');
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

		it('should return preset value', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						hash: sha256_1,
						htime: stat.mtime.getTime()
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.be.an('undefined');
							expect(attr.readlist).to.be.an('undefined');
							expect(attr.hash).to.deep.equal(sha256_1);
							expect(attr.htime).to.deep.equal(stat.mtime.getTime());
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

		it('should return undefined if hash value is a string', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						hash: 'panda',
						htime: stat.mtime.getTime()
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.be.an('undefined');
							expect(attr.readlist).to.be.an('undefined');
							expect(attr.hash).to.be.an('undefined');
							expect(attr.htime).to.be.an('undefined');
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

		it('should return undefined if hash value is an object', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						hash: { name: 'panda' },
						htime: stat.mtime.getTime()
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.be.an('undefined');
							expect(attr.readlist).to.be.an('undefined');
							expect(attr.hash).to.be.an('undefined');
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

		it('should return undefined if hash value is an array', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						hash: [],
						htime: stat.mtime.getTime()
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.be.an('undefined');
							expect(attr.readlist).to.be.an('undefined');
							expect(attr.hash).to.be.an('undefined');
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

		it('should return all preset value(uuid,owner,writelist,readlist,hash,htime,abspath)', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						writelist: [uuidArr[2]],
						readlist: [uuidArr[3]],
						hash: sha256_1,
						htime: stat.mtime.getTime()
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.deep.equal([uuidArr[2]]);
							expect(attr.readlist).to.deep.equal([uuidArr[3]]);
							expect(attr.hash).to.deep.equal(sha256_1);
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

		it('should return undefined if readlist is undefined (NOT the definiton)', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						writelist: [uuidArr[2]],
						hash: sha256_1,
						htime: stat.mtime.getTime()
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.deep.equal([uuidArr[2]]);
							expect(attr.readlist).to.deep.equal([]);
							expect(attr.hash).to.deep.equal(sha256_1);
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

		it('should return undefined if writelist is undefined (NOT the definition)', done => {
			fs.writeFile(ffpath, '', (err) => {
				if(err) return done(err);
				fs.stat(ffpath, (err,stat) => {
					xattr.set(ffpath, FRUITMIX, JSON.stringify({
						uuid: uuidArr[0],
						owner: [uuidArr[1]],
						readlist: [uuidArr[2]],
						hash: sha256_1,
						htime: stat.mtime.getTime()
					}), err => {
						if(err) return done(err);
						readXstat(ffpath, (err, attr) => {
							if(err) return done(err);
							expect(attr.uuid).to.deep.equal(uuidArr[0]);
							expect(attr.owner).to.deep.equal([uuidArr[1]]);
							expect(attr.writelist).to.deep.equal([]);
							expect(attr.readlist).to.deep.equal([uuidArr[2]]);
							expect(attr.hash).to.deep.equal(sha256_1);
							expect(attr.abspath).to.deep.equal(ffpath);
							done();
						});
					});
				});
			});
		});

	});

	describe('update data', () => {

		beforeEach(done => {
			rimraf(tmpFoder, err => {
				if(err) return done(err);
				mkdirp(tmpFoder, err => {
					if(err) return done(err);
					fs.writeFile(ffpath, '', err => {
						if(err) return done(err);
						fs.stat(ffpath, (err, stat) => {
							xattr.set(ffpath, FRUITMIX, JSON.stringify({
								uuid: uuidArr[0],
								owner: [uuidArr[1]],
								writelist: [uuidArr[2]],
								readlist: [uuidArr[3]],
								hash: sha256_1,
								htime: stat.mtime.getTime()
							}), err => {
								if(err) return done(err);
								done();
							});
						});
					});
				});
			});
		});

		// remove test foder
		after(() => {
			rimraf(tmpFoder, err => {
				if(err) throw new Error('delete tmpTestFoder failed');
			});
		});

		describe('updateXattrOwner', () => {

			it('should returns the owner value after the change', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrOwner(ffpath, uuidArr[0], [uuidArr[4],uuidArr[5]], (err, attr) => {
						if(err) return done(err);
						expect(attr.uuid).to.deep.equal(uuidArr[0]);
						expect(attr.owner).to.deep.equal([uuidArr[4],uuidArr[5]]);
						expect(attr.writelist).to.deep.equal([uuidArr[2]]);
						expect(attr.readlist).to.deep.equal([uuidArr[3]]);
						expect(attr.hash).to.deep.equal(sha256_1);
						expect(attr.htime).to.deep.equal(stat.mtime.getTime());
						done();
					});
				});
			});

			it('Should return error if UUID is not equal', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrOwner(ffpath, uuidArr[1], [uuidArr[4],uuidArr[5]], (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

		});

		describe('updateXattrPermission', () => {

			it('should returns the permission value after the change', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrPermission(ffpath, uuidArr[0], [uuidArr[4]], [uuidArr[5]], (err, attr) => {
						if(err) return done(err);
						expect(attr.uuid).to.deep.equal(uuidArr[0]);
						expect(attr.owner).to.deep.equal([uuidArr[1]]);
						expect(attr.writelist).to.deep.equal([uuidArr[4]]);
						expect(attr.readlist).to.deep.equal([uuidArr[5]]);
						expect(attr.hash).to.deep.equal(sha256_1);
						expect(attr.htime).to.deep.equal(stat.mtime.getTime());
						done();
					});
				});
			});

			it('should return error if UUID is not equal', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrPermission(ffpath, uuidArr[1], [uuidArr[4]], [uuidArr[5]], (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

		});

		describe('updateXattrHash', () => {

			it('should returns the hash value after the change', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHash(ffpath, uuidArr[0], sha256_2, stat.mtime.getTime(), (err, attr) => {
						if(err) return done(err);
						expect(attr.uuid).to.deep.equal(uuidArr[0]);
						expect(attr.owner).to.deep.equal([uuidArr[1]]);
						expect(attr.writelist).to.deep.equal([uuidArr[2]]);
						expect(attr.readlist).to.deep.equal([uuidArr[3]]);
						expect(attr.hash).to.deep.equal(sha256_2);
						expect(attr.htime).to.deep.equal(stat.mtime.getTime());
						done();
					});
				});
			});

			it('should return error if UUID is not equal', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHash(ffpath, uuidArr[1], sha256_2, stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});			

		});

		describe('updateXattrHashMagic', () => {

      it('should store hash and magic in xattr with correct htime (no htime before)', done => {

        let attr = {
          uuid: uuidArr[0],
          owner: []
        }
  
        xattr.set(ffpath, 'user.fruitmix', JSON.stringify(attr), err => {
          fs.stat(ffpath, (err, stat) => {
            updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, 'audio', stat.mtime.getTime(), (err, attr) => {
              if (err) return done(err)
              xattr.get(ffpath, 'user.fruitmix', (err, data) => {
                if (err) return done(err)
                let x = JSON.parse(data)
                expect(x.uuid).to.equal(uuidArr[0])
                expect(x.owner).to.deep.equal([])
                expect(x.hash).to.equal(sha256_2)
                expect(x.magic).to.equal('audio')
                expect(x.htime).to.equal(stat.mtime.getTime())
                done()
              })
            })
          })
        })
      })

			it('Need to return the modified hash and magic values', done => {
				fs.stat(ffpath, (err, stat) => {
					updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, 'audio', stat.mtime.getTime(), (err, attr) => {
						if(err) return done(err);
						expect(attr.uuid).to.deep.equal(uuidArr[0]);
						expect(attr.owner).to.deep.equal([uuidArr[1]]);
						expect(attr.writelist).to.deep.equal([uuidArr[2]]);
						expect(attr.readlist).to.deep.equal([uuidArr[3]]);
						expect(attr.hash).to.deep.equal(sha256_2);
						expect(attr.magic).to.deep.equal('audio');
						expect(attr.htime).to.deep.equal(stat.mtime.getTime());
						done();
					});
				});
			});

			it('should return error if UUID is not equal', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[1], sha256_2, 'audio', stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if hash value is a string', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], 'sha256_2', 'audio', stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if hash value is an object', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], { name: 'panda' }, 'audio', stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if hash value is an array', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], [1, 2,], 'audio', stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if typeof magic is an array', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, [1], stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if typeof magic is an object', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, { name: 'panda' }, stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if typeof magic is undefined', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, undefined, stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if the length of magic is 0', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, '', stat.mtime.getTime(), (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

			it('should return error if htime is not equal', done => {
				fs.stat(ffpath, (err, stat) => {
					if(err) return done(err);
					updateXattrHashMagic(ffpath, uuidArr[0], sha256_2, 'audio', stat.mtime.getTime()-1, (err, attr) => {
						expect(err).to.be.an('error');
						done();
					});
				});
			});

		});

	});

	describe('copyXattr', () => {
		beforeEach(done => {
			rimraf(tmpFoder, err => {
				if(err) return done(err);
				mkdirp(tmpFoder, err => {
					if(err) return done(err);
					fs.writeFile(ffpath, '', err => {
						if(err) return done(err);
						fs.stat(ffpath, (err, stat) => {
							xattr.set(ffpath, FRUITMIX, JSON.stringify({
								uuid: uuidArr[0],
								owner: [uuidArr[1]],
								writelist: [uuidArr[2]],
								readlist: [uuidArr[3]],
								hash: sha256_1,
								htime: stat.mtime.getTime()
							}), err => {
								if(err) return done(err);
								fs.writeFile(ffcopath, '', err => {
									if(err) return done(err);
									done();
								});
							});
						});						
					});
				})
			});
			
		});

		it('Need to return a copy of the value', done => {
			done();
		});

	});
	
});
