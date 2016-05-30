

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

function signatureKey(app) {
  
  let sig = signature(app)
  if (!sig) return null

  return `${sig.registry}:${sig.namespace}:${sig.name}:${sig.tag}:${sig.flavor}`
}

