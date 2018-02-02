const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

/**
 *  /feature
 *     /:uuid (fetureuuid)
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
		this.dir = path.join(froot, 'future')
    mkdirp.sync(this.dir)
    this.futures = new Map()
    this.loadSync()
  }
  
  loadSync() {
    let entries = fs.readdirSync(this.dir)
    entries.forEach(ent => {
      let futPath = path.join(this.dir, entries, 'manifest')
      let future = fs.readFileSync(futPath)
      
    })
  }
}