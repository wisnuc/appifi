import clone from 'clone'
import request from 'superagent'

import localRecipes from 'hosted/apps'

import {validateRecipe, calcRecipeKeyString} from 'lib/dockerApps'

const jsonRecipesUrl = 'https://raw.githubusercontent.com/wisnuc/appifi/master/hosted/apps.json'
const hubUrl = 'https://hub.docker.com/v2'
const repoUrl = (name, namespace) => hubUrl + '/repositories/'; 

let useLocalRecipes = false

let memo = {
  status: 'init', // 'refreshing', 'success', 'error'
  message: null,  // for error message
  apps: []        // for apps
}

// future
let appstoreState = {

  status: 'INIT', // 'UPDATING', 'READY', 'ERROR'
  message: null,  // for error state

  recipes: null,  // recipes, []
  map: null,      // 
}

function info(text) {
  console.log(`[appstore] ${text}`)
}

// retrieve text/plain file from url
async function retrieveText(url) {
  return new Promise((resolve, reject) => {
    request.get(url)
      .set('Accept', 'text/plain')
      .end((err, res) => {
        err ? reject(err) : resolve(res.text)
      })
  })
}

/* this promise never reject */
function retrieveRepo(namespace, name) {

  return new Promise((resolve) => { // never reject
    let url = `https://hub.docker.com/v2/repositories/${namespace}/${name}`
    request.get(url)
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) resolve(null)
        else if (!res.ok) resolve(null)
        else resolve(res.body)
      })
  }) 
}

async function retrieveRecipes() {

  let recipes = null
  if (useLocalRecipes) {
    recipes = localRecipes
  }
  else {
    info('retrieve json recipes')
    let jsonRecipes = await retrieveText(jsonRecipesUrl)
    info('parse json recipes')
    recipes = JSON.parse(jsonRecipes)
  }

  recipes.filter(recipe => validateRecipe(recipe)) 
  return recipes 
}

async function retrieveRepoMap(recipes) {

  if (!recipes) {
    warn(`retrieveRepoMap: recipes null or undefined`)
    return null
  }

  info(`retrieving repos for recipes`)
  let compos = []
  recipes.forEach(recipe => 
    (recipe.components && recipe.components.length) ?
      compos = [...compos, ...recipe.components] : null )

  let repos = await Promise.all(compos.map(compo =>
        retrieveRepo(compo.namespace, compo.name)))

  let map = new Map()
  for (let i = 0; i < recipes.length; i++) {
    map.set(compos[i], repos[i])
  }
  
  return map
}

/* request all repos and neglect error */
async function retrieveAllRepos() {

  let recipes = await retrieveRecipes()
  if (!recipes) return null

  let components = []
  recipes.forEach(recipe => {
    if (recipe.components) {
      components = [...components, ...recipe.components]
    }
  })
  
  info('request all recipes repo information')
  let repos = await Promise.all(components.map(compo => retrieveRepo(compo.namespace, compo.name)))

  for (let i = 0; i < components.length; i++) {
    components[i].repo = repos[i]
  }

  info(`repo info updated, ${recipes.length} recipes, ${components.length} components, ${components.filter(c => c.repo !== null).length} repos`)
  return recipes
}

// TODO
export async function refreshAppStore() {

  let recipes = await retrieveRecipes()
  if (!recipes) return null

  let repoMap = await retrieveRepoMap(recipes)
  return { recipes, repoMap }
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

// TODO move to elsewhere
function getApp(recipeKeyString) {

  if (memo.status !== 'success') return null
  let app = memo.apps.find(app => recipeKeyString === calcRecipeKeyString(app))
  return app ? clone(app) : null 
}

export default {

  init: () => {
    info('initialize')
    refresh(memo)
  },
  get: () => memo,
  refresh: (callback) => refresh(memo, callback),
  
  /* server side use */
  getApp
}


