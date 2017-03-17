
import EventEmitter from 'events'
import fs from 'fs'
import E from '../util/error'
import mkdirp from 'mkdirp'
import path from 'path'
import UUID from 'node-uuid'
import validator from 'validator'
import ursa from 'ursa'
import bcrypt from 'bcrypt'
import { md4Encrypt } from '../tools'

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp);

const isUUID = uuid => (typeof uuid === 'string') ? validator.isUUID(uuid) : false;
const validateUUIDList = list => {
  if (!Array.isArray(list)) return false;
  return list.every(isUUID) ? true : false;
}

const isExist = (target, callback) =>
  fs.access(target, fs.constants.R_OK, err =>
    err ? callback(null, false) : callback(null, true));
const isExistAsync = Promise.promisify(isExist);

const getFileData = (filepath, callback) => {
  fs.readFile(filepath, (err, data) => {
    if(err) return callback(err);
    try {
      return callback(null, JSON.parse(data));
    } catch (e) { return callback(e); }
  });
}
const getFileDataAsync = Promise.promisify(getFileData);


class Model extends EventEmitter {

  constructor(mfilepath, ufilepath, dfilepath, tmpfolder) {
    super();
    this.lock = false;
    this.users = null;  // []
    this.drives = null; // []
    this.modelFilePath = mfilepath; // model.json path
    this.userFilePath = ufilepath;  // user.json path
    this.drivefilePath = dfilepath; // drive.json path
    this.tmpfolder = tmpfolder;
    this.version = null;
    // user
    this.increment = 2000;
    this.eset = new Set();  // local user set
    this.hash = UUID.v4();
  }

  getLock() {
    if (this.lock === true) throw E.ELOCK('expect unlocked,actually locked');
    this.lock = true;
  }

  putLock() {
    if (this.lock === false) throw E.ELOCK('expect locked,actually unlocked');
    this.lock = false;
  }

  async saveAsync(data) {
    await mkdirpAsync(this.tmpfolder);
    let tmpfile = path.join(this.tmpfolder, UUID.v4());
    let json = JSON.stringify(data, null, '  ');
    await fs.writeFileAsync(tmpfile, json);
    await fs.renameAsync(tmpfile, this.modelFilePath);
  }

  setModelData(data){
    this.users = data.users;
    this.drives = data.drives;
    this.version = data.version;
  }

