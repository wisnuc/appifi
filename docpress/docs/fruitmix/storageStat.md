## 描述

storage信息包含：

* ata_port
* blocks信息（指Linux系统的block device）
* volumes信息（指btrfs volume信息，不支持lvm/md和其他卷文件系统，例如zfs）
* mount信息（挂载点，btrfs volume may be mounted -o ro,degraded）
* swap信息（指实际使用的swap，静态信息在blocks信息内）

* usage信息（指btrfs卷的使用信息，需挂载）
* 其他信息，wisnuc/fruitmix是否安装

注意区分和理解静态信息，连接信息，和运行时信息的差异。

( btrfs filesystem show, usage )

## 文件

该逻辑涉及到后端的storage模块，和Electron前端的三处显示。

后端： /src/system/storage.js

前端：

1. Login -> Guidebox
2. ControlApp -> storage
3. Maintenace


block (static)

* is Disk (devtype === 'disk')
  * id_part_table_type (override id_fs_usage)
  * id_fs_usage (standalone file system)
    * id_fs_usage === 'filesystem'
      * btrfs, ext4, ntfs, vfat ...
    * id_fs_usage === 'other'
      * lvm/md raid, swap, crypto, ...
    * Unknown (isUnsupportedFileSystem = true)
  * Unknown (Unrecognized)
* is Partition
  * isExtended
  * isLinuxSwap
  * ext4, ntfs, vfat
  * if others, no specific definition
* Unknown

### Forbidden re-calculated

Disk containing rootfs or active swap is forbidden to be used as btrfs volume device.
