const fs = require('fs')
const ioctl = require('ioctl')
const mkdirp = require('mkdirp')

mkdirp.sync('tmptest')
fs.writeFileSync('tmptest/hello', 'h'.repeat(4096) + 'e'.repeat(4096)) // double sector
fs.writeFileSync('tmptest/world', 'w'.repeat(4096)) // single sectgor
const src = fs.openSync('tmptest/hello', 'r')
const dst = fs.openSync('tmptest/world', 'r+')

//  struct btrfs_ioctl_clone_range_args {
//    __s64 src_fd;
//    __u64 src_offset, src_length;
//    __u64 dest_offset;
//  };
let buffer = Buffer.alloc(4 * 8)
buffer.writeInt32LE(src, 0)         
buffer.writeUInt32LE(4096, 8)     // src_offset
buffer.writeUInt32LE(4096, 16)    // src_length  (if zero, reflinks to the end of the file)
buffer.writeUInt32LE(4096, 24)    // dst_offset

try {
  //  BTRFS_IOCTL_MAGIC  0x94
  //  BTRFS_IOCTL_CLONE_RANGE  0x0D (13)
  //  #define BTRFS_IOC_CLONE_RANGE _IOW(BTRFS_IOCTL_MAGIC, 13, \
  //          struct btrfs_ioctl_clone_range_args)
  //  dir 0x40 for write
  //  size 0x20 sizeof btrfs_ioctl_clone_range_args
  const request = 0x4020940D
  ioctl(dst, request, buffer)
} catch (e) {
  console.log(e)
}


