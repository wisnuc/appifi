const Promise = require('bluebird')
const path = require('path')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const deepFreeze = require('deep-freeze')

// see test/scripts/mk10disks.js
const UUIDBC = 'ea774718-30db-41fd-b64f-4dec14bc935d'
const UUIDDE = '73defbe1-00d3-4891-9377-5de6689fc179'
const UUIDF = 'a840b693-018b-4080-8aca-9abe40b85f24'
const UUIDG = 'f7997c56-547b-4fd3-b738-d244845d8907'
const UUIDH = '0a78bbec-5cf5-4f6c-b72d-022c76f6c782'

//
const fakeStorage = tmptest => deepFreeze({
  ports: [
    {
      path: '/devices/pci0000:00/0000:00:01.1/ata1/ata_port/ata1',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:01.1/ata2/ata_port/ata2',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/ata_port/ata3',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata4/ata_port/ata4',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata5/ata_port/ata5',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata6/ata_port/ata6',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata7/ata_port/ata7',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata8/ata_port/ata8',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata9/ata_port/ata9',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata10/ata_port/ata10',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/ata_port/ata11',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/ata_port/ata12',
      subsystem: 'ata_port'
    },
    {
      path: '/devices/pci0000:00/0000:00:0d.0/ata13/ata_port/ata13',
      subsystem: 'ata_port'
    }
  ],
  blocks: [
    {
      name: 'sda',
      devname: '/dev/sda',
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/host2/target2:0:0/2:0:0:0/block/sda',
      removable: false,
      size: 134217728,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VBefabb17b-c1f7d538',
      isPartitioned: true,
      partitionTableType: 'dos',
      partitionTableUUID: 'e09e125a',
      idBus: 'ata',
      isATA: true,
      unformattable: 'ActiveSwap:RootFS'
    },
    {
      name: 'sdb',
      devname: '/dev/sdb',
      path: '/devices/pci0000:00/0000:00:0d.0/ata4/host3/target3:0:0/3:0:0:0/block/sdb',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VBad62acb3-ff52abac',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: 'ea774718-30db-41fd-b64f-4dec14bc935d',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: 'ea774718-30db-41fd-b64f-4dec14bc935d',
      btrfsDevice: '9c459e86-f479-446a-a0ba-643cd54b1524',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/ea774718-30db-41fd-b64f-4dec14bc935d'
      mountpoint: path.join(tmptest, 'sdbc')
    },
    {
      name: 'sdc',
      devname: '/dev/sdc',
      path: '/devices/pci0000:00/0000:00:0d.0/ata5/host4/target4:0:0/4:0:0:0/block/sdc',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB2365ad39-c6b9d1b4',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: 'ea774718-30db-41fd-b64f-4dec14bc935d',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: 'ea774718-30db-41fd-b64f-4dec14bc935d',
      btrfsDevice: 'e8cc9662-87f3-4cb0-b616-92459432ac24',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/ea774718-30db-41fd-b64f-4dec14bc935d'
      mountpoint: path.join(tmptest, 'sdbc')
    },
    {
      name: 'sdd',
      devname: '/dev/sdd',
      path: '/devices/pci0000:00/0000:00:0d.0/ata6/host5/target5:0:0/5:0:0:0/block/sdd',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB1c5aa605-b0c794d2',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: '73defbe1-00d3-4891-9377-5de6689fc179',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: '73defbe1-00d3-4891-9377-5de6689fc179',
      btrfsDevice: '11e6740b-505d-4bb1-9ebd-66584d070e05',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/73defbe1-00d3-4891-9377-5de6689fc179'
      mountpoint: path.join(tmptest, 'sdde')
    },
    {
      name: 'sde',
      devname: '/dev/sde',
      path: '/devices/pci0000:00/0000:00:0d.0/ata7/host6/target6:0:0/6:0:0:0/block/sde',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VBfa79c0c6-a84645cc',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: '73defbe1-00d3-4891-9377-5de6689fc179',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: '73defbe1-00d3-4891-9377-5de6689fc179',
      btrfsDevice: 'b2628548-1840-4141-aba1-3830942db03d',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/73defbe1-00d3-4891-9377-5de6689fc179'
      mountpoint: path.join(tmptest, 'sdde')
    },
    {
      name: 'sdf',
      devname: '/dev/sdf',
      path: '/devices/pci0000:00/0000:00:0d.0/ata8/host7/target7:0:0/7:0:0:0/block/sdf',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB7f55e939-3394d2ac',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: 'a840b693-018b-4080-8aca-9abe40b85f24',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: 'a840b693-018b-4080-8aca-9abe40b85f24',
      btrfsDevice: 'dd2e99a2-d095-4a57-8a2b-3c9668172777',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/a840b693-018b-4080-8aca-9abe40b85f24'
      mountpoint: path.join(tmptest, 'sdf')
    },
    {
      name: 'sdg',
      devname: '/dev/sdg',
      path: '/devices/pci0000:00/0000:00:0d.0/ata9/host8/target8:0:0/8:0:0:0/block/sdg',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB1b63b70c-bf6ed492',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: 'f7997c56-547b-4fd3-b738-d244845d8907',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: 'f7997c56-547b-4fd3-b738-d244845d8907',
      btrfsDevice: '6871f957-6095-44b4-b0fd-a8737bc946e6',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/f7997c56-547b-4fd3-b738-d244845d8907'
      mountpoint: path.join(tmptest, 'sdg')
    },
    {
      name: 'sdh',
      devname: '/dev/sdh',
      path: '/devices/pci0000:00/0000:00:0d.0/ata10/host9/target9:0:0/9:0:0:0/block/sdh',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB50bcc803-48658988',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: '0a78bbec-5cf5-4f6c-b72d-022c76f6c782',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: '0a78bbec-5cf5-4f6c-b72d-022c76f6c782',
      btrfsDevice: '9c1e9c78-6212-4d89-adfa-ca76be1b72c2',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/0a78bbec-5cf5-4f6c-b72d-022c76f6c782'
      mountpoint: path.join(tmptest, 'sdh')
    },
    {
      name: 'sdi',
      devname: '/dev/sdi',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB7170169e-99dc63eb',
      isPartitioned: true,
      partitionTableType: 'dos',
      partitionTableUUID: 'c2711e2f',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sdj',
      devname: '/dev/sdj',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VBd502a4dd-3e824065',
      isPartitioned: true,
      partitionTableType: 'dos',
      partitionTableUUID: '51cd2751',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sdk',
      devname: '/dev/sdk',
      path: '/devices/pci0000:00/0000:00:0d.0/ata13/host12/target12:0:0/12:0:0:0/block/sdk',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB948d10bc-b05d4462',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sda1',
      devname: '/dev/sda1',
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/host2/target2:0:0/2:0:0:0/block/sda/sda1',
      removable: false,
      size: 125827072,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: '13ca8877-d667-49d6-b9f0-811b167ab02a',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: '13ca8877-d667-49d6-b9f0-811b167ab02a',
      btrfsDevice: '37d0256b-a05d-47a2-a81c-c590a11781bc',
      parentName: 'sda',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      mountpoint: '/',
      isRootFS: true,
      unformattable: 'RootFS'
    },
    {
      name: 'sda2',
      devname: '/dev/sda2',
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/host2/target2:0:0/2:0:0:0/block/sda/sda2',
      removable: false,
      size: 0,
      isPartition: true,
      parentName: 'sda',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sda5',
      devname: '/dev/sda5',
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/host2/target2:0:0/2:0:0:0/block/sda/sda5',
      removable: false,
      size: 8384512,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'other',
      fileSystemType: 'swap',
      fileSystemUUID: '455eba82-746e-42bc-8b14-28c44b938254',
      isOtherFileSystem: true,
      isLinuxSwap: true,
      parentName: 'sda',
      idBus: 'ata',
      isATA: true,
      isActiveSwap: true,
      unformattable: 'ActiveSwap'
    },
    {
      name: 'sdi1',
      devname: '/dev/sdi1',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi/sdi1',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ext4',
      fileSystemUUID: 'e2df3fd3-25a5-4dfc-9b5d-63588be3d0c2',
      isFileSystem: true,
      isExt4: true,
      parentName: 'sdi',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/blocks/sdi1'
      mountpoint: path.join(tmptest, 'sdi1')
    },
    {
      name: 'sdi2',
      devname: '/dev/sdi2',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi/sdi2',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ntfs',
      fileSystemUUID: '62518B9322EB0E9C',
      isFileSystem: true,
      isNtfs: true,
      parentName: 'sdi',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/blocks/sdi2'
      mountpoint: path.join(tmptest, 'sdi2')
    },
    {
      name: 'sdi3',
      devname: '/dev/sdi3',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi/sdi3',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'vfat',
      fileSystemUUID: '24E0-4EF9',
      isFileSystem: true,
      isVfat: true,
      parentName: 'sdi',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/blocks/sdi3'
      mountpoint: path.join(tmptest, 'sdi3')
    },
    {
      name: 'sdi4',
      devname: '/dev/sdi4',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi/sdi4',
      removable: false,
      size: 2,
      isPartition: true,
      isExtended: true,
      parentName: 'sdi',
      idBus: 'ata',
      isATA: true,
      unformattable: 'Extended'
    },
    {
      name: 'sdi5',
      devname: '/dev/sdi5',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi/sdi5',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ext4',
      fileSystemUUID: '31b197bd-7d71-4add-a08a-9c3a1df15eb9',
      isFileSystem: true,
      isExt4: true,
      parentName: 'sdi',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/blocks/sdi5'
      mountpoint: path.join(tmptest, 'sdi5')
    },
    {
      name: 'sdi6',
      devname: '/dev/sdi6',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi/sdi6',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ntfs',
      fileSystemUUID: '7E28707D0CAECF1A',
      isFileSystem: true,
      isNtfs: true,
      parentName: 'sdi',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/blocks/sdi6'
      mountpoint: path.join(tmptest, 'sdi6')
    },
    {
      name: 'sdi7',
      devname: '/dev/sdi7',
      path: '/devices/pci0000:00/0000:00:0d.0/ata11/host10/target10:0:0/10:0:0:0/block/sdi/sdi7',
      removable: false,
      size: 10477568,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'vfat',
      fileSystemUUID: '24E1-AD3A',
      isFileSystem: true,
      isVfat: true,
      parentName: 'sdi',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      // mountpoint: '/run/phicomm/blocks/sdi7'
      mountpoint: path.join(tmptest, 'sdi7')
    },
    {
      name: 'sdj1',
      devname: '/dev/sdj1',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj/sdj1',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'xfs',
      fileSystemUUID: 'aa04bbd0-f666-43eb-ba8e-373dd28d123d',
      isFileSystem: true,
      parentName: 'sdj',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sdj2',
      devname: '/dev/sdj2',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj/sdj2',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'other',
      fileSystemType: 'swap',
      fileSystemUUID: '708dfb1d-3c3c-47a8-b94a-99a1061fa348',
      isOtherFileSystem: true,
      isLinuxSwap: true,
      parentName: 'sdj',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sdj3',
      devname: '/dev/sdj3',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj/sdj3',
      removable: false,
      size: 2097152,
      isPartition: true,
      parentName: 'sdj',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sdj4',
      devname: '/dev/sdj4',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj/sdj4',
      removable: false,
      size: 2,
      isPartition: true,
      isExtended: true,
      parentName: 'sdj',
      idBus: 'ata',
      isATA: true,
      unformattable: 'Extended'
    },
    {
      name: 'sdj5',
      devname: '/dev/sdj5',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj/sdj5',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'xfs',
      fileSystemUUID: '418b988b-cae1-4efd-a25b-1c5681c82022',
      isFileSystem: true,
      parentName: 'sdj',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sdj6',
      devname: '/dev/sdj6',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj/sdj6',
      removable: false,
      size: 2097152,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'other',
      fileSystemType: 'swap',
      fileSystemUUID: '9468a003-d5af-48d2-96a7-f85ac6ad636e',
      isOtherFileSystem: true,
      isLinuxSwap: true,
      parentName: 'sdj',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sdj7',
      devname: '/dev/sdj7',
      path: '/devices/pci0000:00/0000:00:0d.0/ata12/host11/target11:0:0/11:0:0:0/block/sdj/sdj7',
      removable: false,
      size: 10477568,
      isPartition: true,
      parentName: 'sdj',
      idBus: 'ata',
      isATA: true
    }
  ],
  volumes: [
    {
      missing: false,
      devices: [
        {
          name: 'sda1',
          path: '/dev/sda1',
          id: 1,
          used: '42.02GiB'
        }
      ],
      label: '',
      uuid: '13ca8877-d667-49d6-b9f0-811b167ab02a',
      total: 1,
      used: '6.44GiB',
      isVolume: true,
      isMissing: false,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: '13ca8877-d667-49d6-b9f0-811b167ab02a',
      isMounted: true,
      mountpoint: '/',
      isRootFS: true,
      users: {
        code: 'ENOENT',
        message: 'fruitmix dir not found'
      }
    },
    {
      missing: false,
      devices: [
        {
          name: 'sdb',
          path: '/dev/sdb',
          id: 1,
          used: '2.01GiB',
          size: 10737418240,
          unallocated: 8581545984,
          system: {
            mode: 'RAID1',
            size: 8388608
          },
          metadata: {
            mode: 'RAID1',
            size: 1073741824
          },
          data: {
            mode: 'RAID1',
            size: 1073741824
          }
        },
        {
          name: 'sdc',
          path: '/dev/sdc',
          id: 2,
          used: '2.01GiB',
          size: 10737418240,
          unallocated: 8581545984,
          system: {
            mode: 'RAID1',
            size: 8388608
          },
          metadata: {
            mode: 'RAID1',
            size: 1073741824
          },
          data: {
            mode: 'RAID1',
            size: 1073741824
          }
        }
      ],
      label: '',
      uuid: 'ea774718-30db-41fd-b64f-4dec14bc935d',
      total: 2,
      used: '112.00KiB',
      isVolume: true,
      isMissing: false,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: 'ea774718-30db-41fd-b64f-4dec14bc935d',
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/ea774718-30db-41fd-b64f-4dec14bc935d',
      mountpoint: path.join(tmptest, 'sdbc'),
      usage: {
        overall: {
          deviceSize: 21474836480,
          deviceAllocated: 4311744512,
          deviceUnallocated: 17163091968,
          deviceMissing: 0,
          used: 1310720,
          free: 9654763520,
          freeMin: 9654763520,
          dataRatio: '2.00',
          metadataRatio: '2.00',
          globalReserve: 16777216,
          globalReserveUsed: 0
        },
        system: {
          devices: [],
          mode: 'RAID1',
          size: 8388608,
          used: 16384
        },
        metadata: {
          devices: [],
          mode: 'RAID1',
          size: 1073741824,
          used: 114688
        },
        data: {
          devices: [],
          mode: 'RAID1',
          size: 1073741824,
          used: 524288
        },
        unallocated: {
          devices: []
        }
      },
      users: {
        code: 'ENOENT',
        message: 'fruitmix dir not found'
      }
    },
    {
      missing: false,
      devices: [
        {
          name: 'sdd',
          path: '/dev/sdd',
          id: 1,
          used: '2.01GiB',
          size: 10737418240,
          unallocated: 8581545984,
          system: {
            mode: 'RAID1',
            size: 8388608
          },
          metadata: {
            mode: 'RAID1',
            size: 1073741824
          },
          data: {
            mode: 'RAID1',
            size: 1073741824
          }
        },
        {
          name: 'sde',
          path: '/dev/sde',
          id: 2,
          used: '2.01GiB',
          size: 10737418240,
          unallocated: 8581545984,
          system: {
            mode: 'RAID1',
            size: 8388608
          },
          metadata: {
            mode: 'RAID1',
            size: 1073741824
          },
          data: {
            mode: 'RAID1',
            size: 1073741824
          }
        }
      ],
      label: '',
      uuid: '73defbe1-00d3-4891-9377-5de6689fc179',
      total: 2,
      used: '112.00KiB',
      isVolume: true,
      isMissing: false,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: '73defbe1-00d3-4891-9377-5de6689fc179',
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/73defbe1-00d3-4891-9377-5de6689fc179',
      mountpoint: path.join(tmptest, 'sdde'),
      usage: {
        overall: {
          deviceSize: 21474836480,
          deviceAllocated: 4311744512,
          deviceUnallocated: 17163091968,
          deviceMissing: 0,
          used: 1310720,
          free: 9654763520,
          freeMin: 9654763520,
          dataRatio: '2.00',
          metadataRatio: '2.00',
          globalReserve: 16777216,
          globalReserveUsed: 0
        },
        system: {
          devices: [],
          mode: 'RAID1',
          size: 8388608,
          used: 16384
        },
        metadata: {
          devices: [],
          mode: 'RAID1',
          size: 1073741824,
          used: 114688
        },
        data: {
          devices: [],
          mode: 'RAID1',
          size: 1073741824,
          used: 524288
        },
        unallocated: {
          devices: []
        }
      },
      users: {
        code: 'ENOENT',
        message: 'fruitmix dir not found'
      }
    },
    {
      missing: false,
      devices: [
        {
          name: 'sdf',
          path: '/dev/sdf',
          id: 1,
          used: '2.02GiB',
          size: 10737418240,
          unallocated: 8564768768,
          system: {
            mode: 'DUP',
            size: 16777216
          },
          metadata: {
            mode: 'DUP',
            size: 2147483648
          },
          data: {
            mode: 'single',
            size: 8388608
          }
        }
      ],
      label: '',
      uuid: 'a840b693-018b-4080-8aca-9abe40b85f24',
      total: 1,
      used: '112.00KiB',
      isVolume: true,
      isMissing: false,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: 'a840b693-018b-4080-8aca-9abe40b85f24',
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/a840b693-018b-4080-8aca-9abe40b85f24',
      mountpoint: path.join(tmptest, 'sdf'),
      usage: {
        overall: {
          deviceSize: 10737418240,
          deviceAllocated: 2172649472,
          deviceUnallocated: 8564768768,
          deviceMissing: 0,
          used: 524288,
          free: 8572895232,
          freeMin: 4290510848,
          dataRatio: '1.00',
          metadataRatio: '2.00',
          globalReserve: 16777216,
          globalReserveUsed: 0
        },
        system: {
          devices: [],
          mode: 'DUP',
          size: 8388608,
          used: 16384
        },
        metadata: {
          devices: [],
          mode: 'DUP',
          size: 1073741824,
          used: 114688
        },
        data: {
          devices: [],
          mode: 'single',
          size: 8388608,
          used: 262144
        },
        unallocated: {
          devices: []
        }
      },
      users: {
        code: 'ENOENT',
        message: 'fruitmix dir not found'
      }
    },
    {
      missing: true,
      devices: [
        {
          name: 'sdg',
          path: '/dev/sdg',
          id: 1,
          used: '2.01GiB',
          size: 0,
          unallocated: 8581545984,
          system: {
            mode: 'RAID1',
            size: 8388608
          },
          metadata: {
            mode: 'RAID1',
            size: 1073741824
          },
          data: {
            mode: 'RAID1',
            size: 1073741824
          }
        },
        {
          id: 2
        }
      ],
      label: '',
      uuid: 'f7997c56-547b-4fd3-b738-d244845d8907',
      total: 2,
      used: '112.00KiB',
      isVolume: true,
      isMissing: true,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: 'f7997c56-547b-4fd3-b738-d244845d8907',
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/f7997c56-547b-4fd3-b738-d244845d8907',
      mountpoint: path.join(tmptest, 'sdg'),
      usage: {
        overall: {
          deviceSize: 21474836480,
          deviceAllocated: 4311744512,
          deviceUnallocated: 17163091968,
          deviceMissing: 10737418240,
          used: 229376,
          free: 9655287808,
          freeMin: 9655287808,
          dataRatio: '2.00',
          metadataRatio: '2.00',
          globalReserve: 16777216,
          globalReserveUsed: 0
        },
        system: {
          devices: [],
          mode: 'RAID1',
          size: 8388608,
          used: 16384
        },
        metadata: {
          devices: [],
          mode: 'RAID1',
          size: 1073741824,
          used: 98304
        },
        data: {
          devices: [],
          mode: 'RAID1',
          size: 1073741824,
          used: 0
        },
        unallocated: {
          devices: []
        }
      }
    },
    {
      missing: true,
      devices: [
        {
          name: 'sdh',
          path: '/dev/sdh',
          id: 1,
          used: '1.02GiB',
          size: 10737418240,
          unallocated: 9646899200,
          system: {
            mode: 'RAID1',
            size: 8388608
          },
          metadata: {
            mode: 'RAID1',
            size: 1073741824
          },
          data: {
            mode: 'single',
            size: 8388608
          }
        },
        {
          id: 2
        }
      ],
      label: '',
      uuid: '0a78bbec-5cf5-4f6c-b72d-022c76f6c782',
      total: 2,
      used: '112.00KiB',
      isVolume: true,
      isMissing: true,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: '0a78bbec-5cf5-4f6c-b72d-022c76f6c782',
      isMounted: true,
      // mountpoint: '/run/phicomm/volumes/0a78bbec-5cf5-4f6c-b72d-022c76f6c782',
      mountpoint: path.join(tmptest, 'sdh'),
      usage: {
        overall: {
          deviceSize: 21474836480,
          deviceAllocated: 2172649472,
          deviceUnallocated: 19302187008,
          deviceMissing: 0,
          used: 229376,
          free: 19310575616,
          freeMin: 9659482112,
          dataRatio: '1.00',
          metadataRatio: '2.00',
          globalReserve: 16777216,
          globalReserveUsed: 0
        },
        system: {
          devices: [],
          mode: 'RAID1',
          size: 8388608,
          used: 16384
        },
        metadata: {
          devices: [],
          mode: 'RAID1',
          size: 1073741824,
          used: 98304
        },
        data: {
          devices: [],
          mode: 'single',
          size: 8388608,
          used: 0
        },
        unallocated: {
          devices: []
        }
      }
    }
  ]
})

