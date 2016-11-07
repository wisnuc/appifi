# Overview

System API is a new layer extracted from original appifi codebase.

The whole system and application can be viewd as two layers:

* application layer, including fruitmix, appifi, and their dependent services such as docker daemon and samba.
* system layer, which is responsible for boot the system and do maintenance or system level job.

# System layer

System layer providing:

1. device information
2. status of storage devices, either physical or logical
3. boot information
4. mkfs, install application layer (appifi & fruitmix)
5. networking and configuration
6. misc hardware related information and control, such as fan

# Boot Process

System layer will enumerate all volumes, disks, partitions, mounts and swaps, during startup.

Then it applies a predefined policy and try its best to boot Fruitmix from an existing file system. Usually this means the appifi is also booted simultaneously. But this may be changed in future version.

There are three target modes: `normal`, `alternative`, and `maintenance`

Internally, system remembers the last used file system (`lastFileSystem`). This information is stored somewhere inside rootfs. So it persists even if the file system is physically removed out of the system.

`lastFileSystem` is identified with an `type` (such as ext4, btrfs, etc) and `UUID`. Since `UUID` is truly unique, `type` is just an redundant information for convenience.

System bootstrap code firstly examine `lastFileSystem`. If and only if:

1. it exists.
2. it is healthy.
3. it is successfully mounted.
4. the fruitmix folder exists. (may be problematic, logically we need to make sure fruitmix exists)

The system will boot fruitmix and set mode to `normal` mode.

`normal` mode is designed for most common use case.

If `lastFileSystem` exists but other checks fails, the system boots into `maintenance` mode.

If `lastFileSystem` does not exist, or it's not set at all, the System tries to boot alternatively:

1. `lastFileSystem` does not exist, or it's not set at all.
2. There is only one file system with fruitmix installed.
3. It is heathy, successfully mounted.

The system will boot this file system and set mode to `alternative` mode.

`alternative` mode is designed for a special case: user puts a set of disks with fruitmix/appifi already installed, the system should boot this file system without any fuss.

If none of above methods works, the system boots into `maintenance` mode.

Furthermore, in order for user to manually enter `maintenance` mode, there is a property named `bootMode` in configuration file. The property can be either `normal` or `maintenance`. If it is set to `maintenance`, the system startup code will neglect all logics mentioned above and directly boot the system into `maintenance` mode. Such configuration works one-shot. The startup code will set the configuration back to `normal` immediately.

## Summary

If user set the system to boot into `maintenance` mode, it will.

If the last used file system exists, and is good, the system boots into `normal` mode.

If last used file system is not found, but there is only one file system is good, the system boots into `alternative` mode.

`Good` means, the file system is healthy with fruitmix properly installed.
