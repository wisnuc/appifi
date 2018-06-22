/**
@module configuration
*/

/**
Parameterized configuration for appifi

@typedef Configuration
@property {object} chassis - chassis configuration
@property {boolean} chassis.userBinding - whether the system force a chassis-user binding or not
@property {boolean} chassis.volumeBinding - whether the system force a chassis-volume binding or not
@property {string} chassis.dir - chassis dir, located on rootfs/emmc or a separate partition
@property {string} chassis.tmpDir - chassis tmp dir, localted on the same file system with dir
@property {object} storage - storage configuration
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
  chassis: {
    userBinding: false,
    volumeBinding: true,
    dir: '/etc/wisnuc',
    tmpDir: '/etc/phicomm/atmp'
  },
  storage: {
    fruitmixDir: 'wisnuc/fruitmix',
    volumeDir: '/run/wisnuc/volumes',
    nonVolumeDir: '/run/wisnuc/blocks',
    userProps: ['uuid', 'username', 'isFirstUser', 'global' ]
  },
  tag: {
    isPrivate: false,
    visibleInPublicDrive: true,
  }
}

/**
configuration for phicomm n2
@constant {Configuration}
*/
const n2 = {
  chassis: {
    userBinding: true,
    volumeBinding: true,
    dir: '/mnt/reserved/userdata//phicomm',
    tmpDir: '/mnt/reserved/userdata//phicomm/atmp',
    dTmpDir: '/mnt/reserved/userdata//phicomm/dtmp'
  },
  storage: {
    fruitmixDir: 'phicomm/n2',
    volumeDir: '/run/phicomm/volumes',
    nonVolumeDir: '/run/phicomm/blocks',
    userProps: ['uuid', 'username', 'isFirstUser', 'phicommUserId']
  },
  slots: ['ata1', 'ata2'],
  tag: {
    isPrivate: true,
    visibleInPublicDrive: false
  },
  alternativeUserId: ['phicommUserId'],
  smbAutoStart: true,
  dlnaAutoStart: true
}


module.exports = {
  wisnuc: {
    default: wisnuc
  },
  phicomm: {
    n2
  }
}

