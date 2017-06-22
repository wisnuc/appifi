let EventEmitter = require('events')

import Debug from 'debug'
const SAMBA_AUDIT = Debug('SAMBA:SAMBA_AUDIT')

// a class contains samba audit infor which spread with udp
class SmbAudit extends EventEmitter {
  constructor(udp) {

    super()

    this.udp = udp
    this.udp.on('message', (message, remote) => {

      const token = ' smbd_audit: '

      let text = message.toString()

      // SAMBA_AUDIT(text)

      //
      // enter into folder 'aaa', then create a new file named 'bbb', then edit it.
      //
      // samba audit like below:
      // <185>Jun 16 11:01:14 wisnuc-virtual-machine smbd_audit: root|a|a (home)|/run/wisnuc/volumes/56b.../wisnuc/fruitmix/drives/21b...|create_file|ok|0x100080|file|open|aaa/bbb.txt
      //
      // arr[0]: root
      // arr[1]: a
      // arr[2]: a (home)
      // arr[3]: /run/wisnuc/volumes/56b.../wisnuc/fruitmix/drives/21b...
      // arr[4]: create_file
      // arr[5]: ok
      // arr[6]: 0x100080
      // arr[7]: file
      // arr[8]: open
      // arr[9]: aaa/bbb.txt
      //
      // user: a
      // share: a (home)
      // abspath: /run/wisnuc/volumes/56b.../wisnuc/fruitmix/drives/21b...
      // op: create_file

      let tidx = text.indexOf(' smbd_audit: ')
      if (tidx === -1) return

      let arr = text.trim().slice(tidx + token.length).split('|')

      // for(var i = 0; i < arr.length; i++){
      //   SAMBA_AUDIT(`arr[${i}]: ` + arr[i])
      // }

      // %u <- user
      // %U <- represented user
      // %S <- share
      // %P <- path

      if (arr.length < 6 || arr[0] !== 'root' || arr[5] !== 'ok')
        return

      let user = arr[1]
      // SAMBA_AUDIT('user: ' + user)
      let share = arr[2]
      // SAMBA_AUDIT('share: ' + share)
      let abspath = arr[3]
      // SAMBA_AUDIT('abspath: ' + abspath)
      let op = arr[4]
      // SAMBA_AUDIT('op: ' + op)
      let arg0, arg1

      // create_file arg0
      // mkdir
      // rename
      // rmdir
      // unlink (delete file)
      // write (not used anymore)
      // pwrite

      switch (op) {
      case 'create_file':
        if (arr.length !== 10) return
        if (arr[8] !== 'create') return
        if (arr[7] !== 'file') return
        arg0 = arr[9]
        break

      case 'mkdir':
      case 'rmdir':
      case 'unlink':
      case 'pwrite':
        if (arr.length !== 7) return
        arg0 = arr[6]
        break

      case 'rename':
        if (arr.length !== 8) return
        arg0 = arr[6]
        arg1 = arr[7]
        break

      default:
        return
      }

      let audit = { user, share, abspath, op, arg0 }
      if (arg1) audit.arg1 = arg1

      SAMBA_AUDIT(audit)

      process.send(audit);
    })

    this.udp.on('close', () => console.log('smbaudit upd server closed'))
  }
}

module.exports = SmbAudit
