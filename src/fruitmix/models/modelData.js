import fs from 'fs'
import EventEmitter from 'events'
import UUID from 'node-uuid'
import E from '../lib/error'
import path from 'path'
import { isUUID } from '../lib/types'


/**
  data integrity (stateless)
{
  type: 'local'
  
  // basic
x uuid:             // uuid string, required, unique
x username:         // nonempty string, required, unique (in local users)
x password:         // string, required
a nologin:          // bool, default false, required,
  
  // attributes
a isFirstUser:      // bool, required, immutable, only one, 
                    // true only if isAdmin true
a isAdmin:          // bool, required
a email: null,      // null, required
a avatar: null,     // null, required
  
  // drives
  home: <uuid>,     // uuid string, required, exclusive
  library: <uuid>,  // uuid string, required, exclusive
  service: <uuid>,  // uuid string, required, exclusive
  
  // for samba and linux apps
a unixuid:          // 2000 <= integer < 10000, required
  unixname:         // valid unix username, unique
g unixPassword:     // autogen
g smbPassword:      // autogen
g lastChangeTime:   // int, new Date().getTime()

  // for remote 
g credentials: {
    publicKey:      // TBD
    privateKey:     // TBD
  },
a friends: [],      // uuid array, each uuid is a remote user, no dup
}

{
  type: 'remote',
  
  uuid:         // uuid, unique
  username:       // string
  email:        // null
  avatar:         // null
  
  service:        // uuid, exclusive
  
}
**/ 

const assert = (predicate, message) => {
  if (!predicate)
    throw new Error(message);
}

const unique = arr => new Set(arr).size === arr.length

const isUniqueUUIDArray = arr => unique(arr)
  && (arr.every(i => isUUID(i)) || arr.length === 0)

const arrayEqual = (arr1, arr2) => arr1.length === arr2.length
  && arr1.every((item, index) => item === arr2[index])

const isNonEmptyString = str => typeof str === 'string' && str.length

const complement = (a, b) => 
  a.reduce((acc, c) => b.includes(c) 
    ? acc 
    : [...acc, c], [])

const validateProps = (obj, mandatory, optional = []) => 
  complement(Object.keys(obj), [...mandatory, ...optional]).length === 0 &&
  complement(mandatory, Object.keys(obj)).length === 0

const localUserMProps = [
  'type', 'uuid', 'username', 'password', 'nologin', 
  'isFirstUser', 'isAdmin', 'email', 'avatar', 
  'home', 'library', 'service', 
  'unixuid', 'smbPassword', 'lastChangeTime', 'friends'
  // 'credentials', 
]

const localUserOProps = ['unixname', 'unixPassword']

const validateLocalUser = u => {

  assert(validateProps(u, localUserMProps, localUserOProps), 'invalid object props')

  assert(isUUID(u.uuid), 'invalid user uuid') 
  assert(isNonEmptyString(u.username), 'username must be non-empty string')
  assert(isNonEmptyString(u.password), 'password must be non-empty string')
  assert(typeof u.nologin === 'boolean', 'nologin must be boolean')
  assert(typeof u.isFirstUser === 'boolean', 'isFirstUser must be boolean')
  assert(typeof u.isAdmin === 'boolean', 'isAdmin must be boolean')
  assert(u.email === null, 'email must be null')
  assert(u.avatar === null, 'avatar must be null')
  assert(isUUID(u.home), 'invalid home uuid')
  assert(isUUID(u.library), 'invalid library uuid')
  assert(isUUID(u.service), 'invalid service uuid')
  assert(Number.isInteger(u.unixuid), 'unixuid must be number')
  assert(u.unixuid >= 2000 && u.unixuid < 10000, 'unixuid must be in range 2000 to 10000')

  assert(u.hasOwnProperty('unixPassword') 
    ? isNonEmptyString(u.unixPassword)
    : true, 'unixPassword must be non-empty string if provided')
  
  assert(isNonEmptyString(u.smbPassword), 'smbPassword must be non-emty string')
  assert(Number.isInteger(u.lastChangeTime), 'lastChangeTime must be integer')

  // TODO credentials not asserted
  assert(isUniqueUUIDArray(u.friends), 'friends must be unique uuid array')
}

const remoteUserMProps = ['type', 'uuid', 'email', 'avatar', 'service']
const remoteUserOProps = ['username'] 
const validateRemoteUser = u => {

  assert(validateProps(u, remoteUserMProps, remoteUserOProps), 'invalid object props')

  assert(isUUID(u.uuid), 'invalid user uuid')
  assert(u.hasOwnProperty('username') 
    ? isNonEmptyString(u.username)
    : true, 'remote user name must be non-empty string')
  assert(u.email === null, 'email must be null')
  assert(u.avatar === null, 'avatar must be null')
  assert(isUUID(u.service), 'invalid service uuid')
}

