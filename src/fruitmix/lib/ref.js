const fs = require('fs')
const path = require('path')
const child = require('child_process')
const Stringify = require('canonical-json')
const crypto = require('crypto')

const { peekXattrAsync } = require('../file/xstat')
const command = require('../lib/command').default
const E = require('../lib/error')
const { isSHA256, assert, unique } = require('./types')
const { rimrafAsync, mkdirpAsync } = require('../util/async')
const { writeFileToDisk } = require('./util')

const commandAsync = Promise.promisify(command)
const writeFileToDiskAsync = Promise.promisify(writeFileToDisk)

Promise.promisifyAll(child)

/**

@module repo
*/

// test 1: file path is not absolute path
// test 2: file path is not a regular file

/**
@function filehashAsync
@param {string} filepath - file path
@returns {string} file hash (sha256 hex string)
*/
const filehashAsync = async filepath => {

  if(!path.isAbsolute(filepath)) throw new E.EINVAL()
  let stats = await fs.lstatAsync(filepath)
  if(!stats.isFile()) throw new E.EINVAL()
  
  let result = await commandAsync('openssl', ['dgst', '-sha256', '-r', filepath])
  if(result instanceof Error) return result
  else {
    let hash = result.toString().trim().split(' ')[0]
    return isSHA256(hash) ? hash : new E.FORMAT()
  }
}

/**
@validateTree

distinct

[
  ['blob', '1.js', xxxx]
  ['blob', '1.js', xxxx]
]
*/
const validateTree = (object) => {

  assert(Array.isArray(object), 'invalid format')
  assert(unique(object), 'item not unique')

  object.forEach(item => {
    assert(Array.isArray(item), 'invalid item format')
    
    assert(item[0] === 'blob' || item[0] === 'tree', 'invalid file type')
    assert(typeof(item[1]) === 'string', 'invalid name type')
    assert(isSHA256(item[2]), 'invalid hash')
  })
}

// xstat should provide a function to retrieve VALID hash
// it differs from existing readXstat in that it does not create a xattr on target if non-exist
// peekXattr

/*
  fruitmix/repo          // store blob 
          /boxes
            [uuid]/
              manifest  // 
              commits   // database
*/

/**

*/
class Repo {
  
  async initAsync(repoDir, tmpDir, docDir) {
    this.repoDir = repoDir
    this.tmpdir = tmpdir
    this.docDir = docDir
    await mkdirpAsync(repoDir)
    await mkdirpAsync(tmpDir)
    await mkdirpAsync(docDir)
  }

  // internal
  async copyAsync(src, dst) {
    
    // console.log(fs)
    let dir = path.dirname(dst)
    await child.execAsync(`mkdir -p ${dir} && cp -r --reflink=auto --preserve=all '${src}' '${dst}'`)
  }

  // external (interface)

  // store file

  // test fail if filepath is not absolute
  // fail if not a file
  // src has no xattr
  // src has xattr with invalid htime
  // src has xattr with valid htime (hash)
  // how about cp failed ?

  /**
  Store the given file into repo.

  The file may or may not have hash (in xattr).

  ### Tests

  + store a file without xattr, return expected hash
  + store a file with xattr, return expected hash

  @param {string} filepath - source file path
  @returns {string} file hash
  @throws When filepath is not absolute path, not a regular file
  */
  async storeFileAsync(filepath) {
    // 1 cp, preserve xattr & time, reflink
    // cp -a --preserve=xattr /source /dest

    // 2 try retrieve hash from xattr or calculate it
    // fs.lstat(filepath) mtime.getTime() === htime

    // 3 mv tmp file to target

    // if condition .... 
    // else throw error, clean up

    // check file path to be absolute path
    if(!path.isAbsolute(filepath)) throw new E.EINVAL()
    let stats = await fs.lstatAsync(filepath)
    if(!stats.isFile()) throw new E.EINVAL()

    let tmppath = path.join(this.tmpdir, path.basename(filepath))
    try {
      await this.copyAsync(filepath, tmppath)
      // read only
      await child.execAsync(`chmod 444 ${tmppath}`)
    } catch(e) {
      throw e
    }

    // retrieve hash from xattr or calculate it
    let attr = await peekXattrAsync(tmppath)
    let stats2 = await fs.lstatAsync(tmppath)
    let hash
    if(attr && attr.htime === stats2.mtime.getTime()) {
      hash = attr.hash
    } else {
      hash = await filehashAsync(tmppath)
    }
    // now hash is ready
    await mkdirpAsync(this.repoDir)
    let entries = await fs.readdirAsync(this.repoDir)
    // if file is already in repo, return
    if(entries.indexOf(hash) === -1) {
      let target = path.join(this.repoDir, hash)
      try {
        await this.copyAsync(tmppath, target)
      } catch(e) {
        throw e
      } 
    }
    await rimrafAsync(tmppath)
    return hash
  }

  // synchronous, return the filepath
  retrieveFilePath(hash) {
    // validate hash
    if(!isSHA256(hash)) throw new E.EINVAL()
    return path.join(this.repoDir, hash)
  }

  /**
  Store tree object into document pool

  The tree object is canonicalized to provide a stable hash

  @param {object} tree - tree object
  @returns {string} hash 
  */
  async storeObjectAsync(tree) {
    // validate the format of object
    validateTree(tree)

    let text, hash, digest, filepath, tmppath

    text = Stringify(tree)
    hash = crypto.createHash('sha256')
    hash.update(text)
    digest = hash.digest().toString('hex')

    // await mkdirpAsync(this.docDir)

    filepath = path.join(this.docDir, digest)
    try {
      let stats = await fs.lstatAsync(filepath)
      return digest  
    }
    catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
      
    await writeFileToDiskAsync(tmppath, text)
    await child.execAsync(`chmod 444 ${tmppath}`)
    await fs.renameAsync(tmppath, filepath)
    return digest
  } 

  async retrieveObjectAsync(hash) {
    if (!isSHA256(hash)) throw new E.EINVAL()

    let filepath = path.join(this.docDir, hash)

    try {
      let data = await fs.readFileAsync(filepath)
      return JSON.parse(data.toString())
    } catch(e) {
      throw e
    }
  } 

  /**
    let promises = entries.map(entry => entryToTreeEntryAsync(entry))
    let treeEntries = await Promise.all(promises)
    treeEntries = treeEntries.filter(te => !!te)
  **/
  async storeDirAsync(dir) {
    let stat = await fs.lstatAsync(dir)
    if(!stat.isDirectory()) throw new E.ENOTDIR()

    let entries = await fs.readdirAsync(dir)
    let treeEntries = await Promise
      .map(entries, async entry => {
      
        let entryPath = path.join(dir, entry)
        let stat = await fs.lstatAsync(entryPath)
        
        if (stat.isDirectory())
          return ['tree', entry, await this.storeDirAsync(entryPath)]
        
        if (stat.isFile())
          return ['blob', entry, await this.storeFileAsync(entryPath)]

        return null
      })
      .filter(treeEntry => !!treeEntry)

    treeEntries = treeEntries.sort((a, b) => a[1].localeCompare(b[1]))
    return await this.storeObjectAsync(treeEntries)
  }
 
  // async storeListAsync() 

  // tree hash -> blob hash list [hash, hash, ...] unique, sort 
}

// const commit = (tree, parent, committer) => {
//   let time = new Date().getTime()
//   return { tree, parent, committer, time }
// }

module.exports = new Repo()

