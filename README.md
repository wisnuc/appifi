# Notice


This project is under heavy development.


# Development Deployment

btrfs is required for both user data storage and running test case.

For development, it is recommended that the root file system is btrfs file system. When installing the system from wisnuc CD, you can simply change the default ext4 root fs to btrfs.

Alternatively, you can format a separate partition to btrfs file system, and git clone the project there. A btrfs partition is recommended over a btrfs disk volume, for the software will try to manage all btrfs disk volume.




