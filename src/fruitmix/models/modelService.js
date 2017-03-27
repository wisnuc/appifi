import path from 'path'
import fs from 'fs'
// import EventEmitter from 'events'

import bcrypt from 'bcrypt'
import UUID from 'node-uuid'
import ursa from 'ursa'
import crypt3 from 'crypt3'

import E from '../lib/error'
import { md4Encrypt } from '../tools'
import { complement } from '../lib/types'
import createModelData from './modelData'

Promise.promisifyAll(fs)

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

const getUnixPwdEncrypt = password =>
  crypt3(password, crypt3.createSalt('sha512').slice(0, 11))

const arrDedup = (arr1, arr2) => 
  Array.from(new Set([...arr1, ...arr2]))

const fileToJsonAsync = async filepath => 
  JSON.parse(await fs.readFileAsync(filepath))

const upgradeData = (users, drives) => {

  let newDrives = drives.map(drive => ({
    uuid: drive.uuid,
    label: drive.label,
    type: 'private',
    owner: drive.owner[0]
  }));

  let newUsers = users.map(user => {
    let u = user;
    u.unixuid = user.unixUID;
    delete u.unixUID;
    u.nologin = false;
    // u.unixname = '';       // ???
    // u.unixPassword = '';   // ???
    u.friends = [];
    u.credentials = getCredentials();
    // create service drive
    u.service = UUID.v4();
    newDrives.push({
      uuid: u.service,
      label: `${u.username} service`,
      type: 'private',
      owner: u.uuid
    });
    return u;
  })

  return { users: newUsers, drives: newDrives };
}

class ModelService {

  constructor(froot, modelData) {
    // super();
    this.froot = froot;
    this.modelData = modelData;
  }

  allocUnixUID() {
    let uids = this.modelData.users.filter(u => u.type === 'local').map(u => u.unixuid);
    let set = new Set(uids);
    let uid;
    for (uid = 2000; set.has(uid); uid++) {}
    return uid;
  }

  async initializeFallbackAsync () {
    let mpath = this.modelData.modelPath;
    let upath = path.join(path.dirname(mpath), 'users.json');
    let dpath = path.join(path.dirname(mpath), 'drives.json');
    try {
      let users = await fileToJsonAsync(upath);
      let drives = await fileToJsonAsync(dpath);
      let obj = upgradeData(users, drives);
      // upgrade data add create all service drive
      // this.modelData.emit('drivesCreated', obj.drives.filter(d => d.type ==='service'));
      // return await this.modelData.updateModelAsync(obj.users, obj.drives);
      return await this.modelData.initModelAsync(obj.usres, obj.drives)
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      // return await this.modelData.updateModelAsync([], []);
    }
  }

