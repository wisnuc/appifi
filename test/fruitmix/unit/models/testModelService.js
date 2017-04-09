import path from 'path'
import fs from 'fs'
import { expect } from 'chai'
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import createModelData from '../../../../src/fruitmix/models/modelData'
import createModelService from '../../../../src/fruitmix/models/modelService'

Promise.promisifyAll(fs);

const uuid_1 = "5da92303-33a1-4f79-8d8f-a7b6becde6c3";
const uuid_2 = "b9aa7c34-8b86-4306-9042-396cf8fa1a9c";
const uuid_3 = "f97f9e1f-848b-4ed4-bd47-1ddfa82b2777";
const uuid_4 = "f97f9e1f-848b-4ed4-bd47-1ddfa82b5432";
// new format
const users = [{
  type: 'local',//
	uuid: uuid_1,//
  username: 'panda',//
  nologin: false,//
  avatar: null,//
  email: null,//
  isFirstUser: true,//
  isAdmin: true,//
  home: uuid_2,//
  library: uuid_3,//
  service: uuid_4,//
  password: '$2a$10$ejkgWk/ChHcLyZiic1H2CeLdoVcz15eZ/3Lymj1ncimVvq6E7OvWy',//
  unixPassword: 'some str',
  smbPassword: 'some str',//
  unixuid: 2000,//
  unixname: 'pandaa',
  friends:[],//
  // credentials:{	//
  // 	publicKey: 'some str',
  // 	privateKey: 'some str'
  // },
  lastChangeTime: 1489644639494	//
}];
const drives = [{
  uuid: uuid_2,
  owner: uuid_1,
  type: 'private',
  label: 'home'
},{
  uuid: uuid_3,
  owner: uuid_1,
  type: 'private',
  label: 'library'
},{
  uuid: uuid_4,
  owner: uuid_1,
  type: 'private',
  label: 'service'
}];

// old format
const oldUsers = [{
  type: "local",
  uuid: "1c2f3cbc-2fb8-4090-a5a2-a6f5ad6bc239",
  username: "admin",
  password: "$2a$10$eOOjxAZrOIaQBS9rkj/CVO.vrNar3ObX5as.6grZnZGbacQe5z6HG",
  smbPassword: "209C6174DA490CAEB422F3FA5A7AE634",
  lastChangeTime: 1489720270682,
  avatar: null,
  email: null,
  isAdmin: true,
  isFirstUser: true,
  home: "b62001f7-61b7-4a40-9b8f-283a5078867a",
  library: "42c564b0-2b87-4af1-af1b-22c2ef2e7c3f",
  unixUID: 2000
 }];

const oldDrives = [{
  label: "admin-home",
  fixedOwner: true,
  URI: "fruitmix",
  uuid: "b62001f7-61b7-4a40-9b8f-283a5078867a",
  owner: [ "1c2f3cbc-2fb8-4090-a5a2-a6f5ad6bc239" ],
  writelist: [],
  readlist: [],
  cache: true
 },{
 	label: "admin-library",
  fixedOwner: true,
  URI: "fruitmix",
  uuid: "42c564b0-2b87-4af1-af1b-22c2ef2e7c3f",
  owner: [ "1c2f3cbc-2fb8-4090-a5a2-a6f5ad6bc239" ],
  writelist: [],
  readlist: [],
  cache: true
}];

const rimrafAsync = Promise.promisify(rimraf);
const mkdirpAsync = Promise.promisify(mkdirp);

