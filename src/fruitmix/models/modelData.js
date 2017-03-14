
import EventEmitter from 'events'
import E from '../lib/error'
import fs from 'fs'
import UUID from 'node-uuid'
import mkdirp from 'mkdirp'
import validator from 'validator'
import ursa from 'ursa'
import bcrypt from 'bcrypt'
import { md4Encrypt } from '../tools'
import path from 'path'
import { isUUID } from '../lib/types'

Promise.promisifyAll(fs);
const mkdirpAsync = Promise.promisify(mkdirp);

const isExist = (target, callback) =>
  fs.access(target, fs.constants.R_OK, err =>
    err ? callback(null, false) : callback(null, true));
const isExistAsync = Promise.promisify(isExist);

const fileToJson = (filepath, callback) => {
  fs.readFile(filepath, (err, data) => {
    if(err) return callback(err);
    try {
      return callback(null, JSON.parse(data));
    } catch (e) { return callback(e); }
  });
}
const fileToJsonAsync = Promise.promisify(fileToJson);

class ModelData extends EventEmitter {

	constructor(mfilepath, ufilepath, dfilepath, tmpfolder) {
		super();
		this.lock = false;
		this.users = [];
		this.drives = [];
    this.modelFilePath = mfilepath; // model.json path
    this.userFilePath = ufilepath;  // user.json path
    this.drivefilePath = dfilepath; // drive.json path
    this.tmpfolder = tmpfolder;
    this.version = null;
  	// user
  	this.increment = 2000;
  	this.eset = new Set();	// local user set
  	this.has = UUID.v4();
	}

  getLock() {
    if (this.lock === true) throw new E.ELOCK('expect unlocked,actually locked');
    this.lock = true;
  }

  putLock() {
    if (this.lock === false) throw new E.ELOCK('expect locked,actually unlocked');
    this.lock = false;
  }

	allocUnixUID() {
		while (this.eset.has(this.increment)) this.increment++
    return this.increment++
	}

	setModelData(data) {
		this.users = data.users;
		this.drives = data.drives;
		this.version = data.version;
	}

	async saveAsync(data) {
		await mkdirpAsync(this.tmpfolder);
    let tmpfile = path.join(this.tmpfolder, UUID.v4());
    let json = JSON.stringify(data, null, '  ');
    await fs.writeFileAsync(tmpfile, json);
    await fs.renameAsync(tmpfile, this.modelFilePath);
	}

	async initializeAsync() {
		if (this.lock) throw new E.ELOCK();
    this.getLock();
    let err = null;
    let modelInfo;
    let dirty = false;
    let existM = await isExistAsync(this.modelFilePath);
    if (existM){
      // model.json exist
      try {
        modelInfo = await fileToJsonAsync(this.modelFilePath);
        if (!Array.isArray(modelInfo.users) || !Array.isArray(modelInfo.drives) || modelInfo.version === undefined)
          err = new E.EDOCFORMAT('Model file format is not correct');
      } catch (e) { err = e; }
    } else {
      // model.json non-existent, read user.json & drive.json
      dirty = true;
      try {
        let users = await fileToJsonAsync(this.userFilePath);
        let drives = await fileToJsonAsync(this.drivefilePath);
        if(!Array.isArray(users) || !Array.isArray(drives))
          // format is not correct
          err = new E.EDOCFORMAT('user or drive file format is not correct');
        else 
          modelInfo = Object.assign({}, { version: 1, users, drives });
      } catch (e) {
        if (e.code !== 'ENOENT')
          err = e;
        else
          modelInfo = Object.assign({}, { version: 1, users: [], drives: [] });
      }
    }
    this.putLock();
    if (err) throw err;
    // save or not save
    if (dirty) await this.saveAsync(modelInfo);
    // set model users & drives data
    this.setModelData(modelInfo);
    this.users.forEach(user => {
      if (user.type === 'local')
        this.eset.add(user.unixUID);
    });
	}

	createLocalUser(user, props, callback) {}
}

const createModelData = async (mfilepath, ufilepath, dfilepath, tmpfolder, callback) => {
	let modelData = new ModelData(mfilepath, ufilepath, dfilepath, tmpfolder);
	try {
		await modelData.initializeAsync();
		callback(null, modelData);
	} catch (err) {
		callback(err);
	}
}

const createModelDataAsync = Promise.promisify(createModelData);

export {
	createModelData,
	createModelDataAsync
}