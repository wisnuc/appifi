
import E from '../lib/error'
import path from 'path'
import fs from 'fs'
import UUID from 'node-uuid'
import bcrypt from 'bcrypt'
import { md4Encrypt } from '../tools'
import ursa from 'ursa'

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

const mergeAndDedup = (arr1, arr2) => {
  let arr = [];
  let set = new Set([...arr1, ...arr2]);
  for (let i of set)
    arr.push(i);
  return arr;
}

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

const fileToJson = (filepath, callback) => {
  fs.readFile(filepath, (err, data) => {
    if(err) return callback(err);
    try {
      return callback(null, JSON.parse(data));
    } catch (e) { return callback(e); }
  });
}
const fileToJsonAsync = Promise.promisify(fileToJson);

class ModelService {

  constructor(modelData) {
    this.modelData = modelData;
  }

  // TODO functional
  allocUnixUID() {
    let uids = this.modelData.users.filter(u => u.type === 'local').map(u => u.unixuid);
    let set = new Set(uids);
    let uid = 2000;
    while(set.has(uid)) { uid++; }
    return uid;
  }

  // opaque
  async initializeAsync() {

    if (this.modelData.lock) throw new E.ELOCK();
    this.modelData.getLock();
    let err = null;
    let users, drives;
    let modelPath = this.modelData.modelPath;
    let existM = await isExistAsync(modelPath);

    if (existM){
      // model.json exist
      try {
        let modelInfo = await fileToJsonAsync(modelPath);
        users = modelInfo.users;
        drives = modelinfo.drives;
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
    let admins = user.filter(u => u.isAdmin === true)
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
    if (user.length === 0){
      isFirstUser = true;
      isAdmin = true;
    }

    email = email || null;
    avatar = avata || null;

    let home = UUID.v4();
    let library = UUID.v4();
    let service = UUID.v4();
    // alloc unix uid
    let unixuid = this.allocUnixUID();
    let lastChangeTime = new Date().getTime();

    let passwordEncrypted = passwordEncrypt(password, 10);
    let unixPassword = passwordEncrypt(password, 8);    //???
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
    let homeDrive     = Object.assign({}, common, { uuid: home,     label: 'home' });
    let libraryDrive  = Object.assign({}, common, { uuid: library,  label: 'library' });
    let serviceDrive  = Object.assign({}, common, { uuid: service,  label: 'service' });
    let newDrives = [ homeDrive, libraryDrive, serviceDrive ];
    try {
      await this.modelData.createUserAsync(newUser, newDrives);
    } catch (e) { throw e; }
	}

	async createRemoteUserAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = user.filter(u => u.isAdmin === true)
    if (!admins.includes(useruuid)) throw new Error('must be an administrator to create a user');
    if (props.type !== 'remote') throw new Error('the new user type must be remote');
    // install newUser
    let type = 'remote';
    let uuid = UUID.v4();
    let email = props.email || null;
    let avatar = props.email || null;
    let service = UUID.v4();
    let lastChangeTime = new Date.getTime();
    let newUser = { type, uuid, username, email, avatar, service, lastChangeTime };
    // install newdrives
    let newDrives = {
      label: 'service',
      uuid: service,
      type: 'service'
    }
    try {
      await this.modelData.createUserAsync(newUser, newDrives);
    } catch (e) { throw e; }
  }

	async updateLocalUser(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = user.filter(u => u.isAdmin === true);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && porps.uuid !== useruuid)
      throw new Error('no permission to modify user information');
    // install user
    let user = users.find(u => u.uuid === props.uuid);
    let lastChangeTime = new Date().getTime();
    let next = Object.assign({}, user, props, { lastChangeTime });
    try {
      await this.modelData.updateUserAsync(next);
    } catch (e) { throw e; }
  }

  // props: { password, uuid }
	async updatePasswordAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = user.filter(u => u.isAdmin === true);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && props.uuid !== useruuid)
      throw new Error('no permission to modify user password');
    // install user
    let user = users.find(u => u.uuid === props.uuid);

    let password = passwordEncrypt(props.password, 10);
    let unixPassword = passwordEncrypt(props.password, 8);    //???
    let smbPassword = md4Encrypt(props.password);
    let lastChangeTime = new Date.getTime();

    let next = Object.assign({}, user, { password, unixPassword, smbPassword, lastChangeTime });
    try {
      await this.modelData.updateUserAsync(next, pwd);
    } catch (e) { throw e; }
  }

	// props: { uuid, friends: [] }
	async createFriendAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = user.filter(u => u.isAdmin === true);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && props.uuid !== useruuid)
      throw new Error('no permission to create friend');
    // install user
    let user = users.find(u => u.uuid === props.uuid);
    let newFriends = mergeAndDedup(user.friends, props.friends);
    let lastChangeTime = new Date().getTime();

    let next = Object.assign({}, user, { friends: newFriends, lastChangeTime });
    try {
      await this.modelData.updateUserAsync(next);
    } catch (e) { throw e; }
  }

	// props: { uuid, friends: [] }
	async deleteFriendAsync(useruuid, props) {
    // check permission
    let users = this.modelData.users;
    let admins = user.filter(u => u.isAdmin === true);
    // Not an administrator && not oneself
    if (!admins.includes(useruuid) && props.uuid !== useruuid)
      throw new Error('no permission to delete friend');
    // install user
    let user = users.find(u => u.uuid === props.uuid);
    let newFriends = arrDeleteArr(user.friends, props.friends);
    let lastChangeTime = new Date().getTime();

    let next = Object.assign({}, user, { friends: newFriends, lastChangeTime });
    try {
      await this.modelData.updateUserAsync(next);
    } catch (e) { throw e; }
  }

	async createPublicDriveAsync(useruuid, props) {
    // check permission ---- all user can create public drive ???
    let users = this.modelDate.users;
    if (!users.includes(useruuid))
      throw new Error('no permission to create public drive');
    //install new drive
    let uuid = UUID.v4();
    let type = props.type;
    let writelist = props.writelist || [];
    let readlist = props.readlist || [];
    let shareAllowed = props.shareAllowed === true ? true : false;

    let newDrive = { uuid, type, writelist, readlist, shareAllowed };
    try {
      await this.modelData.createDriveAsync(newDrive);
    } catch (e) { throw e; }
  }

	async updatePublicDriveAsync(useruuid, props) {
    // check permission  --- all user can update public drive ???
    let users = this.modelDate.users;
    if (!users.includes(useruuid))
      throw new Error('no permission to create public drive');
    // install next drive
    let drives = this.modelData.drives;
    let drive = drives.find(d => d.uuid = props.uuid);

    let next = Object.assign({}, drive, props);
    try {
      await this.modelData.updateDriveAsync(next);
    } catch (e) { throw e; }
  }

  // props: { driveuuid }
	async deletePublicDriveAsync(useruuid, props) {
    // check permission  --- all user can delete public drive ???
    let users = this.modelDate.users;
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
const createModelServiceAsync = Promise.promisify(createModelService);

export default createModelServiceAsync

