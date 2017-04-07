import path from 'path'
import { expect } from 'chai'
import request from 'supertest'
import Promise from 'bluebird'
import crypto from 'crypto'
import { mkdirpAsync, rimrafAsync, fs } from 'test/fruitmix/unit/util/async'

describe(path.basename(__filename), () => {

	let token;
	let rootDrive;
	let uuidA;
	let uuidB;
	const app = '192.168.203.133:3721';
	const aliceUUID = "5da92303-33a1-4f79-8d8f-a7b6becde6c3";
	const aliceHomeDriveUUID = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c';

	const getToken = (callback) => {
		request(app)
			.get('/token')
			.auth(aliceUUID, '123456')
			.set('Accept', 'application/json')
			.end((err, res) => err ? callback(err) : callback(null, res.body.token))
	};
	const getTokenAsync = Promise.promisify(getToken);

	const getRootDrive = (callback) => {
		request(app)
	    .get('/drives')
	    .set('Authorization', 'JWT ' + token)
	    .set('Accept', 'application/json')
	    .end((err, res) => err ? callback(err) : callback(null, res.body))
	};
	const getRootDriveAsync = Promise.promisify(getRootDrive);

	const creatFolder = (drive, foldername, callback) => {
		console.log('=====prepare create folder, name: ' + foldername + '=====')
		request(app)
      .post(`/files/${drive}`)
      .set('Authorization', 'JWT ' + token)
      .set('Accept', 'applicatoin/json')
      .send({ name: foldername })
      .end((err, res) => err ? callback(err) : callback(null, res.body.uuid)) 
	};
	const creatFolderAsync = Promise.promisify(creatFolder);

	const delFileOrFolder = (parentuuid, selfuuid, callback) => {
		console.log(`======prepare delete======`)
		request(app) 
      .del(`/files/${parentuuid}/${selfuuid}`)
      .set('Authorization', 'JWT ' + token) 
      .set('Accept', 'application/json')
      .end((err, res) => err ? callback(err) : callback(null, res.body));
	};
	const delFileOrFolderAsync = Promise.promisify(delFileOrFolder);

	const uploadFile = (driveuuid, target, callback) => {
		console.log(`prepare upload file, file name: ${target}`);
		let buf = Buffer.from('0123456789ABCDEF', 'hex')
    let hash = crypto.createHash('sha256')
    hash.update(buf)
    let sha256 = hash.digest().toString('hex')
    fs.writeFileSync(target, buf)
    request(app)
      .post(`/files/${driveuuid}`)
      .set('Authorization', 'JWT ' + token)
      .set('Accept', 'applicatoin/json')
      .attach('file', target)
      .field('sha256', sha256)
      .end((err, res) => err ? callback(err) : callback(null, res.body))
	};
	const uploadFileAsync = Promise.promisify(uploadFile);

	beforeEach(() => {
		return (async ()=>{
			// get token
			token = await getTokenAsync();
			// get drive uuid
			rootDrive = aliceHomeDriveUUID
			// rootDrive = await getRootDriveAsync();
			console.log('=====rootDrive=====')
			console.log(rootDrive)

			uuidA = await creatFolderAsync(rootDrive, 'testa');
			console.log('=====uuidA=====')
			console.log(uuidA)
			uuidB = await creatFolderAsync(uuidA, 'testb');
			console.log('=====uuidB=====')
			console.log(uuidB)
			await uploadFileAsync(uuidB, '/home/panda/project/a.js');
			await uploadFileAsync(uuidB, '/home/panda/project/b.js');
			await uploadFileAsync(uuidB, '/home/panda/project/c.js');
			await uploadFileAsync(uuidB, '/home/panda/project/d.js');
			await uploadFileAsync(uuidB, '/home/panda/project/e.js');
		})()
	});

	it('should delete success', done => {
		return (async () => {
			let resDelete = await delFileOrFolderAsync(rootDrive, uuidA);
			console.log('=====resDelete=====')
			console.log(resDelete);
			done();
		})()
	});

});