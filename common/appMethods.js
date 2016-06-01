/*
function signature(app) {

  if (app.components.length === 0) return null
  let compo = app.components[0]
  let registry, namespace, name, tag, flavor
  registry = compo.registry ? compo.registry : 'dockerhub'
  namespace = compo.namespace ? compo.namespace : 'library'
  name = compo.name
  tag = compo.tag ? compo.tag : 'latest'
  flavor = app.flavor ? app.flavor : 'vanilla'
  return {registry, namespace, name, tag, flavor}
}

function validateSigKey(key) {

  if (typeof key !== 'string') return false
  if (key.length === 0) return false

  if (
}

function containerSignature(container) {

  let sig, label = container.Labels['appifi-signature']
  if (label === 'undefined') return null

  try {
    sig = JSON.parse(label)
    if (
  }
  catch (e) {
  }
}

function signatureKey(app) {
  
  let sig = signature(app)
  if (!sig) return null

  return `${sig.registry}:${sig.namespace}:${sig.name}:${sig.tag}:${sig.flavor}`
}

function signatureRecipe(app) {
  
  return JSON.stringify(app)
}

function appLabel(app) {

  let stripped = Object.assign({}, app).components.forEach(compo => compo.repo = null)
  return JSON.stringify({
    key: signatureKey(app), 
    app:stripped
  })
}
*/
/*
 * managed, unmanaged
 *
 * for managed: 
 * complete, incomplete
 */
function organize(containers) {

  let managed = []
  let unmanaged = []

  // divide into managed and unmanaged
  containers.forEach(c => {
    if (c.Labels['appifi-signature'] !== 'undefined') {
      managed.push(c) 
    }
    else {
      unmanaged.push(c)
    }
  }) 

  let valid = []
  let invalid = []
  managed.forEach(c => {
    let sig = c.Labels['appifi-signature']
    let v = {}

    if (typeof sig !== 'string') {
      invalid.push(c)
    }
    else {
      try {
        v = Object.assign({}, JSON.parse(sig), {sig})
        v.container = c
        valid.push(v)
      }    
      catch (e) {
        invalid.push(c)
      }
    }
  })

  /*
   *  sample element
   *
   *  {
        key: key string
        members: [
          { 
            key: // extracted from sig
            app: // extracted from sig
            sig: // sig
            container: // container object from docker
          },
        ]
   *  } 
   */
  let keyGroups = []
  valid.forEach(v => {
    let g = keyGroups.find(g => g.key === v.key)
    if (g) {
      g.members.push(v)
    }
    else {
      keyGroups.push({
        key: v.key,
        members: [v]
      })
    }
  })

  function decorateKeyedGroup(kg) {
    
  }

  keyGroups.forEach(k => pretty(k))
}

//export {appLabel, organize}
































