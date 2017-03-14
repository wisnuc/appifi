
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

class ModelService {

	createLocalUser(user, props, callback) {
		// check permission
		// check args
		// dispatch
	}

	createRemoteUser(user, props, callback) {}

	updateLocalUser(user, props, callback) {}

	updateRemoteUser(user, props, callback) {}

	updatePassword(user, password, callback) {}

	// friends is an array
	createFriend(user, friends, callback) {}

	// friends is an array
	deleteFriend(user, friends, callback) {}

	createPublicDrive(user, props, callback) {}

	updatePublicDrive(user, props, callback) {}

	deletePublicDrive(user, driveuuid, callback) {}


  // TODO functional
	allocUnixUID() {
		while (this.eset.has(this.increment)) this.increment++
    return this.increment++
	}

  // opaque
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

}
