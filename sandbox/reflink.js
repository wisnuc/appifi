const fs = require('fs')
const ioctl = require('ioctl')

// asm/ioctl.h
// linux/btrfs.h 

// #define BTRFS_IOC_CLONE        _IOW(BTRFS_IOCTL_MAGIC, 9, int)

// type BTRFS_IOCTL_MAGIC 0x94
// number BTRFS_IOC_CLONE   0x09
// dir 0x40 for write 
// size 0x04 (32bits ?)
const request = 0x40049409

const src = fs.openSync('hello', 'r')
const dst = fs.openSync('world', 'w') 

try {
  ioctl(dst, request, src) 
}
catch (e) {
  console.log(e)
  process.exit(1)
}

