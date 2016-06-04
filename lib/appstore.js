import clone from 'clone'
import request from 'superagent'

import localRecipes from 'hosted/apps'
import { validateRecipe, calcRecipeKeyString } from 'lib/dockerApps'
import { storeState, storeDispatch } from 'lib/reducers'

const jsonRecipesUrl = 'https://raw.githubusercontent.com/wisnuc/appifi/master/hosted/apps.json'

let useLocalRecipes = false

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

// TODO
export async function refreshAppStore() {

  let appstore = storeState().appstore
  if (appstore === 'LOADING') {
    info('appstore is already loading')
    return
  }

  storeDispatch({
    type: 'APPSTORE_UPDATE',
    data: 'LOADING' 
  })

  let recipes = await retrieveRecipes()
  if (!recipes) {
    storeDispatch({
      type: 'APPSTORE_UPDATE',
      data: 'ERROR'
    })
    return
  }

  let repoMap = await retrieveRepoMap(recipes)
  if (!repoMap) {
    storeDispatch({
      type: 'APPSTORE_UPDATE',
      data: 'ERROR'
    })
  }

  storeDispatch({
    type: 'APPSTORE_UPDATE',
    data: { recipes, repoMap }
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
    info('loading')
    refreshAppStore().then(r => {}).catch(e => {})
  },
  get: () => memo,
  
  /* server side use */
  getApp
}


