const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const ioctl = require('ioctl')

// clone a file from src to dst
const btrfsCloneAsync = async (dst, src) => {

  let srcFd = await fs.openAsync(src, 'r')
  try {
    let dstFd = await fs.openAsync(dst, 'w')
    try {
      ioctl(dstFd, 0x40049409, srcFd)      
    } finally {
      await fs.closeAsync(dstFd)
    }
  } finally {
    await fs.closeAsync(srcFd)
  }
}

// clone a file from src to dst, and append data, data must be buffer
const btrfsCloneAndAppendAsync = async (dst, src, data) => {

  if (data instanceof Buffer) {
    if (data.length === 0) throw new Error('data length cannot be zero')
  } else {
    throw new Error('data must be either a buffer or a string')
  }

  await btrfsCloneAsync(dst, src)

  // using stream is easier than fs.write
  // the latter may not write all data in one syscall 
  await new Promise((resolve, reject) => {
    let finished = false
    let ws = fs.createWriteStream(dst, { flags: 'a'})
    ws.on('error', err => {
      if (finished) return
      finished = true
      reject(err)
    })
    ws.on('finish', () => {
      if (finished) return
      finished = true
      resolve()
    })
    ws.write(data)
    ws.end()
  })
}

// clone a file from src to dst, and truncate bytes
const btrfsCloneAndTruncateAsync = async (dst, src, bytes) => {

  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error('bytes must be a positive integer')
  }

  let dstFd = await fs.openAsync(dst, 'w') 
  try {
    let srcFd = await fs.openAsync(src, 'r')
    try {
      ioctl(dstFd, 0x40049409, srcFd)  
    } finally {
      await fs.closeAsync(srcFd)
    }

    let stat = await fs.fstatAsync(dstFd)
    if (stat.size < bytes) throw new Error('file does not have enough bytes to truncate')
    await fs.ftruncateAsync(dstFd, stat.size - bytes)
  } finally {
    await fs.closeAsync(dstFd)
  }
}

const SIZE_4GB = 1024 * 1024 * 1024 * 4

// concatenate src to dst (append), dst file must have a size of multiple of 4096
const btrfsConcatAsync = async (dst, src) => {

  let dstFd = await fs.openAsync(dst, 'r+')
  try {
    let stat = await fs.fstatAsync(dstFd)
    if (stat.size % 4096 !== 0) throw new Error('dst file size not a integer multiple of 4096')

    let srcFd = await fs.openAsync(src, 'r')
    try {

      let buffer = Buffer.alloc(4 * 8)
      // src_fd
      buffer.writeInt32LE(srcFd, 0)
      // src_offset and src_length are omitted
      // dst_offset
      buffer.writeUInt32LE(stat.size % SIZE_4GB, 24)
      buffer.writeUInt32LE(stat.size / SIZE_4GB, 28)
      ioctl(dstFd, 0x4020940D, buffer)
    } finally {
      await fs.closeAsync(srcFd)
    }
  }
  finally {
    await fs.closeAsync(dstFd)
  }
}

module.exports = {
  btrfsCloneAsync,
  btrfsCloneAndAppendAsync,
  btrfsCloneAndTruncateAsync,
  btrfsConcatAsync
}