const publicDriveMProps = ['uuid', 'type', 'writelist', 'readlist', 'shareAllowed', 'label']
const validatePublicDrive = pb => {

  assert(validateProps(pb, publicDriveMProps))

  assert(isUUID(pb.uuid), 'invalid public drive uuid')
  assert(isUniqueUUIDArray(pb.writelist), 'writelist must be unique uuid array')
  assert(isUniqueUUIDArray(pb.readlist), 'readlist must be unique uuid array')
  assert(isUniqueUUIDArray([...pb.writelist, ...pb.readlist]), 
    'writelist and readlist have common user')
  assert(typeof pb.shareAllowed === 'boolean', 'shareAllowed must be boolean')
}

const privateDriveMProps = ['uuid', 'type', 'owner', 'label']
const validatePrivateDrive = pv => {

  assert(validateProps(pv, privateDriveMProps))

  assert(isUUID(pv.uuid), 'invalid drive uuid')
  assert(isUUID(pv.owner), 'invalid drive owner uuid')
}

// a partial model validation
const validateModel = (users, drives) => {

  // validate user type
  assert(users.every(u => u.type === 'local' || u.type === 'remote'), 'invalid user type')

  let locals = users.filter(u => u.type === 'local').sort()
  let remotes = users.filter(u => u.type === 'remote').sort()

  locals.forEach(l => validateLocalUser(l))
  remotes.forEach(r => validateRemoteUser(r))

  // unique user uuid
  assert(unique(users.map(u => u.uuid)), 'user uuid must be unique')

  // unique local username
  assert(unique(locals.map(u => u.username)), 'local username must be uniqe')

  // unique local unixuid
  assert(unique(locals.map(u => u.unixuid)), 'local unixuid must be unique')

  // unique unixname
  assert(unique(locals
    .filter(u => u.hasOwnProperty('unixname'))
    .map(u => u.unixname)), 'unixname must be unique')

  if (locals.length){
    // single first user
    assert(locals.filter(u => u.isFirstUser === true).length === 1, 'single first user')

    // first user admin
    assert(locals.find(u => u.isFirstUser).isAdmin === true, 'first user must be admin')
  }

  // unique drive label
  assert(unique(drives.map(d => d.label)), 'drive label must be uniqe')

  // validate drive type
  assert(drives.every(d => 
    d.type === 'private'
    || d.type === 'public'), 'invalid drive type')

  let publics = drives.filter(d => d.type === 'public').sort()
  let privates = drives.filter(d => d.type === 'private').sort()

  publics.forEach(pb => validatePublicDrive(pb))
  privates.forEach(pv => validatePrivateDrive(pv))

  // unique drive uuid
  assert(unique(drives.map(d => d.uuid)), 'drive uuid must be unique')

  // bi-directional user-drive relationship
  let udrvs = [
    ...locals.reduce((acc, u) => [...acc, u.home, u.library, u.service], []),
    ...remotes.reduce((acc, u) => [...acc, u.service], [])
  ]

  // since privates are unique, this implies
  // 1. all user drives exists, are unique and private
  // 2. all private drive are actually used by users
  let pvuuids = privates.map(pv => pv.uuid);
  assert(arrayEqual(udrvs.sort(), pvuuids.sort()), 'all user drives must be equal to all privates')
}

const invariantProps = (p, c, props) => 
  props.forEach(prop => 
    assert(p[prop] === c[prop], `invariant ${prop} violated`))

const invariantUpdateLocalUser = (p, c) => 
  invariantProps(p, c, [
    'type', 'uuid', 'password', 'isFirstUser', 'email', 'avatar',
    'home', 'library', 'service', 
    'unixuid', 'unixPassword', 'smbPassword', 'lastChangeTime'
    // , 'credentials'
  ])

const invariantUpdateRemoteUser = (p, c) => 
  invariantProps(p, c, [
    'type', 'uuid', 'service'  
  ])

const invariantUpdatePassword = (p, c) =>
  invariantProps(p, c, [
    'type', 'uuid', 'username', 'nologin', 'isFirstUser', 'isAdmin',
    'email', 'avatar', 'home', 'library', 'service', 'unixuid', 'unixname', 'friends'
    // 'credentials', 
  ])

const invariantUpdatePublicDrive = (p, c) => 
  invariantProps(p, c, [
    'type', 'uuid'
  ])

class ModelData extends EventEmitter {

  constructor(modelPath, tmpDir) {

    super()
    this.modelPath = modelPath
    this.tmpDir = tmpDir

    this.users = []
    this.drives = []

    this.lock = false // big lock
  }

  getLock() {
    if (this.lock === true) 
      throw new E.ELOCK('expect unlocked,actually locked');
    this.lock = true;
  }

  putLock() {
    if (this.lock === false) 
      throw new E.ELOCK('expect locked,actually unlocked');
    this.lock = false;
  }

