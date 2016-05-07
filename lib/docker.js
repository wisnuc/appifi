var request = require('superagent')

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
  return {
    containers : r[0],
    images: r[1],
    info: r[2],
    version: r[3],
    volumes: r[4],
    networks: r[5]
  } 
}

async function operation(req) {

  let f, args
  if (req && req.operation) {
    
    args = (req.args && Array.isArray(req.args)) ? req.args : []
    switch (req.operation) {
    }
  }

  if (f) await f(...args)
  return await getThemAll()
}

module.exports = (req, callback) => {
  operation(req)
    .then(r => callback(null, r))
    .catch(e => {
      console.log(req)
      console.loge(e)
      callback(e)
    })
}