  // opaque
  async initializeAsync() {

    try {
      let data = await fileToJsonAsync(this.modelData.modelPath);
      return await this.modelData.updateModelAsync(data.users, data.drives);
    }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      return await this.initializeFallbackAsync();
    }

  }

  async createLocalUserAsync({ useruuid, props }) {
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
    let homeDrive     = Object.assign({}, common, { uuid: home, label: `${username} home` });
    let libraryDrive  = Object.assign({}, common, { uuid: library, label: `${username} library` });
    let serviceDrive  = Object.assign({}, common, { uuid: service, label: `${username} service` });
    let newDrives = [ homeDrive, libraryDrive, serviceDrive ];
    
    await this.modelData.createUserAsync(newUser, newDrives);
    // this.emit('drivesCreated', this.modelData.drives.filter(d =>
    //  d.uuid === home || d.uuid === library || d.uuid === service));

    return {
      type, uuid, username, nologin, isFirstUser, isAdmin,
      email, avatar, home, library, service, unixuid,
      unixname, lastChangeTime, friends
    }
  }

  async createRemoteUserAsync({ useruuid, props }) {
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
      label: `${uuid} service`
    }]

    await this.modelData.createUserAsync(newUser, newDrives);
    // this.emit('drivesCreated', this.modelData.drives.filter(d => d.uuid === service));

    return { type, username, uuid, email, avatar, service }
  }

  async updateUserAsync({ useruuid, props }) {
    // check permission
    let user = this.modelData.users.find(u => u.uuid === useruuid);
    if (!user)
      throw new Error('user does not exist');

    let next = Object.assign({}, user, props );
    await this.modelData.updateUserAsync(next);
    return next;
  }

  async updatePasswordAsync({ useruuid, pwd }) {
    // check permission
    let user = this.modelData.users.find(u => u.uuid === useruuid);
    if (!user)
      throw new Error('user does not exist');
    // install user
    let password = passwordEncrypt(pwd, 10);
    let unixPassword = getUnixPwdEncrypt(pwd);
    let smbPassword = md4Encrypt(pwd);
    let lastChangeTime = new Date().getTime();

    let next = Object.assign({}, user, { password, unixPassword, smbPassword, lastChangeTime });
    
    await this.modelData.updatePasswordAsync(next);
    return null;
  }

  async createFriendAsync(useruuid, friend) {
    // check permission
    let user = this.modelData.users.find(u => u.uuid === useruuid);
    if (!user)
      throw new Error('user does not exist');
    // install user
    let newFriends = arrDedup(user.friends, [ friend ]);

    let next = Object.assign({}, user, { friends: newFriends });
    
    await this.modelData.updateUserAsync(next);

    return next;
  }

  async deleteFriendAsync(useruuid, friend) {
    // check permission
    let user = this.modelData.users.find(u => u.uuid === useruuid);
    if (!user)
      throw new Error('user does not exist');
    // install user
    let newFriends = complement(user.friends, [ friend ]);

    let next = Object.assign({}, user, { friends: newFriends });

    await this.modelData.updateUserAsync(next);

    return next;
  }

  async createPublicDriveAsync(useruuid, props) {
    // check permission
    let admin = this.modelData.users.find(u => u.uuid === useruuid);
    if (!admin)
      throw new Error('no permission to create public drive');
    //install new drive
    let uuid = UUID.v4();
    let type = 'public';
    let writelist = props.writelist || [];
    let readlist = props.readlist || [];
    let shareAllowed = props.shareAllowed === true ? true : false;
    let label = props.label || uuid;

    let newDrive = { uuid, type, label, writelist, readlist, shareAllowed };
    
    await this.modelData.createDriveAsync(newDrive);
    // this.emit('drivesCreated', [newDrive]);
    return newDrive;
  }

  async updatePublicDriveAsync(useruuid, props) {
    // check permission
    let admin = this.modelData.users.find(u => u.uuid === useruuid);
    if (!admin)
      throw new Error('no permission to create public drive');
    // install next drive
    let drives = this.modelData.drives;
    let drive = drives.find(d => d.uuid === props.uuid);

    let next = Object.assign({}, drive, props);

    await this.modelData.updateDriveAsync(next);
    // this.emit('driveUpdated', next);
    return next;
  }

  async deletePublicDriveAsync(useruuid, props) {

    // check permission
    let admin = this.modelData.users.find(u => u.uuid === useruuid);
    if (!admin)
      throw new Error('no permission to create public drive');

    let drive = this.modelData.drives.find(d => d.uuid === props.driveuuid);
    // delete
    await this.modelData.deleteDriveAsync(props.driveuuid);
    // this.emit('drivesDeleted', drive);
    return null;
  }

  register(ipc){
    ipc.register('createLocalUser', asCallback(this.createLocalUserAsync).bind(this))
    ipc.register('updateUser', asCallback(this.updateUserAsync).bind(this))
  }

}

const asCallback = (asyncFn) => 
  (args, callback) => asyncFn.asCallback(args, (e, data) =>
    e ? callback(e) : callback(null, data))

const createModelService = (froot) =>
  new ModelService(froot, createModelData(froot));

export default createModelService