  async initializeAsync() {
    if (this.lock) throw E.ELOCK();
    this.getLock();
    let err = null;
    let modelInfo;
    let dirty = false;
    let existM = await isExistAsync(this.modelFilePath);
    if (existM){
      // model.json exist
      try {
        modelInfo = await getFileDataAsync(this.modelFilePath);
        if (!Array.isArray(modelInfo.users) || !Array.isArray(modelInfo.drives) || modelInfo.version === undefined)
          err = E.EDOCFORMAT('Model file format is not correct');
      } catch (e) { err = e; }
    } else {
      // model.json non-existent, read user.json & drive.json
      dirty = true;
      try {
        let users = await getFileDataAsync(this.userFilePath);
        let drives = await getFileDataAsync(this.drivefilePath);
        if(!Array.isArray(users) || !Array.isArray(drives))
          // format is not correct
          err = E.EDOCFORMAT('user or drive file format is not correct');
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

  allocUnixUID() {
    while (this.eset.has(this.increment)) this.increment++
    return this.increment++
  }

  async createUserAsync(props){
    if (this.lock) throw E.ELOCK();

    let users = this.users;
    let drives = this.drives;
    let isFirstUser = users.length ? false : true;
    let {
      type,
      uuid,
      username,
      unixname,
      password,
      unixpassword,
      avatar,
      email,
      isAdmin,
      credentials
    } = props;

    if (type !== 'local' && type !== 'remote')
      throw E.EINVAL('invalid user type');

    if (type === 'remote' && !isUUID(uuid))
      throw E.EINVAL('invalid remote user uuid');

    if (typeof username !== 'string' || !username.length || users.find(u => u.username === username))
      throw E.EINVAL('invalid username');

    // check unixname
    if (!(/[a-zA-Z-_]{1}[a-zA-z0_9-_]{2,14}/.test(unixname)) || users.find(u => u.unixname === unixname))
      throw E.EINVAL('invalid unixname');

    // check remote user publickey ???

    if (type === 'local' && (typeof password !=='string' || !password.length))
      throw E.EINVAL('invalid local user password');

    if (avatar && (typeof avatar !== 'string' || avatar.length === 0))
      throw E.EINVAL('invalid avatar');

    if (email && (typeof email !== 'string' || !validator.isEmail(email)))
      throw E.EINVAL('invalid email');

    if (isAdmin && typeof isAdmin !== 'boolean')
      throw E.EINVAL('invalid admin, must be true of false');

    if (isFirstUser && type === 'remote')
      throw E.EINVAL('first user type must be local');

    if (type === 'local'){
      let key         = ursa.generatePrivateKey(512, 65537);
      let privatePem  = ursa.createPrivateKey(key.toPrivatePem());
      let privateKey  = privatePem.toPrivatePem('utf8');
      let publicPem   = ursa.createPublicKey(key.toPublicPem());
      let publicKey   = publicPem.toPublicPem('utf8');
      credentials     = {
        publicKey,
        privateKey
      }
    }
    let salt = bcrypt.genSaltSync(10);
    let passwordEncrypted = bcrypt.hashSync(password, salt);
    let smbPasswordEncrypted = md4Encrypt(password);
    let lastChangeTime = new Date().getTime();
    let home = UUID.v4();
    let library = UUID.v4();
    let service = UUID.v4();
    uuid = uuid || UUID.v4();
    avatar = avatar || null;
    email = email || null;
    isAdmin = isFirstUser ? true : false;

    // get new drive array
    if (type === 'local'){
      // user
      let readyAddUser = {
        type,
        uuid,
        username,
        unixname,
        password,
        email,
        avatar,
        isAdmin,
        isFirstUser,
        credentials,
        lastChangeTime,
        home,
        library,
        password: passwordEncrypted,
        smbPassword: smbPasswordEncrypted
      };
      readyAddUser.unixUID = this.allocUnixUID()
      users.push(readyAddUser);
      // drive
      let homeDrive = {
        label: 'home',
        uuid: home,
        owner: uuid,
        type: 'private'
      };
      let libDrive = {
        label: 'library',
        uuid: library,
        owner: uuid,
        type: 'private'
      };
      drives.push(homeDrive);
      drives.push(libDrive);
    } else if(type === 'remote'){
      // user
      let readyAddUser = {
        type,
        uuid,
        username,
        unixname,
        password,
        email,
        avatar,
        isAdmin,
        isFirstUser,
        credentials,
        lastChangeTime,
        service,
        password: passwordEncrypted,
        smbPassword: smbPasswordEncrypted
      };
      users.push(readyAddUser);
      // drive
      let serviceDrive = {
        label: 'service',
        uuid: service,
        type: 'service'
      }
      drives.push(serviceDrive);
    }
    
    let modelInfo = Object.assign({}, { version: this.version}, { users }, { drives });

    this.getLock();
    try {
      // updata memory & file data
      await this.saveAsync(modelInfo);
      this.setModelData(modelInfo);
      // emit event
      this.emit('UPDATA_FRUITMIX_USERS');
      this.emit('UPDATA_FRUITMIX_DRIVES');
    } catch (e) {
      throw e;
    } finally {
      this.putLock();
    }
  }

  async updateUserAsync(uuid, props, callback){
    let users = this.users;
    let user = users.find(u => u.uuid === uuid);
    if (!user) throw E.ENOENT('user not found');

    let { username, password, smbUsername, smbPassword, avatar, email } = props;
    let change = {};

    // check username
    if (username) {
      if (typeof username !== 'string' || !username.length ||
        users.filter(u => u.uuid !== uuid).find(o => o.username === username)){
        throw E.EINVAL('user name has been occupied');
      }
      change.username = username;
      change.lastChangeTime = new Date().getTime();
    }

    // check password
    if (password){
      if (typeof password !== 'string' || !password.length)
        throw E.EINVAL('invalid password');
      change.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
      change.smbPassword = md4Encrypt(password);
      change.lastChangeTime = new Date().getTime();
    }

    // check avatar
    if (avatar === undefined) {}
      else if ((typeof avatar === 'string' && !avatar.length) || avatar === null)
        change.avatar = avatar;
      else
        throw E.EINVAL('invalid avatar');

    // check email
    if (email === undefined) {}
      else if (email === null || (typeof email === 'string' && !email.length))
        change.email = email;
      else
        throw E.EINVAL('invalid email');

    let update = Object.assign({}, user, change);
    let index = users.findIndex(u => u.uuid === uuid);
    let newUsers = [...users.slice(0, index),  update, ...users.slice(index + 1)];
    let modelInfo = Object.assign({}, { version: this.version, users: newUsers, drives: this.drives });

    this.getLock();
    try {
      // updata memory & file data
      await this.saveAsync(modelInfo);
      this.setModelData(modelInfo);
      // emit event
      this.emit('UPDATA_FRUITMIX_USERS');
    } catch (e) {
      throw e;
    } finally {
      this.putLock();
    }
  }

  deleteUser(){}

  async createDriveAsync(props){
    let { label, type, owner, writelist, readlist, sharelist } = props;
    let users = this.users;

    if (typeof label !== 'string' || !label.length)
      throw E.EINVAL('invalid label');

    if (type !== 'private' && type !== 'public' && type !== 'service')
      throw E.EINVAL('invalid type');

    if (type === 'private' && !validateUUIDList(owner) && !users.filter(u => u.type === 'local').find(i => i.uuid === owner[0]))
      throw E.EINVAL('invalid owner');

    if (type === 'public' && !validateUUIDList(writelist) && !validateUUIDList(readlist) && !Array.isArray(sharelist))
      throw E.EINVAL('invalid public drive info');

    let drive = {};
    if (type === 'private')
      drive = { label, type, uuid: UUID.v4(), owner };
    else if (type === 'public')
      drive = { label, type, uuid: UUID.v4(), writelist, readlist, sharelist };
    else if (type === 'service')
      drive = { label, type, uuid: UUID.v4() }

    let drives = this.drives;
    drives.push(drive);
    let modelInfo = { version: this.version, users: this.users, drives };

    this.getLock();
    try {
      // updata memory & file data
      await this.saveAsync(modelInfo);
      this.setModelData(modelInfo);
      // emit event
      this.emit('UPDATA_FRUITMIX_USERS');
    } catch (e) {
      throw e;
    } finally {
      this.putLock();
    }
  }

  async updateDriveAsync(uuid, props){
    let drives = this.drives;
    let drive = drives.find(d => d.uuid === uuid)
    if(!drive)
      throw E.ENOENT('drive not found');

    let type = drive.type;
    let { label, owner, writelist, readlist, sharelist } = props;
    let change = {};

    // check label
    if (label){
      if (typeof label !== 'string' || !label.length)
        throw E.EINVAL('invalid label');
      change.label = label;
      change.lastChangeTime = new Date().getTime();
    }

    // check private drive owner 
    if (owner && type === 'private'){
      if (!validateUUIDList(owner))
        throw E.EIINVAL('invalid private drive owner');
      change.owner = owner;
      change.lastChangeTime = new Date().getTime();
    }

    // check public drive writelist, readlist, sharelist
    if(type === 'public'){
      if (writelist && !validateUUIDList(writelist))
        throw E.EINVAL('invalid public drive writelist');
      else {
        change.writelist = writelist;
        change.lastChangeTime = new Date().getTime();
      }
      if (readlist && !validateUUIDList(readlist))
        throw E.EINVAL('invalid public drive readlist');
      else {
        change.readlist = readlist;
        change.lastChangeTime = new Date().getTime();
      }
      if (sharelist && !Array.isArray(sharelist))
        throw E.EINVAL('invalid public drive sharelist');
      else {
        change.sharelist = sharelist;
        change.lastChangeTime = new Date().getTime();
      }
    }

    let update = Object.assign({}, drive, change);
    let index = drives.findIndex(d => d.uuid = uuid);
    let newDrives = [...drives.slice(0, index), update, ...drives.slice(index + 1)];
    let modelInfo = { version: this.version, users: this.users, drives: newDrives };

    this.getLock();
    try {
      // updata memory & file data
      await this.saveAsync(modelInfo);
      this.setModelData(modelInfo);
      // emit event
      this.emit('UPDATA_FRUITMIX_USERS');
    } catch (e) {
      throw e;
    } finally {
      this.putLock();
    }
  }

  async deleteDriveAsync(uuid){
    let drives = this.drives;
    let users = this.users;
    let drive = drives.find(d => d.uuid === uuid);
    if (!drive)
      throw E.ENOENT('drive not found');

    let index = drives.findIndex(d => d.uuid = uuid);
    let newDrives = [...drives.slice(0,index), ...drives.slice(index + 1)];
    users.forEach(u => {
      if (u.home === uuid) delete u.home;
      if (u.library === uuid) delete u.library;
      if (u.service === uuid) delete u.service;
    });
    let modelInfo = { version: this.version, users, drives: newDrives };

    this.getLock();
    try {
      // updata memory & file data
      await this.saveAsync(modelInfo);
      this.setModelData(modelInfo);
      // emit event
      this.emit('UPDATA_FRUITMIX_USERS');
    } catch (e) {
      throw e;
    } finally {
      this.putLock();
    }
  }
}

const createModel = async (mfilepath, ufilepath, dfilepath, tmpfolder, callback) => {
  let model = new Model(mfilepath, ufilepath, dfilepath, tmpfolder);
  try {
    await model.initializeAsync();
    callback(null, model);
  } catch (e) {
    callback(e);
  }
}

const createModelAsync = Promise.promisify(createModel);

export {
  createModel,
  createModelAsync
}