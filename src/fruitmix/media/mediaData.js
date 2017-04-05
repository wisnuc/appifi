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

  constructor(modelData, fileData, mediaShareData) {

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

  indexMediaShare(share) {

    share.doc.contents.forEach(item => {
      
      let digest = item.digest
      let medium = this.map.get(digest)
      if (medium) {
        medium.sharedItems.push([item, share]) // use 2-tuple for faster check on both creator and member
      }
      else {
        medium = new Media(digest)
        medium.sharedItems.push([item, share])
        this.map.set(digest)
      }
    })
  }

  // return all media objects that has item removed, but empty ones are not removed out of map
  unindexMediaShare(share) {

    return share.doc.contents.reduce((acc, item) => {

      let medium = this.map.get(item.digest) 
      let index = medium.sharedItems.findIndex(pair => pair[0] === item)
      medium.sharedItems.splice(index, 1)
      acc.push(medium)
      return acc

    }, [])
  }

  cleanEmpty(media) {
    media.forEach(medium => medium.isEmpty() && this.map.delete(medium.digest))
  }

  handleShareCreated(share) {
    this.indexMediaShare(share)    
  }

  // share { doc { contents: [ item {creator, digest} ] } }
  handleShareUpdated(oldShare, newShare) {

    // 1. splice all indexed item inside media object
    let spliced = unindexMediaShare(oldShare)

    // 2. index all new media.
    this.indexMediaShare(newShare) 

    // 3. remove empty spliced.
    this.cleanEmpty(spliced)
  }

  handleShareDeleted(share) {

    let spliced = this.unindexMediaShare(share)
    this.cleanEmpty(spliced)
  }

  mediaSharingStatus(userUUID, medium) {

    let sharedWithOthers = false
    let sharedWithMe = false
    let sharedWithMeAvailable = false

    for (let i = 0; i < medium.sharedItems.length; i++) {

      let pair = medium.sharedItems[i] 
      let item = pair[0]
      let doc = pair[1].doc
      if (item.creator === userUUID) sharedWithOthers = true
      if (doc.maintainers.includes(userUUID) || .doc.viewers.includes(userUUID)) {
        sharedWithMe = true
        sharedWithMeAvailable = this.model.userIsLocal(doc.author) 
          ? true 
          : medium.nodes.some(node => this.fileData.fromUserService(doc.author, node))
      }

      // if available is false, there is a chance that
      // another remote user shared the same medium with me
      if (sharedWithOthers && sharedWithMe && sharedWithMeAvailable)
        return { sharedWithOthers, sharedWithMe, sharedWithMeAvailable }
    }

    return { sharedWithOthers, sharedWithMe, sharedWithMeAvailable }
  }

  mediumProperties(userUUID, medium) {

    // 1. user permitted to share (from fileData)
    // 2. from user library (from fileData)
    // 3. user authorized to read (from fileShareData)
    // 4. shared with others 
    // 5. shared with me
    // 5.1 serviceAvailable
  }

  getAllMedia(userUUID) {

    let arr
    for (let pair of this.map) {
      let props = this.mediumProperties(userUUID, pair[1])
      if (props.permittedToShare || props.authorizedToRead || sharedWithOthers || sharedWithMe) {
        arr.push({
          
        })
      }
    }

    return arr
  }
}

