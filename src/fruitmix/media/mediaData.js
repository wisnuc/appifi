class Media {

  constructor(digest) {
    this.digest = digest
    this.type = ''
    this.metadata = null
    this.nodes = new Set()
    this.shares = new Set()
  }

  isEmpty() {
    return this.nodes.size === 0 && this.shares.size === 0 
  }
}

class MediaData {

  constructor(modelData, fileData, mediaData, mediaShareData) {

    this.fileShareData = fileShareData
    this.fileData = fileData
    this.mediaShareData = mediaShareData
    this.map = new Map()


    this.fileData.on('mediaAppeared', this.handleMediaAppeared.bind(this))
    this.fileData.on('mediaDisappearing', this.handleMediaDisappearing.bind(this))
    this.fileData.on('mediaIdentified', this.handleMediaIdentified.bind(this))

    this.mediaShareData.on('shareCreated', this.handleMediaShareCreated.bind(this))
    this.mediaShareData.on('shareUpdated', this.handleMediaShareUpdated.bind(this))
    this.mediaShareData.on('shareDeleted', this.handleMediaShareDeleted.bind(this))
  }

  handleMediaAppeared(node) {
    
    let media = this.map.get(node.uuid)
    if (!media) {
      media = new Media(node.hash)
      media.type = node.magic
      this.nodes.add(node)
      node.identify()
    }
    else {
      this.media.nodes.add(node)
      if (!media.metadata) node.identify()
    }
  }

  handleMediaDisappearing(node) {

    let media = this.map.get(node.uuid)
    if (!media) {
      // log
      return 
    }

    media.nodes.delete(node)
    if (media.isEmpty()) this.map.delete(node.uuid)
  }

  handleShareCreated(share) {
    
    let arr = share.doc.contents 
     
  }

  handleShareUpdated(oldShare, newShare) {
  }

  handleShareDeleted(share) {
  }

  mediaProperties(userUUID, media) {
  
      
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

