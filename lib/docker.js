const request = require('superagent')

const baseUrl = 'http://127.0.0.1:1688'

function dockerApiGet(url) {
  return new Promise((resolve, reject) => 
    request.get(baseUrl + url)
      .set('Accept', 'application/json')
      .end((err, res) => err ? reject(err) : resolve(res.body)))
}

const containersUrl = '/containers/json?all=1'
const imagesUrl = '/images/json'
const infoUrl = '/info'
const versionUrl = '/version'
const volumesUrl = '/volumes'
const networksUrl = '/networks'

async function getThemAll() {

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

async function operation(req) {

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

module.exports = (req, callback) => {
  operation(req)
    .then(r => callback(null, r))
    .catch(e => {
      console.log('Warning: Docker Operation Error')
      console.log(req)
      console.log(e)
      callback(e)
    })
}

