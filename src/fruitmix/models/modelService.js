import path from 'path'
import fs from 'fs'
import EventEmitter from 'events'

import bcrypt from 'bcrypt'
import UUID from 'node-uuid'
import ursa from 'ursa'
import crypt3 from 'crypt3'

import E from '../lib/error'
import { md4Encrypt } from '../tools'

const passwordEncrypt = (password, saltLen) =>
  bcrypt.hashSync(password, bcrypt.genSaltSync(saltLen));

const getCredentials = () => {
  let key         = ursa.generatePrivateKey(512, 65537);
  let privatePem  = ursa.createPrivateKey(key.toPrivatePem());
  let privateKey  = privatePem.toPrivatePem('utf8');
  let publicPem   = ursa.createPublicKey(key.toPublicPem());
  let publicKey   = publicPem.toPublicPem('utf8');
  return { publicKey, privateKey }
}

// Array.from(new Set[...arr1, ...arr2])
const getUnixPwdEncrypt = password =>
  crypt3(password, crypt3.createSalt('sha512').slice(0, 11))

const mergeAndDedup = (arr1, arr2) => {
  let arr = [];
  let set = new Set([...arr1, ...arr2]);
  for (let i of set)
    arr.push(i);
  return arr;
}

// complement
const arrDeleteArr = (arr1, arr2) => {
  let set = new Set(arr1);
  arr2.forEach(i => {
    if (set.has(i))
      set.delete(i);
  });
  let arr = [];
  for (let i of set)
    arr.push(i);
  return arr;
}

const isExist = (target, callback) =>
  fs.access(target, fs.constants.R_OK, err =>
    err ? callback(null, false) : callback(null, true));

const isExistAsync = Promise.promisify(isExist);

// TODO  
const fileToJson = (filepath, callback) => {
  fs.readFile(filepath, (err, data) => {
    if(err) return callback(err);
    try {
      return callback(null, JSON.parse(data));
    } catch (e) { return callback(e); }
  });
}
const fileToJsonAsync = Promise.promisify(fileToJson);

fs.readFileAsync
return JSON.parse

class ModelService extends EventEmitter {

  constructor(froot, modelData) {
    this.froot = froot
    this.modelData = modelData;
  }

  // TODO functional
  allocUnixUID() {
    let uids = this.modelData.users.filter(u => u.type === 'local').map(u => u.unixuid);
    let set = new Set(uids);
    // let uid = 2000;
    // while(set.has(uid)) { uid++; }
    let uid
    for (uid = 2000; set.has(uid); uid++) {} 
    return uid;
  }

  // 1. split logic to normal and fallback
  // 2. fallback need translation
  // 3. test real world data (users.json, drives.json)
  // 4. the only reason for fallback is err.code === ENOENT
  async initializeFallbackAsync () {
  }

  // opaque
  async initializeAsync() {

    let err = null;
    let users, drives;
    let modelPath = this.modelData.modelPath;
    let existM = await isExistAsync(modelPath);

    try {
      data = fs.readFileAsync(...)
    }
    catch (e) {
      if (e.code !== 'ENOENT') throw e
      return await init.. fallback
    }

    if (existM){
      // model.json exist
      try {
        let modelInfo = await fileToJsonAsync(modelPath);
        users = modelInfo.users;
        drives = modelInfo.drives;
      } catch (e) { err = e; }
    } else {
      // read user.json & drive.json
      try {
        users = await fileToJsonAsync(path.join(path.dirname(modelPath), 'user.json'));
        drives = await fileToJsonAsync(path.join(path.dirname(modelPath), 'drive.json'));
      } catch (e) {
        if (e.code !== 'ENOENT')
          err = e;
        else {
          users = [];
          drives = [];
        }
      }
    }
    if (err) throw err;
    await this.modelData.updateModelAsync(users, drives);
  }

	async createLocalUserAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = users.filter(u => u.isAdmin === true).map(u => u.uuid);
    if (users.length !== 0 && !admins.includes(useruuid))
      throw new Error('must be an administrator to create a user');
    if (props.type !== 'local')
      throw new Error('the new user type must be local');
    // install newUser
    let {
      type, username, password, nologin, isFirstUser,
      isAdmin, email, avatar, unixname
    } = props;
    // user uuid
    let uuid = UUID.v4();

    if (nologin !== true) nologin = false;
    if (isAdmin !== true) isAdmin = false;
    if (isFirstUser !== true) isFirstUser = false;
    if (users.length === 0){
      isFirstUser = true;
      isAdmin = true;
    }

    email = email || null;
    avatar = avatar || null;

    let home = UUID.v4();
    let library = UUID.v4();
    let service = UUID.v4();
    // alloc unix uid
    let unixuid = this.allocUnixUID();
    let lastChangeTime = new Date().getTime();

    let passwordEncrypted = passwordEncrypt(password, 10);
    let unixPassword = getUnixPwdEncrypt(password);
    let smbPassword = md4Encrypt(password);

    let friends = [];
    // get credentials
    let credentials = getCredentials();

    let newUser = {
      type, uuid, username, nologin, isFirstUser, isAdmin,
      email, avatar, home, library, service, unixuid,
      unixname, lastChangeTime, credentials, friends,
      unixPassword, smbPassword,
      password: passwordEncrypted, 
    };
    // install newDrives
    let common = { owner: uuid, type: 'private' };
    let homeDrive     = Object.assign({}, common, { uuid: home, label: 'home' });
    let libraryDrive  = Object.assign({}, common, { uuid: library, label: 'library' });
    let serviceDrive  = Object.assign({}, common, { uuid: service, label: 'service' });
    let newDrives = [ homeDrive, libraryDrive, serviceDrive ];
    try {
      await this.modelData.createUserAsync(newUser, newDrives);
    } catch (e) { throw e; }

