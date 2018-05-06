



/**
Each entry is defined as 4-tuple

*/
const routing = {

  user: {
    prefix: '/users',
    routes: [
      ['/', 'LIST', 'user', { auth: 'allowAnonymous' }],
      ['/', 'POST', 'user', { auth: 'allowAnonymous' }],
      ['/:userUUID', 'GET', 'user'],
      ['/:userUUID', 'PATCH', 'user', { 
        // overriding auth
        auth: auth => (req, res, next) => 
          req.body.password === undefined 
            ? auth.jwt()(req, res, next) 
            : auth.basic()(req, res, next) 
      }],
      ['/:userUUID', 'DELETE', 'user']
    ]
  },

  drive: {
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
      ['/', 'LIST', 'file'],
      ['/', 'GET', 'file']
    ]
  },

  media: {
    prefix: '/media',
    routes: [
      ['/', 'LIST', 'media'],
      ['/:hash', 'GET', 'media']
    ]
  },

  xcopy: {
    prefix: '/tasks',
    routes: [
      ['/', 'LIST', 'xcopy'],
      ['/', 'POST', 'xcopy'],
      ['/:taskUUID', 'GET', 'xcopy'],
      ['/:taskUUID', 'DELETE', 'xcopy'],
      ['/:taskUUID/nodes/:nodeUUID', 'PATCH', 'xcopyNode'],
      ['/:taskUUID/nodes/:nodeUUID', 'DELETE', 'xcopyNode'],
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


module.exports = routing



