import request from 'superagent'
import localApps from 'hosted/apps'

const appListUrl = 'https://raw.githubusercontent.com/wisnuc/appifi/master/hosted/apps.json'
const hubUrl = 'https://hub.docker.com/v2'
const repoUrl = (name, namespace) => hubUrl + '/repositories/'; 

let useLocalApps = true

let memo = {
  status: 'init', // 'refreshing', 'success', 'error'
  message: null,  // for error message
  apps: []        // for apps
}

function info(text) {
  console.log(`[appstore] ${text}`)
}

function retrieveAppList(url) {

  return new Promise((resolve, reject) => {

    request.get(url)
      .set('Accept', 'text/plain')
      .end((err, res) => {
        err ? reject(err) : resolve(res.text)
      })
  })
}

/** tag is useless now **/
/*
function requestTag(url) {

  return new Promise((resolve, reject) => {
    
    request.get(url)
      .set('Accpt', 'application/json')
      .end((err, res) => {
        if (err) resolve(err)
        else if (!res.ok) resolve(new Error('Bad Response'))
        else resolve(res.body)
      })
  })
}
*/

/* this promise never reject */
async function retrieveRepo(compo) {

  compo.repo = await new Promise((resolve) => { // never reject

    let url = `https://hub.docker.com/v2/repositories/${compo.namespace}/${compo.name}`
    console.log(url)

    request.get(url)
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) resolve(null)
        else if (!res.ok) resolve(null)
        else resolve(res.body)
      })
  }) 
}

/* request all repos and neglect error */
async function retrieveAllRepos() {

  let apps

  if (useLocalApps) {
    apps = localApps
  }
  else {
    info('requesting apps text')
    let appsText = await retrieveAppList(appListUrl)

    info('parse apps text')
    apps = JSON.parse(appsText)
  }

  let components = []
  apps.forEach(app => {
    if (app.components) {
      components = [...components, ...app.components]
    }
  })
  
  info('request all apps repo information')
  await Promise.all(components.map(compo => retrieveRepo(compo)))

  info(`repo info updated, ${apps.length} apps, ${components.length} components, ${components.filter(c => c.repo !== null).length} repos`)
  return apps
}

function refresh(memo, callback) {

  if (typeof callback !== 'undefined' && typeof callback !== 'function')
    throw 'callback must be a function if provided'

  if (memo.status === 'refreshing') return callback(null, memo)

  memo.status = 'refreshing'
  memo.message = null
  memo.apps = []

  retrieveAllRepos()
    .then(r => {
      memo.status = 'success'
      memo.message = null
      memo.apps = r

      if (callback) callback(null, memo)
    })
    .catch(e => {
      info(`ERROR: ${e.message}`)
      memo.status = 'error'
      memo.message = e.message
      memo.apps = [] 

      if (callback) callback(null, memo)
    })
}

export default {

  init: () => {
    info('initialize')
    refresh(memo)
  },

  get: () => memo,

  refresh: (callback) => refresh(memo, callback) 
}

/** for unit testing **/

let unit = {
  memo,
  retrieveAppList,
  retrieveRepo,
  retrieveAllRepos
}

export { unit }
