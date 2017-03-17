class MediaData {

  constructor() {

    this.fileShare = fileShare

    fileData.on('mediaAppeared', node => {
      if (this.map.has(node.hash)) {
        this.map.get(node.hash).nodes.push(node)
      }
      else {
        let m = new Media(node.hash)
        m.nodes.push(node)
        this.map.set(node.hash, new Media(node.hash)
      }
    })

    fileData.on('mediaDisappearing', node => {
    })

    this.fileData = fileData

    mediaShareData.on('shareCreated', share => {
    })

    mediaShareData.on('shareUpdating', share => {
    })

    mediaShareData.on('shareUpdated', (oldShare, newShare) => {
    })

    mediaShareData.on('shareDeleting', share => {
    })

    this.mediaShareData = mediaShareData

    this.map = new Map()
  }

  ifICanShare(user, digest) {
    // user own digest
    // or existing a file instance in public, sharable drive with user as members. 
  }

  ifICanView(user, digest) {
    
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