describe(path.basename(__filename), () => {

	let cwd = process.cwd();
	let tmptest = path.join(cwd, 'tmptest');
	let mfile = path.join(cwd, 'tmptest/models/model.json');
	let ufile = path.join(cwd, 'tmptest/models/users.json');
	let dfile = path.join(cwd, 'tmptest/models/drives.json');
	let model = null;

	const dataToFile = (data, file, callback) => {
		let json = JSON.stringify(data, null, '  ');
		fs.writeFile(file, json, err => {
			if(err) return callback(err);
			callback(null);
		});
	}
	const dataToFileAsync = Promise.promisify(dataToFile);

	describe('non-existent model.json & non-existent user.json & non-existent drive.json', () => {

		before(async (done) => {
			await rimrafAsync(mfile);
			await rimrafAsync(ufile);
			await rimrafAsync(dfile);
			await mkdirpAsync(path.join(cwd, 'tmptest/models'));
			await mkdirpAsync(path.join(cwd, 'tmptest/tmp'));
			model = createModelService(tmptest);
			await model.initializeAsync();
			done();
		});
		it('empty users Array & enpty drives Array', done => {
			fs.readFile(mfile, (err, data) => {
				if(err) return done(err);
				let res = JSON.parse(data.toString());
				expect(model.modelData.users).to.deep.equal(res.users);
				expect(model.modelData.drives).to.deep.equal(res.drives);
				done();
			});
		});
	});

	describe('non-existent model.json & exist user.json & exist drive.json', () => {

		before(async (done) => {
			await rimrafAsync(mfile);
			// create tmptest folder
			await mkdirpAsync(tmptest);
			await mkdirpAsync(path.join(cwd, 'tmptest/models'));
			await mkdirpAsync(path.join(cwd, 'tmptest/tmp'));
			// create user.json & drive.json
			await dataToFileAsync(oldUsers, ufile);
			await dataToFileAsync(oldDrives, dfile);
			model = createModelService(tmptest);
			await model.initializeAsync();
			done();
		});
		it('user.json and drive.json information combination model.json', done => {
			fs.readFile(mfile, (err, data) => {
				if(err) return done(err);
				let res = JSON.parse(data.toString());
				expect(model.modelData.users).to.deep.equal(res.users);
				expect(model.modelData.drives).to.deep.equal(res.drives);
				done();
			});
		});
	});

	describe('exist model.json', () => {

		before(async (done) => {
			await rimrafAsync(dfile);
			await rimrafAsync(ufile);
			// create tmptest folder
			await mkdirpAsync(tmptest);
			await mkdirpAsync(path.join(cwd, 'tmptest/models'));
			await mkdirpAsync(path.join(cwd, 'tmptest/tmp'));
			// create user.json
			let data = Object.assign({}, { version: 1, users, drives });
			await dataToFileAsync(data, mfile);
			model = createModelService(tmptest);
			await model.initializeAsync();
			done();
		});
		it('read model.json', done => {
			fs.readFile(mfile, (err, data) => {
				if(err) return done(err);
				let res = JSON.parse(data.toString());
				expect(model.modelData.users).to.deep.equal(res.users);
				expect(model.modelData.drives).to.deep.equal(res.drives);
				done();
			});
		});
	});

	describe('test operation users & drives', () => {

		beforeEach(async done => {
			// create tmptest folder
			await mkdirpAsync(tmptest);
			await mkdirpAsync(path.join(cwd, 'tmptest/models'));
			await mkdirpAsync(path.join(cwd, 'tmptest/tmp'));
			// create user.json
			let data = Object.assign({}, { version: 1, users, drives });
			await dataToFileAsync(data, mfile);
			model = createModelService(tmptest);
			await model.initializeAsync();
			done();
		});
		it('create local user', async done => {
			let props = {
				type: 'local',
				username: 'pandac',
				unixname: 'hello',
				password: 'world',
			};
			try {
				await model.createLocalUserAsync({ useruuid: uuid_1, props });
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});					
			} catch (e) { done(e); }
		});

		it('create remote user', async done => {
			let props = {
				type: 'remote',
				username: 'panda remote',
				label: 'remote service'
			};
			try {
				await model.createRemoteUserAsync({ useruuid: uuid_1, props });
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch (e) { done(e); }
		});

		it('update admin', async done => {
			try {
				await model.updateUserAsync({ useruuid:uuid_1, props: { username : 'pandaa', uuid: uuid_1 } });
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch (e) { done(e); }
		});

		it('update user', async done => {
			let props = {
				type: 'local',
				username: 'pandab',
				unixname: 'hello',
				password: 'world',
			};
			try {
				await model.createLocalUserAsync({ useruuid: uuid_1, props });
				let uuid = model.modelData.users.filter(u => u.username === 'pandab').map(u => u.uuid);
				await model.updateUserAsync({ useruuid: uuid[0], props: { username : 'pandac' } });
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch (e) { done(e); }
		});

		it('update password', async done => {
			try {
				await model.updatePasswordAsync({ useruuid: uuid_1, pwd: 'hello' })
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch(e) { done(e); } 
		});

		it('create friends', async done => {
			try {
				await model.createFriendAsync(uuid_1, uuid_2);
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch(e) { done(e); }
		});

		it('delete friends', async done => {
			try {
				await model.createFriendAsync(uuid_1, uuid_2);
				await model.createFriendAsync(uuid_1, uuid_3);
				await model.deleteFriendAsync(uuid_1, uuid_2);
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch(e) { done(e); }
		});

		it('create public dirve', async done => {
			try {
				await model.createPublicDriveAsync(uuid_1,
						{ label: 'public driveB' });
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch(e) { done(e); }
		});

		it('update public drive', async done => {
			try {
				await model.createPublicDriveAsync(uuid_1,
						{ label: 'public driveA' });
				let duuid = model.modelData.drives
					.filter(d => d.type === 'public')
					.map(d => d.uuid);
				await model.updatePublicDriveAsync(uuid_1,
						{ uuid: duuid[0], label: 'public driveB' });
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch(e) { done(e); }
		});

		it('delete public dirve', async done => {
			try {
				await model.createPublicDriveAsync(uuid_1,
						{ label: 'public driveA' });
				await model.createPublicDriveAsync(uuid_1,
						{ label: 'public driveB' });

				let duuid = model.modelData.drives
					.filter(d => d.type === 'public')
					.map(d => d.uuid);
				await model.deletePublicDriveAsync(uuid_1,
						{ driveuuid: duuid[0] });

				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.modelData.users).to.deep.equal(res.users);
					expect(model.modelData.drives).to.deep.equal(res.drives);
					done();
				});
			} catch(e) { done(e); }
		});

		it('determine whether local users', done => {
			model.isLocalUser(uuid_1, (err, isLocal) => {
				if(err) return done(err);
				expect(isLocal).to.be.true;
				done();
			});
		});

		it('get drive info by driveuuid', done => {
			model.getDriveInfo(uuid_2, (err, drive) => {
				if(err) return done(err);
				expect(drive.owner).to.equal(uuid_1);
				expect(drive.type).to.equal('private');
				expect(drive.label).to.equal('home');
				expect(drive.ownername).to.equal('panda');
				done();
			});
		});

	});

});