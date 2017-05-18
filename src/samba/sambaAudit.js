let EventEmitter = require('events')

// a class contains samba audit infor which spread with udp
class SmbAudit extends EventEmitter {
  constructor(udp) {
    super()

    this.udp = udp
    this.udp.on('message', (message, remote) => {
   
      const token = ' smbd_audit: ' 

      let text = message.toString()
      let tidx = text.indexOf(' smbd_audit: ')
      if (tidx === -1) return

      let arr = text.trim().slice(tidx + token.length).split('|')

      // %u <- user
      // %U <- represented user
      // %S <- share
      // %P <- path 

      if (arr.length < 6 || arr[0] !== 'root' || arr[5] !== 'ok')
        return    
 
      let user = arr[1]
      let share = arr[2]
      let abspath = arr[3]
      let op = arr[4]
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
      
      console.log('####################################################');
      console.log(audit);
      console.log('####################################################');
      
      return audit
    })

    this.udp.on('close', () => console.log('smbaudit upd server closed'))
  }
}

module.exports = SmbAudit