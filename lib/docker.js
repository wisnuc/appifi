const request = require('superagent')
const stream = require('stream')
const readline = require('readline')

const DockerAgent = require('./dockeragent')

const baseUrl = 'http://127.0.0.1:1688'

let dockerDaemon = null
let eventListener = null

async function delay(duration) {

  return  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

async function probeDaemon() {

  return await new Promise((resolve, reject) => {
    child.exec(`ps aux | grep docker | grep "docker daemon"`, (err, stdout, stderr) => {

      /** the assumption is only one instance of daemon now **/
      let cmdline = toLines(stdout).find(line => {
      /*  [ 'root', '12670', '0.0', '1.9', '555028', '39444', '?', 'Ssl', 'May03', '0:25', 'docker', 'daemon', // 12 total
            '--exec-root="/run/wisnuc/volumes/da2ba49b-1d16-4f6e-8005-bfaedd110814/root"', 
            '--graph="/run/wisnuc/volumes/da2ba49b-1d16-4f6e-8005-bfaedd110814/graph"',
            '--host="127.0.0.1:1688"',
            '--pidfile="/run/wisnuc/app/docker.pid"' ] */
        // console.log(line)
        let p = line.split(/\s+/)
        // console.log(p)
        if (p.length === 16 &&
            p[10] === 'docker' && 
            p[11] === 'daemon' &&
            p[12].startsWith('--exec-root=/run/wisnuc/volumes/') && 
            p[12].endsWith('/root') &&
            p[13].startsWith('--graph=/run/wisnuc/volumes/') &&
            p[13].endsWith('/graph') &&
            p[14] === '--host=127.0.0.1:1688' &&
            p[15] === '--pidfile=/run/wisnuc/app/docker.pid') return true
        return false
      })

      if (!cmdline) return resolve({running: false})
      let p = cmdline.split(/\s+/)
      let pid = parseInt(p[1])
      let pp = p[12].split(/\//)
      let volume = pp[pp.length - 2]
      resolve({running: true, pid, volume})
    })
  }) 
}

async function daemonStart(uuid) {

  if (dockerDaemon) throw 'docker daemon already started'

  await new Promise((resolve, reject) => {
    child.exec(`mkdir -p /run/wisnuc/app`, (err, stdout, stderr) => {
      err ? reject(stderr) : resolve(stdout)
    })
  })

  let out = fs.openSync('/dev/null', 'w')
  let err = fs.openSync('/dev/null', 'w')
  let mountpoint = `${dockerVolumesDir}/${uuid}`
  let opts = {
    cwd: mountpoint,
    detached: true, 
    stdio: ['ignore', out, err]
  }
 
  let args = [
    `daemon`, 
    `--exec-root=${mountpoint}/root`, 
    `--graph=${mountpoint}/graph`, 
    `--host=127.0.0.1:1688`,  
    `--pidfile=${dockerPidFile}`
  ]

  let dockerDaemon = child.spawn('docker', args, opts)
  console.log(`docker daemon started as ${daemon.pid}`)

  dockerDaemon.on('exit', (code, signal) => {
    dockerDaemon = null
    if (code !== undefined) console.log(`daemon exits with exitcode ${code}`)
    if (signal !== undefined) console.log(`daemon exits with signal ${signal}`)
  })

  await delay(1000)

  if (dockerDaemon === null) throw 'docker daemon stopped right after started'

  eventListener = new DockerAgent() 
}

async function daemonStop() {

  if (dockerDaemon) {
    dockerDaemon.kill()
  }      
}

const createEventStream = () => {

  let transform = new stream.Transform({ 
    transform: function (chunk, encoding, callback) {
      this.push(chunk)
      callback()
    },
  })

  let rl = readline.createInterface({input: transform})

  rl.on('line', (line) => {
    var msg = JSON.parse(line)
    console.log(JSON.stringify(msg, null, '  '))
  })

  request
    .get('http://127.0.0.1:1688/events')
    .pipe(transform)

}

function dockerApiGet(url) {
  return new Promise((resolve, reject) => 
    request.get(baseUrl + url)
      .set('Accept', 'application/json')
      .end((err, res) => err ? reject(err) : resolve(res.body)))
}

async function getThemAll() {

  const containersUrl = '/containers/json?all=1'
  const imagesUrl = '/images/json'
  const infoUrl = '/info'
  const versionUrl = '/version'
  const volumesUrl = '/volumes'
  const networksUrl = '/networks'

  let r = await Promise.all([
            dockerApiGet(containersUrl),
            dockerApiGet(imagesUrl),
            dockerApiGet(infoUrl),
            dockerApiGet(versionUrl),
            dockerApiGet(volumesUrl),
            dockerApiGet(networksUrl)
          ])

  let rr = await Promise.all(r[1].map(img => dockerApiGet(`/images/${img.Id.slice(7)}/json`)))

  return {
    containers : r[0],
    images: rr,
    info: r[2],
    version: r[3],
    volumes: r[4],
    networks: r[5]
  } 
}

async function containerStart(id) {

  return new Promise((resolve, reject) => 
    request.post(`${baseUrl}/containers/${id}/start`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res)
      }))
}

async function containerStop(id) {

  return new Promise((resolve, reject) => 
    request.post(`${baseUrl}/containers/${id}/stop`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res)
      }))
}

async function appInstall() {}

async function containerRemove(id) {

  return new Promise((resolve, reject) => 
    request.del(`${baseUrl}/containers/${id}`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res)  
      })) 
}

async function _operation(req) {

  let f, args
  if (req && req.operation) {
    
    args = (req.args && Array.isArray(req.args)) ? req.args : []
    switch (req.operation) {

      case 'containerStart':
        f = containerStart
        console.log('containerStart ' + args)
        break
      case 'containerStop':
        f = containerStop
        console.log('containerStop ' + args)
        break
      case 'containerRemove':
        f = containerRemove
        console.log('containerRemove ' + args)
        break
    }
  }

  if (f) await f(...args)
  return await getThemAll()
}

async function _init() {

  let daemon = await probeDaemon()
  if (daemon.running) {
    process.kill(daemon.pid) 
  }
}

module.exports = {

  operation: (req, callback) => {
    _operation(req)
      .then(r => callback(null, r))
      .catch(e => {
        console.log('Warning: Docker Operation Error')
        console.log(req)
        // console.log(e)
        callback(e)
      })
  },

  init: (callback) => {
    _init
      .then(() => {
        callback(null)  
      })
      .catch((e) => { 
        callback(err)
      })
  },
}