    // 1. return user object, password, cert filtered out
    // 2. no try catch
    // 3. emit 
    this.emit('drivesCreated', newDrives) // ???  TODO newDrives may be different from that in modelData
	}

	async createRemoteUserAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = users.filter(u => u.isAdmin === true).map(u => u.uuid);
    if (!admins.includes(useruuid)) throw new Error('must be an administrator to create a user');
    if (props.type !== 'remote') throw new Error('the new user type must be remote');
    // install newUser
    let type = 'remote';
    let username = props.username;
    let uuid = UUID.v4();
    let email = props.email || null;
    let avatar = props.email || null;
    let service = UUID.v4();
    let newUser = { type, uuid, username, email, avatar, service };
    // install newdrives
    let newDrives = [{
      uuid: service,
      type: 'private',
      owner: uuid,
      label: 'remote service'
    }]
    try {
      await this.modelData.createUserAsync(newUser, newDrives);
    } catch (e) { throw e; }
  }

	async updateUser(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = users.filter(u => u.isAdmin === true).map(u => u.uuid);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && props.uuid !== useruuid)
      throw new Error('no permission to modify user information');
    // install user
    let user = users.find(u => u.uuid === props.uuid);
    let next = Object.assign({}, user, props );
    try {
      await this.modelData.updateUserAsync(next);
    } catch (e) { throw e; }
  }

  // props: { password, uuid }
	async updatePasswordAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = users.filter(u => u.isAdmin === true).map(u => u.uuid);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && props.uuid !== useruuid)
      throw new Error('no permission to modify user password');
    // install user
    let user = users.find(u => u.uuid === props.uuid);

    let password = passwordEncrypt(props.password, 10);
    let unixPassword = getUnixPwdEncrypt(props.password);
    let smbPassword = md4Encrypt(props.password);
    let lastChangeTime = new Date().getTime();

    let next = Object.assign({}, user, { password, unixPassword, smbPassword, lastChangeTime });
    try {
      await this.modelData.updateUserAsync(next, props.password);
      // this.modelData.updatePasswordAsync
    } catch (e) { throw e; }
  }

	// props: { uuid, friends: [] }
	async createFriendAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = users.filter(u => u.isAdmin === true).map(u => u.uuid);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && props.uuid !== useruuid)
      throw new Error('no permission to create friend');
    // install user
    let user = users.find(u => u.uuid === props.uuid);
    let newFriends = mergeAndDedup(user.friends, props.friends);

    let next = Object.assign({}, user, { friends: newFriends });
    try {
      await this.modelData.updateUserAsync(next);
    } catch (e) { throw e; }
  }

	// props: { uuid, friends: [] }
	async deleteFriendAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = users.filter(u => u.isAdmin === true).map(u => u.uuid);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && props.uuid !== useruuid)
      throw new Error('no permission to delete friend');
    // install user
    let user = users.find(u => u.uuid === props.uuid);
    let newFriends = arrDeleteArr(user.friends, props.friends);

    let next = Object.assign({}, user, { friends: newFriends });
    try {
      await this.modelData.updateUserAsync(next);
    } catch (e) { throw e; }
  }

  // pros: { uuid, label }
	async createPublicDriveAsync(useruuid, props) {
    // check permission ---- all user can create public drive ???
    let users = this.modelData.users.map(u => u.uuid);
    if (!users.includes(useruuid))
      throw new Error('no permission to create public drive');
    //install new drive
    let uuid = UUID.v4();
    let type = 'public';
    let writelist = props.writelist || [];
    let readlist = props.readlist || [];
    let shareAllowed = props.shareAllowed === true ? true : false;
    let label = props.label;

    let newDrive = { uuid, type, label, writelist, readlist, shareAllowed };
    try {
      await this.modelData.createDriveAsync(newDrive);
    } catch (e) { throw e; }
  }

	async updatePublicDriveAsync(useruuid, props) {
    // check permission  --- all user can update public drive ???
    let users = this.modelData.users.map(u => u.uuid);
    if (!users.includes(useruuid))
      throw new Error('no permission to create public drive');
    // install next drive
    let drives = this.modelData.drives;
    let drive = drives.find(d => d.uuid === props.uuid);

    let next = Object.assign({}, drive, props);
    try {
      await this.modelData.updateDriveAsync(next);
    } catch (e) { throw e; }
  }

  // props: { driveuuid }
	async deletePublicDriveAsync(useruuid, props) {
    // check permission  --- all user can delete public drive ???
    let users = this.modelData.users.map(u => u.uuid);
    if (!users.includes(useruuid))
      throw new Error('no permission to create public drive');
    // delete
    try {
      await this.modelData.deleteDriveAsync(props.driveuuid);
    } catch (e) { throw e; }
  }

}

const createModelService = async (modelData, callback) => {
  let modelService = new ModelService(modelData);
  try {
    await modelService.initializeAsync();
    callback(null, modelService);
  } catch (e) { callback(e) }
}

const createModelService = froot => {

  let data = createModelData(froot)
  return new ModelService(froot, data)
} 

const createModelServiceAsync = Promise.promisify(createModelService);

export default createModelServiceAsync

