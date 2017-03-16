import path from 'path'
import fs from 'fs'
import { expect } from 'chai'
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import createModelData from 'src/fruitmix/models/modelData'
import createModelServiceAsync from 'src/fruitmix/models/modelService'

Promise.promisifyAll(fs);

const uuid_1 = "5da92303-33a1-4f79-8d8f-a7b6becde6c3";
const uuid_2 = "b9aa7c34-8b86-4306-9042-396cf8fa1a9c";
const uuid_3 = "f97f9e1f-848b-4ed4-bd47-1ddfa82b2777";
const users = [{
  type: 'local',
	uuid: uuid_1,
  username: 'panda',
  password: '$2a$10$ejkgWk/ChHcLyZiic1H2CeLdoVcz15eZ/3Lymj1ncimVvq6E7OvWy',
  avatar: null,
  email: null,
  isFirstUser: true,
  isAdmin: true,
  home: uuid_2,
  library: uuid_3,
}];
const drives = [{
	label: 'panda home',
  uuid: uuid_2,
  owner: [ uuid_1 ],
  type: 'private'
}];

const rimrafAsync = Promise.promisify(rimraf);
const mkdirpAsync = Promise.promisify(mkdirp);

describe(path.basename(__filename), () => {

	let cwd = process.cwd();
	let tmptest = path.join(cwd, 'tmptest');
	let mfile = path.join(cwd, 'tmptest', 'model.json');
	let ufile = path.join(cwd, 'tmptest', 'user.json');
	let dfile = path.join(cwd, 'tmptest', 'drive.json');
	let tmpfolder = path.join(cwd, 'tmptest', 'tmpfolder');
	let modelData = createModelData(mfile, tmpfolder);
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
			model = await createModelServiceAsync(modelData);
			done();
		});
		it.only('empty users Array & enpty drives Array', done => {
			fs.readFile(mfile, (err, data) => {
				if(err) return done(err);
				let res = JSON.parse(data.toString());
				expect(model.users).to.deep.equal(res.users);
				expect(model.drives).to.deep.equal(res.drives);
				done();
			});
		});
	});

	describe('non-existent model.json & exist user.json & exist drive.json', () => {

		before(async (done) => {
			await rimrafAsync(mfile);
			// create tmptest folder
			await mkdirpAsync(tmptest);
			// create user.json & drive.json
			await dataToFileAsync(users, ufile);
			await dataToFileAsync(drives, dfile);
			model = await createModelAsync(mfile, ufile, dfile, tmpfolder);
			done();
		});
		it('user.json and drive.json information combination model.json', done => {
			fs.readFile(mfile, (err, data) => {
				if(err) return done(err);
				let res = JSON.parse(data.toString());
				expect(model.users).to.deep.equal(res.users);
				expect(model.drives).to.deep.equal(res.drives);
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
			// create user.json
			let modelData = Object.assign({}, { version: 1, users, drives });
			await dataToFileAsync(modelData, mfile);
			model = await createModelAsync(mfile, ufile, dfile, tmpfolder);
			done();
		});
		it('user.json and drive.json information combination model.json', done => {
			fs.readFile(mfile, (err, data) => {
				if(err) return done(err);
				let res = JSON.parse(data.toString());
				expect(model.users).to.deep.equal(res.users);
				expect(model.drives).to.deep.equal(res.drives);
				done();
			});
		});
	});

	describe('test operation users & drives', () => {

		beforeEach(async done => {
			// create tmptest folder
			await mkdirpAsync(tmptest);
			// create user.json
			let modelData = Object.assign({}, { version: 1, users: [], drives: [] });
			await dataToFileAsync(modelData, mfile);
			model = await createModelAsync(mfile, ufile, dfile, tmpfolder);
			done();
		});
		it('create local user', async done => {
			let props = {
				type: 'local',
				username: 'panda',
				unixname: 'hello',
				password: 'world',
				email: 'wangpanhn@qq.com',
				isAdmin: true
			};
			try {
				await model.createUserAsync(props);
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.users).to.deep.equal(res.users);
					expect(model.drives).to.deep.equal(res.drives);
					done();
				});					
			} catch (e) {
				done(e);
			}
		});

		it('update user', async done => {
			let props = {
				type: 'local',
				username: 'panda',
				unixname: 'hello',
				password: 'world',
				email: 'wangpanhn@qq.com',
				isAdmin: true
			};
			try {
				await model.createUserAsync(props);
				let uuid = model.users[0].uuid;
				await model.updateUserAsync(uuid, { username : 'pandaa'});
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.users).to.deep.equal(res.users);
					expect(model.drives).to.deep.equal(res.drives);
					done();
				});
			} catch (e) {
				done(e);
			}
		});

		it('create service drives', async done => {
			let props = {
				type: 'service',
				label: 'panda service drive'
			};
			try {
				await model.createDriveAsync(props);
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.users).to.deep.equal(res.users);
					expect(model.drives).to.deep.equal(res.drives);
					done();
				});
			} catch (e) {
				done(e);
			}
		});

		it('update service drives', async done => {
			let props = {
				type: 'service',
				label: 'panda service drive'
			};
			try {
				await model.createDriveAsync(props);
				let uuid = model.drives[0].uuid;
				await model.updateDriveAsync(uuid, { label: 'pandaa service drive'});
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.users).to.deep.equal(res.users);
					expect(model.drives).to.deep.equal(res.drives);
					done();
				});
			} catch (e) {
				done(e);
			}
		});

		it('delete drive', async done => {
			let prop1 = {
				type: 'service',
				label: 'a service drive'
			};
			let prop2 = {
				type: 'service',
				label: 'b service drive'
			};
			try {
				await model.createDriveAsync(prop1);
				await model.createDriveAsync(prop2);
				let uuid = model.drives[0].uuid;
				await model.deleteDriveAsync(uuid);
				fs.readFile(mfile, (err, data) => {
					if(err) return done(err);
					let res = JSON.parse(data.toString());
					expect(model.users).to.deep.equal(res.users);
					expect(model.drives).to.deep.equal(res.drives);
					done();
				});
			} catch (e) {
				done(e);
			}
		});

	});

});