const createBoundVolume = (storage, volumeUUID) => {
  let volume = storage.volumes.find(vol => vol.uuid === volumeUUID)
  if (!volume) return null

  let devices = volume.devices.map(dev => {
    let blk = storage.blocks.find(blk => blk.name === dev.name)
    return {
      removable: blk.removable,
      size: blk.size,
      model: blk.model,
      serial: blk.serial,
      btrfsDevice: blk.btrfsDevice,
      idBus: blk.idBus
    }
  })

  return {
    devices,
    label: volume.label,
    uuid: volume.uuid,
    total: volume.total,
    usage: {
      system: { mode: volume.usage.system.mode },
      metadata: { mode: volume.usage.metadata.mode },
      data: { mode: volume.usage.data.mode }
    }
  }
}

const fakeNfsAsync = async tmptest => {
  await Promise.all([
    mkdirpAsync(path.join(tmptest, 'sdbc')),
    mkdirpAsync(path.join(tmptest, 'sdde')),
    mkdirpAsync(path.join(tmptest, 'sdf')),
    mkdirpAsync(path.join(tmptest, 'sdg')),
    mkdirpAsync(path.join(tmptest, 'sdh')),
  ])

  return {
    storage: fakeStorage(tmptest),
    createBoundVolume,
  }
}

Object.assign(fakeNfsAsync, { UUIDBC, UUIDDE, UUIDF, UUIDG, UUIDH })

module.exports = fakeNfsAsync


