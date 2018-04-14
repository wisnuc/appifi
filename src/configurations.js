/**
@module configuration
*/

/**
Parameterized configuration for appifi

@typedef Configuration
@property {Object} storage - storage configuration
@property {string} storage.fruitmixDir - fruitmix directory path relative to volume mountpoint.
@property {string} storage.volumeDir - absolute dir path where volumes mount points are created.
@property {string} storage.nonVolumeDir - absolute dir path where non volume mount points are created. 
@property {string[] } storage.userProps - user props returned to client when probing fruitmix
*/


/** 
configuration for wisnuc devices
@constant {Configuration} 
*/
const wisnuc = {
  storage: {
    fruitmixDir: 'wisnuc/fruitmix',
    volumeDir: '/run/wisnuc/volumes',
    nonVolumeDir: '/run/wisnuc/blocks',
    userProps: ['uuid', 'username' ]
  }
}

/**
configuration for phicomm n2
*/
const n2 = {
  storage: {
    fruitmixDir: 'phicomm/n2',
    volumeDir: '/run/phicomm/volumes',
    nonVolumeDir: '/run/phicomm/blocks',
    userProps: ['uuid', 'username']
  }
}


module.exports = {
  wisnuc: {
    default: wisnuc
  },
  phicomm: {
    n2
  }
}

