
class Media {
   constructor(digest) {
    this.digest = digest
    this.type = 'JPEG'
    this.metadata = null
    this.nodes = new Set()
    this.mShares = new Set()
    this.fShares = new Set()
   }
}

class MediaData {

  constructor() {

    this.fileShareData = fileShareData
    this.fileData = fileData
    this.mediaShareData = mediaShareData
    this.map = new Map()

    this.fileData.on('mediaAppeared', node => {
      if (this.map.has(node.hash)) {
        this.map.get(node.hash).nodes.add(node)
      }
      else {
        let m = new Media(node.hash)
        m.nodes.add(node)
        this.map.set(node.hash, m)
      }
    })

    this.fileData.on('mediaDisappearing', node => {
      let media = this.map.get(node.hash)
      media.nodes.delete(node)
      if(!media.nodes.size && !media.shares.size) this.map.delete(node.hash)
    })    

    this.mediaShareData.on('shareCreated', mShare => {
      mShare.doc.contents.forEach(item => {
        let media = this.map.get(item.digest)
        if(media) {
          media.mShares.add(mShare)
        }
        else {
          let m = new Media(item.digest)
          m.mShares.add(mShare)
          this.map.set(item.digest, m)
        }
      })
    })

    this.mediaShareData.on('shareUpdating', mShare => {
    })

    this.mediaShareData.on('shareUpdated', (oldMShare, newMShare) => {
    })

    this.mediaShareData.on('shareDeleting', mShare => {
      mShare.doc.contents.forEach(item => {
        let media = this.map.get(item.digest)
        media.mShares.delete(mShare)
        if(!media.nodes.size && !media.shares.size) this.map.delete(item.digest)
      })
    })

    this.fileShareData.on('fileShareCreated', fShare => {
      fShare.doc.collection.forEach((uuid, index, array) => {
        let node = this.fileData.uuidMap.get(u)
        // if(node.postVisit(node => )
      })
    })

    this.fileShareData.on('fileShareUpdating', (oldFShare, newFShare) => {

    })

    this.fileShareData.on('fileShareUpdated', (oldFShare, newFShare) => {

    })

    this.fileShareData.on('fileShareDeleting', fShare => {

    })    
  }

  ifICanShare(user, digest) {
    // user own digest
    // or existing a file instance in public, sharable drive with user as members. 
    let media = this.map.get(digest)
    if(!media) return false
    else {
      if(!media.nodes.size) return false
      else {
        return !!(Array.from(media.nodes).find(n => 
          n.root().owner === user || 
          (n.root().shareAllowed && [...n.root().writelist, ...n.root().readlist].includes(user))))
      }
    }
  }

  ifICanView(user, digest) {
    let media = this.map.get(digest)
    if(!meida) return false
    else {
      return !!(Array.from(media.nodes).find(n => n.root().owner === user 
        || [...n.root().writelist, ...n.root().readlist].includes(user)))
      || !!(Array.from(media.fShares).find(s => [...s.doc.writelist, ...s.doc.readlist].includes(user)))
      || !!(Array.from(media.shares).find(s => [s.doc.author, ...s.doc.maintainers, ...s.doc.viewers].includes(user)))
    }
  }

  // owned, from library or home
  // or sharable, from public drive, sharable
  // shared with me by fileShare
  // shared with others 
  // shared with me
  allICanView(user) {
    
    arr = []
    this.map.forEach(m => {

      let fromHome, fromLib, fromPub, fromShare
      let sharable = fromHome | fromLib | fromPub(S)

      m.nodes.forEach(node => {
        let drive = node.drive
        if (drive is public) {
            
        }
        else {
          if (drive is not service) {
            if (owner is user) {

            }
            else {
                     
            }
          }
        }
      })
     
      m.shares.forEach(share => {
        if (share.viewerSet contains user) {
          let x = share.contents.find(item => item.digest === key)
          if (x.creator === user) else ...
        }
      }) 
    })
  }
}
