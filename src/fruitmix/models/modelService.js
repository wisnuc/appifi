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
    // u.credentials = getCredentials();
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
    let mpath = path.join(this.froot, 'models/model.json');
    let upath = path.join(path.dirname(mpath), 'users.json');
    let dpath = path.join(path.dirname(mpath), 'drives.json');
    try {
      let users = JSON.parse(await fs.readFileAsync(upath));
      let drives = JSON.parse(await fs.readFileAsync(dpath));
      let obj = upgradeData(users, drives);
      return await this.modelData.initModelAsync(obj.users, obj.drives)
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      return await this.modelData.initModelAsync([], []);
    }
  }

  // opaque
  async initializeAsync() {

    try {
      let mpath = path.join(this.froot, 'models/model.json');
      let data = JSON.parse(await fs.readFileAsync(mpath));
      // return await this.modelData.updateModelAsync(data.users, data.drives);
      return await this.modelData.initModelAsync(data.users, data.drives)
    }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      return await this.initializeFallbackAsync();
    }

  }

  // async createLocalUserAsync({ useruuid, props }) {
  async createLocalUserAsync(args) {

    let { useruuid, props } = args;
    /** 
    creating the first useruuid is undefined
    props {
      *  type: 'local',
      *  username,     // string
      *  password,     // string
      *  unixname      // string
      a  nologin,      // bool
      a  isFirstUser,  // bool
      a  isAdmin,      // bool
      a  email,        // string
      a  avatar,       // string
    }
    **/

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
    // let credentials = getCredentials();

    let newUser = {
      type, uuid, username, nologin, isFirstUser, isAdmin,
      email, avatar, home, library, service, unixuid,
      unixname, lastChangeTime, friends,
      unixPassword, smbPassword,
      password: passwordEncrypted
      // , credentials
    };
    // install newDrives
    let common = { owner: uuid, type: 'private' };
    let homeDrive     = Object.assign({}, common, { uuid: home, label: `${username} home` });
    let libraryDrive  = Object.assign({}, common, { uuid: library, label: `${username} library` });
    let serviceDrive  = Object.assign({}, common, { uuid: service, label: `${username} service` });
    let newDrives = [ homeDrive, libraryDrive, serviceDrive ];
    
    await this.modelData.createUserAsync(newUser, newDrives);

    return {
      type, uuid, username, nologin, isFirstUser, isAdmin,
      email, avatar, home, library, service, unixuid,
      unixname, lastChangeTime, friends
    }
  }

  // async createRemoteUserAsync({ useruuid, props }) {
  async createRemoteUserAsync(args) {

    let { useruuid, props } = args;
    /** 
    props {
      *  type: 'remote',
      *  username,       // string
      a  email,          // string
      a  avatar,         // string
    }
    **/

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

    return { type, username, uuid, email, avatar, service }
  }

  // async updateUserAsync({ useruuid, props }) {
  async updateUserAsync(args) {

    let { useruuid, props } = args;
    // check permission
    let user = this.modelData.users.find(u => u.uuid === useruuid);
    if (!user)
      throw new Error('user does not exist');

    let next = Object.assign({}, user, props );
    await this.modelData.updateUserAsync(next);
    return next;
  }

  // async updatePasswordAsync({ useruuid, pwd }) {
  async updatePasswordAsync(args) {

    let { useruuid, pwd } = args;
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

  async createPublicDriveAsync(args) {

    let { useruuid, props } = args
    /*
      props {
        writerlist,   // array
        readlist,     // array
        shareAllowed  // bool
      }
    */
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
    return newDrive;
  }

  async updatePublicDriveAsync(args) {

    let { useruuid, props } = args;
    /*
      props {
        writerlist,   // array
        readlist,     // array
        shareAllowed  // bool
      }
    */
    // check permission
    let admin = this.modelData.users.find(u => u.uuid === useruuid);
    if (!admin)
      throw new Error('no permission to create public drive');
    // install next drive
    let drives = this.modelData.drives;
    let drive = drives.find(d => d.uuid === props.uuid);

    let next = Object.assign({}, drive, props);

    await this.modelData.updateDriveAsync(next);
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
    return null;
  }

  // determine whether local users
  async isLocalUser(useruuid) {
    // find user by uuid
    let user = this.modelData.users.find(u => u.uuid === useruuid)
    if (!user) throw new Error('user not found')
    return user.type === 'local'
  }

  // get drive info
  getDriveInfo(driveuuid, callback){
    // find drive by uuid
    let drive = this.modelData.drives.find(d => d.uuid === driveuuid);
    if (!drive)
      callback(new Error('drive not found'))
    else if (drive.owner) {
      // not public drive get ownername
      let ownername = (this.modelData.users.find(u => u.uuid === drive.owner)).username;
      callback(null, Object.assign({}, drive, { ownername }))
    } else callback(null, drive)
  }

  //get account info
  getAccountInfo(useruuid, callback){
    let user = this.modelData.users.find(u => u.uuid === useruuid);
    if (!user)
      return callback(new Error('user not found'))
    delete user.password
    delete user.unixPassword
    delete user.smbPassword
    callback(null, user)
  }

  // get home, library, & public drive
  getDrives(callback){
    callback(null, this.modelData.getDrives())
  }

  // get user friends
  getUserFriends(useruuid, callback){
    let user = this.modelData.users.find(u => u.uuid === useruuid && u.type === 'local')
    if (!user)
      return callback(new Error('no local users'))
    callback(null, user.friends)
  }

  // get all local user
  getAllLocalUser(useruuid, callback){
    let user = this.modelData.user.find(u => u.uuid === useruuid && u.isAdmin)
    if (!user)
      return callback(new Error('no permission to get all local user'))
    callback(null, this.modelData.getAllLocalUser())
  }

  register(ipc) {
    ipc.register('createLocalUser', (args, callback) => this.createLocalUserAsync(args).asCallback(callback))
    ipc.register('updateUser', (args, callback) => this.updateUserAsync(args).asCallback(callback))
    ipc.register('isLocalUser', (args, callback) => this.isLocalUser(args).asCallback(callback))
    ipc.register('createPublicDrive', (args, callback) => this.createPublicDriveAsync(args).asCallback(callback))
    ipc.register('updatePublicDrive', (args, callback) => this.updatePublicDriveAsync(args).asCallback(callback))
    ipc.register('getDriveInfo', (args, callback) => this.getDriveInfo(args, callback))
    ipc.register('getDrives', (args, callback) => this.getDrives(callback))
    ipc.register('getAccountInfo', (args, callback) => this.getAccountInfo(args, callback))
    ipc.register('getUserFriends', (args, callback) => this.getUserFriends(args, callback))
    ipc.register('getAllLocalUser', (args, callback) => this.getAllLocalUser(args, callback))
  }
}

const createModelService = (froot) =>
  new ModelService(froot, createModelData(froot));

export default createModelService
