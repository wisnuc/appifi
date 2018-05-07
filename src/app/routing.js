
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
      ['/:fingerprint', 'GET', 'media']
    ]
  },

  task: {
    prefix: '/tasks',
    routes: [
      ['/', 'LIST', 'task'],
      ['/', 'POST', 'task'],
      ['/:taskUUID', 'GET', 'task'],
      ['/:taskUUID', 'DELETE', 'task'],
      ['/:taskUUID/nodes/:nodeUUID', 'PATCH', 'taskNode'],
      ['/:taskUUID/nodes/:nodeUUID', 'DELETE', 'taskNode']
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
  }
}