  driveMap(drive) {

    if (drive.type === 'private') {

      let ref, user = this.users.find(u => u.uuid === drive.owner)

      if (user.home === drive.uuid) ref = 'home'
      else if (user.library === drive.uuid) ref = 'library'
      else if (user.service === drive.uuid) ref = 'service'
      else throw new Error('invalid data')

      return Object.assign({}, drive, { ref })
    }
    else
      return Object.assign({}, drive)
  }

  async updateModelAsync(users, drives) {
    if (this.lock) throw new E.ELOCK();
    validateModel(users, drives)
    this.getLock()
    try {

      // await mkdirpAsync(this.tmpDir)
      let tmpfile = path.join(this.tmpDir, UUID.v4())
      let json = JSON.stringify({ version: 1, users, drives }, null, '  ')
      await fs.writeFileAsync(tmpfile, json) 
      await fs.renameAsync(tmpfile, this.modelPath)

      this.users = users
      this.drives = drives
    }
    catch (e) { throw e }
    finally{ this.putLock() }
  }

  async initModelAsync(users, drives) {
    await this.updateModelAsync(users, drives)
    // console.log('initModelAsync', drives)
    this.emit('drivesCreated', drives.map(d => this.driveMap(d)))
  }

  // both local and remote user
  async createUserAsync(newUser, newDrives) {

    let nextUsers = [...this.users, newUser]
    let nextDrives = [...this.drives, ...newDrives]

    await this.updateModelAsync(nextUsers, nextDrives)
    this.emit('drivesCreated', newDrives.map(d => this.driveMap(d)))
  }

  // both local and remote
  async updateUserAsync(next) {

    let index = this.users.findIndex(u => u.uuid === next.uuid)
    if (index === -1) throw new Error('user not found');

    let user = this.users[index]

    if (user.type === 'local')
      invariantUpdateLocalUser(user, next)
    else if (user.type === 'remote')
      invariantUpdateRemoteUser(user, next)
    else
      throw new Error('user type error');

    let nextUsers = [
      ...this.users.slice(0, index),
      next,
      ...this.users.slice(index + 1)
    ] 
    
    await this.updateModelAsync(nextUsers, this.drives)
  }

  // password
  async updatePasswordAsync(next) {
    let index = this.users.findIndex(u => u.uuid === next.uuid);
    if (index === -1) throw new Error('user not found');

    let user = this.users[index];

    if (user.type === 'local')
      invariantUpdatePassword(user, next);
    else
      throw new Error('user type error');

    let nextUsers = [
      ...this.users.slice(0, index),
      next,
      ...this.users.slice(index + 1)
    ] 
    
    await this.updateModelAsync(nextUsers, this.drives)
  }

  async createDriveAsync(newDrive) {

    if (newDrive.type !== 'public') throw new Error('only create public drive');
    let nextDrives = [...this.drives, newDrive]
    
    await this.updateModelAsync(this.users, nextDrives)
    this.emit('drivesCreated', [this.driveMap(newDrive)])
  } 

  async updateDriveAsync(next) {
    
    let index = this.drives.findIndex(d => d.uuid === next.uuid)
    if (index === -1) throw new Error('drive not found');

    let drive = this.drives[index]
    if (drive.type !== 'public') throw new Error('only update public drive');
    
    invariantUpdatePublicDrive(drive, next)

    let nextDrives = [
      ...this.drives.slice(0, index),
      next,
      ...this.drives.slice(index + 1)
    ]

    await this.updateModelAsync(this.users, nextDrives)
    this.emit('driveUpdated', this.driveMap(next))
  }

  async deleteDriveAsync(driveUUID) {

    let index = this.drives.findIndex(d => d.uuid === driveUUID)
    if (index === -1) throw new Error('drive not found');

    let drive = this.drives[index]
    if (drive.type !== 'public') throw new Error('only delete public drive');

    let nextDrives = [
      ...this.drives.slice(0, index),
      ...this.drives.slice(index + 1)
    ]

    await this.updateModelAsync(this.users, nextDrives)
    this.emit('drivesDeleted', [this.driveMap(drive)])
  }

  // get home, library & public drive
  getDrives(){
    return this.drives.filter(d => 
      d.type === 'public' ||
      d.ref === 'home' ||
      d.ref === 'library')
  }

  // get local users and user's friends
  getUsersAndFriends(){
    let localUsers = this.users.filter(u => u.type === 'local')
    let friends;
    localUsers.forEach(u => u.friends.forEach(f => friends.push(f)))
    let mixUser = Array.from(new Set([...localUsers, ...friends]))
    return mixUser.map(u => ({
      type: u.type,
      uuid: u.uuid,
      username: u.username
    }))
  }

}

const createModelData = froot => {
  let modelPath = path.join(froot, 'models/model.json');
  let tmpDir = path.join(froot, 'tmp');
  return new ModelData(modelPath, tmpDir);
}

export default createModelData
