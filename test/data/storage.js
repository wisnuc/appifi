const deepFreeze = require('deep-freeze')

module.exports = deepFreeze({
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
    }
  ],
  blocks: [
    {
      name: 'sda',
      devname: '/dev/sda',
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/host2/target2:0:0/2:0:0:0/block/sda',
      removable: false,
      size: 33554432,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB1303902c-1fe17ee3',
      isPartitioned: true,
      partitionTableType: 'dos',
      partitionTableUUID: 'b7ba42fb',
      idBus: 'ata',
      isATA: true,
      unformattable: 'ActiveSwap:RootFS'
    },
    {
      name: 'sdb',
      devname: '/dev/sdb',
      path: '/devices/pci0000:00/0000:00:0d.0/ata4/host3/target3:0:0/3:0:0:0/block/sdb',
      removable: false,
      size: 209715200,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VBa7048555-e80f74a4',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'btrfs',
      fileSystemUUID: 'fbdd6d56-7e27-4305-b651-efb92a2ddbef',
      isFileSystem: true,
      isVolumeDevice: true,
      isBtrfs: true,
      btrfsVolume: 'fbdd6d56-7e27-4305-b651-efb92a2ddbef',
      btrfsDevice: '3fb42d27-e3a3-4eea-9ca5-854abd14ddb8',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      mountpoint: '/run/wisnuc/volumes/fbdd6d56-7e27-4305-b651-efb92a2ddbef'
    },
    {
      name: 'sdc',
      devname: '/dev/sdc',
      path: '/devices/pci0000:00/0000:00:0d.0/ata5/host4/target4:0:0/4:0:0:0/block/sdc',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VB6647798e-ba59a7f4',
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ext4',
      fileSystemUUID: '713638f1-a118-4f01-bed4-e00e416d8d14',
      isFileSystem: true,
      isExt4: true,
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      mountpoint: '/run/wisnuc/blocks/sdc'
    },
    {
      name: 'sdd',
      devname: '/dev/sdd',
      path: '/devices/pci0000:00/0000:00:0d.0/ata6/host5/target5:0:0/5:0:0:0/block/sdd',
      removable: false,
      size: 20971520,
      isDisk: true,
      model: 'VBOX_HARDDISK',
      serial: 'VBff2ff858-34ed336c',
      isPartitioned: true,
      partitionTableType: 'dos',
      partitionTableUUID: 'b092b006',
      idBus: 'ata',
      isATA: true
    },
    {
      name: 'sde',
      devname: '/dev/sde',
      path: '/devices/pci0000:00/0000:00:0b.0/usb1/1-1/1-1:1.0/host6/target6:0:0/6:0:0:0/block/sde',
      removable: false,
      size: 2097152,
      isDisk: true,
      model: 'HARDDISK',
      isPartitioned: true,
      partitionTableType: 'dos',
      partitionTableUUID: 'cd3deb34',
      idBus: 'usb',
      isUSB: true
    },
    {
      name: 'sda1',
      devname: '/dev/sda1',
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/host2/target2:0:0/2:0:0:0/block/sda/sda1',
      removable: false,
      size: 31455232,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ext4',
      fileSystemUUID: '22b9183e-a2b1-41a3-925c-fd0a2720435b',
      isFileSystem: true,
      isExt4: true,
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
      size: 2,
      isPartition: true,
      isExtended: true,
      parentName: 'sda',
      idBus: 'ata',
      isATA: true,
      unformattable: 'Extended'
    },
    {
      name: 'sda5',
      devname: '/dev/sda5',
      path: '/devices/pci0000:00/0000:00:0d.0/ata3/host2/target2:0:0/2:0:0:0/block/sda/sda5',
      removable: false,
      size: 2093056,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'other',
      fileSystemType: 'swap',
      fileSystemUUID: 'a8d71951-3c6d-4725-9a06-17ea9a4d27ba',
      isOtherFileSystem: true,
      isLinuxSwap: true,
      parentName: 'sda',
      idBus: 'ata',
      isATA: true,
      isActiveSwap: true,
      unformattable: 'ActiveSwap'
    },
    {
      name: 'sdd1',
      devname: '/dev/sdd1',
      path: '/devices/pci0000:00/0000:00:0d.0/ata6/host5/target5:0:0/5:0:0:0/block/sdd/sdd1',
      removable: false,
      size: 4194304,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ext4',
      fileSystemUUID: '165d1164-8208-441c-a994-b8646b7f833f',
      isFileSystem: true,
      isExt4: true,
      parentName: 'sdd',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      mountpoint: '/run/wisnuc/blocks/sdd1'
    },
    {
      name: 'sdd2',
      devname: '/dev/sdd2',
      path: '/devices/pci0000:00/0000:00:0d.0/ata6/host5/target5:0:0/5:0:0:0/block/sdd/sdd2',
      removable: false,
      size: 2,
      isPartition: true,
      isExtended: true,
      parentName: 'sdd',
      idBus: 'ata',
      isATA: true,
      unformattable: 'Extended'
    },
    {
      name: 'sdd5',
      devname: '/dev/sdd5',
      path: '/devices/pci0000:00/0000:00:0d.0/ata6/host5/target5:0:0/5:0:0:0/block/sdd/sdd5',
      removable: false,
      size: 8388608,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ntfs',
      fileSystemUUID: '4C690A662767FA0F',
      isFileSystem: true,
      isNtfs: true,
      parentName: 'sdd',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      mountpoint: '/run/wisnuc/blocks/sdd5'
    },
    {
      name: 'sdd6',
      devname: '/dev/sdd6',
      path: '/devices/pci0000:00/0000:00:0d.0/ata6/host5/target5:0:0/5:0:0:0/block/sdd/sdd6',
      removable: false,
      size: 8382464,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'vfat',
      fileSystemUUID: '1962-4D55',
      isFileSystem: true,
      isVfat: true,
      parentName: 'sdd',
      idBus: 'ata',
      isATA: true,
      isMounted: true,
      mountpoint: '/run/wisnuc/blocks/sdd6'
    },
    {
      name: 'sde1',
      devname: '/dev/sde1',
      path: '/devices/pci0000:00/0000:00:0b.0/usb1/1-1/1-1:1.0/host6/target6:0:0/6:0:0:0/block/sde/sde1',
      removable: false,
      size: 2095104,
      isPartition: true,
      fsUsageDefined: true,
      idFsUsage: 'filesystem',
      fileSystemType: 'ntfs',
      fileSystemUUID: '59C58E06034DF040',
      isFileSystem: true,
      isNtfs: true,
      parentName: 'sde',
      idBus: 'usb',
      isUSB: true,
      isMounted: true,
      mountpoint: '/media/root/59C58E06034DF040'
    }
  ],
  volumes: [
    {
      missing: false,
      devices: [
        {
          name: 'sdb',
          path: '/dev/sdb',
          id: 1,
          used: '2.02GiB',
          size: 107374182400,
          unallocated: 105201532928,
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
      uuid: 'fbdd6d56-7e27-4305-b651-efb92a2ddbef',
      total: 1,
      used: '384.00KiB',
      isVolume: true,
      isMissing: false,
      isFileSystem: true,
      isBtrfs: true,
      fileSystemType: 'btrfs',
      fileSystemUUID: 'fbdd6d56-7e27-4305-b651-efb92a2ddbef',
      isMounted: true,
      mountpoint: '/run/wisnuc/volumes/fbdd6d56-7e27-4305-b651-efb92a2ddbef',
      usage: {
        overall: {
          deviceSize: 107374182400,
          deviceAllocated: 2172649472,
          deviceUnallocated: 105201532928,
          deviceMissing: 0,
          used: 524288,
          free: 105209659392,
          freeMin: 52608892928,
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
      users: 'ENOENT'
    }
  ]
})
