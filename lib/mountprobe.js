var child = require('child_process')
var async = require('async')

module.exports = (done) => {

  child.exec('mount', (error, stdout, stderr) => {
    if (error) done(error, { stdout, stderr })
    else {
      var mounts = []
      stdout.toString().split(/\n/).filter(l => l.length)
      .forEach(l => {
        if (l.startsWith('/dev/')) {
          // /dev/sdc1 on /media/usb0 type ext4 (rw,noexec,nodev,sync,noatime,nodiratime) 
          var tmp = l.split(' ')
	        mounts.push({
            devfile: tmp[0],
            mountpoint: tmp[2],
            type: tmp[4],
            opts: tmp[5].slice(1,-1)
          })
        }
      })
      done(null, mounts)
    }
  })
}

