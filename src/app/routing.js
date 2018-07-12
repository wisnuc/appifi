
/**
Each entry is defined as 4-tuple

0: route path
1: method
2: module
3: opts
*/
module.exports = {
  user: {
    prefix: '/users',
    routes: [
      ['/', 'LIST', 'user', { auth: 'allowAnonymous' }],
      ['/', 'POST', 'user', { auth: 'allowAnonymous' }],
      ['/:userUUID', 'GET', 'user'],
      ['/:userUUID', 'PATCH', 'user', {
        auth: auth => (req, res, next) =>
          req.body.password === undefined
            ? auth.jwt()(req, res, next)
            : auth.basic()(req, res, next)
      }],
      ['/:userUUID', 'DELETE', 'user']
    ]
  },

  drives: {
    prefix: '/drives',
    routes: [
      ['/', 'LIST', 'drive'],
      ['/', 'POST', 'drive'],
      ['/:driveUUID', 'GET', 'drive'],
      ['/:driveUUID', 'PATCH', 'drive'],
      ['/:driveUUID', 'DELETE', 'drive'],
      ['/:driveUUID/dirs/:dirUUID', 'GET', 'dir'],
      ['/:driveUUID/dirs/:dirUUID', 'PATCH', 'dir'],
      ['/:driveUUID/dirs/:dirUUID/stats', 'GET', 'dirStats'],
      ['/:driveUUID/dirs/:dirUUID/entries', 'POSTFORM', 'dirEntry'],
      ['/:driveUUID/dirs/:dirUUID/entries/:fileUUID', 'GET', 'dirEntry']
    ]
  },

  tag: {
    prefix: '/tags',
    routes: [
      ['/', 'LIST', 'tag'],
      ['/', 'POST', 'tag'],
      ['/:tagId', 'GET', 'tag'],
      ['/:tagId', 'PATCH', 'tag'],
      ['/:tagId', 'DELETE', 'tag']
    ]
  },

  file: {
    prefix: '/files',
    routes: [
      ['/', 'LIST', 'file']
    // ['/:fileUUID', 'GET', 'file']
    ]
  },

  media: {
    prefix: '/media',
    routes: [
      ['/', 'LIST', 'media'],
      ['/:fingerprint', 'GET', 'media', {
        auth: auth => (req, res, next) => 
          /[a-f0-9]{160}/.test(req.params.fingerprint) 
            ? next() 
            : auth.jwt()(req, res, next)
      }]
    ]
  },

  task: {
    prefix: '/tasks',
    routes: [
      ['/', 'LIST', 'task'],
      ['/', 'POST', 'task'],
      ['/:taskUUID', 'GET', 'task'],
      ['/:taskUUID', 'PATCH', 'task'], // for stepper only
      ['/:taskUUID', 'DELETE', 'task'],
      ['/:taskUUID/nodes/:nodeUUID', 'PATCH', 'taskNode'],
    ]
  },

  nfs: {
    prefix: '/phy-drives',
    routes: [
      ['/', 'LIST', 'nfs'],
      ['/:id', 'GET', 'nfs'],
      ['/:id', 'POSTFORM', 'nfs'],
      ['/:id', 'PATCH', 'nfs'],
      ['/:id', 'PUT', 'nfs'],
      ['/:id', 'DELETE', 'nfs']
    ]
  },

  fruitmix: {
    prefix: '/fruitmix',
    routes: [
      ['/stats', 'GET', 'stats']
    ]
  },

  transmission: {
    prefix: '/transmission',
    routes: [
      ['/', 'LIST', 'transmission'],
      ['/:type', 'POST', 'transmission', { needReq: true }],
      ['/:id', 'PATCH', 'transmission']
    ]
  },

  samba: {
    prefix: '/samba',
    routes: [
      ['/', 'GET', 'samba'],
      ['/', 'PATCH', 'samba']
    ]
  },

  dlna: {
    prefix: '/dlna',
    routes: [
      ['/', 'GET', 'dlna'],
      ['/', 'PATCH', 'dlna']
    ]
  }
}
