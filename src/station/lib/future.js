const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

/**
 *  /feature
 *    /:GUID or localId
 *      /:uuid (fetureuuid)
 *        manifest(desc for feature)
 *        /files
 */

 /**
  * manifest define
  * type:
  * subtype
  */
class Future {
	constructor(froot) {
		this.dir = path.join(froot, 'feature')
		mkdirp.sync(this.dir)

	}
}