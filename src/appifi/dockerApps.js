/*

  concepts

  1. recipe
  2. container label

  container label is a JSON string

  container.Labels: {
    "appifi-signature": "...." // container label string 
  }

  a container label object format
  {
    uuid: uuid // installation instance
    recipe
  }

  recipe format

  app, app is a recipe with repo appended onto components

  label is a {uuid, recipe} tuple
 */

import validator from 'validator'
import nodeUUID from 'node-uuid'
import stringify from 'canonical-json'

function textMatch(text) {
  return  /^[A-Za-z][A-Za-z0-9-_+\.]*$/.test(text)
}

export function validateRecipe(recipe) {

  if (!recipe) return false

  if (!recipe.appname || !textMatch(recipe.appname)) return false
  if (!recipe.components || 
      !Array.isArray(recipe.components) || 
      recipe.components.length === 0) return false

  recipe.components.forEach(compo => {
    if (!compo.name || !textMatch(compo.name)) return false
    if (!compo.namespace || !textMatch(compo.namespace)) return false
    if (!compo.tag || !textMatch(compo.tag)) return false
    if (typeof compo.configOverlay !== 'boolean') return false
    if (typeof compo.config !== 'object') return false
    if (typeof compo.repo !== 'null') return false
  })

  return true
}

// extract key object from recipe or app object (ducktype)
export function calcRecipeKey(recipe) {

  if (recipe.components.length === 0) return null
  let compo = recipe.components[0]
  let registry, namespace, name, tag, flavor

  registry = compo.registry ? compo.registry : 'dockerhub'
  namespace = compo.namespace ? compo.namespace : 'library'
  name = compo.name
  tag = compo.tag ? compo.tag : 'latest'
  flavor = recipe.flavor ? recipe.flavor : 'vanilla'

  return {registry, namespace, name, tag, flavor}  
}

export function calcRecipeKeyString(recipe) {

  let key = calcRecipeKey(recipe)
  if (!key) return null

  return `${key.registry}:${key.namespace}:${key.name}:${key.tag}:${key.flavor}`
}

export function splitRecipeKeyString(text) {

  let keys = text.split(':')
  if (keys.length !== 5) return null

  return {
    registry: keys[0],
    namespace: keys[1],
    name: keys[2],
    tag: keys[3],
    flavor: keys[4]
  }  
}

export function composeJsonLabel(uuid, recipe) {
  
  if (!uuid || !validator.isUUID(uuid)) return null
  if (!validateRecipe(recipe)) return null

  let version = '1.0'
  return stringify({version, uuid, recipe})  
}

export function installAppifiLabel(labels, uuid, recipe) {
  
  if (!labels) return
  labels[APPIFI_KEY] = composeJsonLabel(uuid, recipe)
}

export function uncomposeJsonLabel(json) {

  if (typeof json !== 'string') return null
  if (!validator.isJSON(json)) return null

  let sig = JSON.parse(json)
  if (!sig) return null

  // TODO validate version string
 
  // ! important validator throws ReferenceError for undefined 
  if (!sig.uuid || !validator.isUUID(sig.uuid)) return null
  if (!validateRecipe(sig.recipe)) return null

  return sig 
}

export const APPIFI_KEY = 'appifi-signature'


/**************************************************

  groups: [
    { // group
      uuid: xxxx, // group uuid
      pairs: [
        {
          sig: {
            version: '1.0', // version string
            uuid: xxxx, // uuid
            recipe: {   // a valid recipe
              ...       
            }
          },
          container: xxxx, // reference to container
        },
        ...
      ]
    },
    ...
  ]

*****************************************************/

// group well-labelled container by uuid, using {sig, container} tuple as element
function groupContainersByUUID(containers) {

  let groups = []
  containers.forEach(container => { 

    let sig = uncomposeJsonLabel(container.Labels[APPIFI_KEY])
    if (!sig) return

    let group = groups.find(g => g.uuid === sig.uuid)
    group ? group.pairs.push({sig, container}) :
      groups.push({ // create the group and push the first pair
        uuid: sig.uuid,
        pairs: [{sig, container}]
      })
  }) 

  return groups
}

function containerMatchComponent(container, component) {

  let {name, namespace, tag} = component
  return (container.Image === `${namespace}/${name}`)
}

function containersMatchComponents(group) {

  let components = group.pairs[0].sig.recipe.components

  /*  component fields: name, namespace, tag, 
   *  container fields: Image -> "library/busybox"
                        ImageId -> "sha256:47bcc53f7..." TODO
                          --> Image -> Id: ...
                                       RepoTags: ["redis:latest"]
   */
  if (components.length !== group.pairs.length) return false
  return components.every(compo => 
    group.pairs.find(pair => 
      containerMatchComponent(pair.container, compo)))
}

function containerGroupToApp(group) {

  let recipe = group.pairs[0].sig.recipe
  let recipeKeyString = calcRecipeKeyString(recipe)
  let uuid = group.uuid
  let sigVersion = group.pairs[0].sig.version
  let match = group.match

  let containers = group.pairs.map(pair => pair.container)

  return { recipe, recipeKeyString, uuid, sigVersion, match, containers }
}

export function appMainContainer(app) {
  
  let {name, namespace, tag} = app.recipe.components[0]  
  return app.containers.find(c => c.Image === `${namespace}/${name}`)
}

export function containersToApps(containers) {

  let groups = groupContainersByUUID(containers)
  groups.forEach(group => group.match = containersMatchComponents(group))
  return groups.map(group => containerGroupToApp(group))
}


