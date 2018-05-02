const Promise = require('bluebird')
const yaml = require('js-yaml')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const Mocha = require('mocha')

// Get document, or throw exception on error
try {
  var doc = yaml.safeLoad(fs.readFileSync('meta-test/meta/mkdir/tests.yaml', 'utf8'));
  console.log(doc)
} catch (e) {
  console.log(e)
  process.exit(1)
}

rimraf.sync('meta-test/generated')
mkdirp.sync('meta-test/generated')

let fd = fs.openSync('meta-test/generated/mkdir.js', 'w+')

fs.writeSync(fd, `
const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const { isUUID } = require('validator')

const request = require('supertest')

const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect

const Fruitmix = require('src/fruitmix/Fruitmix')
const App = require('src/app/App')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const fruitmixDir = path.join(tmptest, 'fruitmix')
`)

if (doc.users === 'alice') {
fs.writeSync(fd, `
const alice = {
  uuid: 'cb33b5b3-dd58-470f-8ccc-92aa04d75590',
  username: 'alice',
  password: '$2a$10$nUmDoy9SDdkPlj9yuYf2HulnbtvbF0Ei6rGF1G1UKUkJcldINaJVy',
  smbPassword: '4039730E1BF6E10DD01EAAC983DB4D7C',
  lastChangeTime: 1523867673407,
  isFirstUser: true,
  phicommUserId: 'alice'
}

`)
}

doc.groups.forEach(group => {
  console.log(group.desc)
  fs.writeSync(fd, `
describe("${group.desc}", done => {
})
  `)
})

fs.close(fd, () => {})

const mocha = new Mocha()

mocha.addFile('meta-test/generated/mkdir.js')
mocha.run(function(failures) {
  process.on('exit', function () {
    process.exit(failures)
  })
})




