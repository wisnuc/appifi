

class Media {

  constructor(digest) {
    this.digest = digest
    this.type = ''
    this.metadata = null
    this.nodes = new Set()
    // this.shares = new Set()
  }

  isEmpty() {
    return this.nodes.size === 0
  }
}

class MediaData {

  constructor(modelData, fileData, fileShareData, mediaShareData) {

    // this.fileShareData = fileShareData
    this.fileData = fileData
    // this.mediaShareData = mediaShareData
    this.map = new Map()

    this.fileData.on('mediaAppeared', node => this.handleMediaAppeared(node))
    this.fileData.on('mediaDisappearing', node => this.handleMediaDisappearing(node))
    this.fileData.on('mediaIdentified', (node, metadata) => this.mediaIdentified(node, metadata))

    // this.mediaShareData.on('mediaShareCreated', shares => this.handleMediaShareCreated(shares))
    // this.mediaShareData.on('mediaShareUpdated', (oldShare, newShare) => this.handleMediaShareUpdated(oldShare, newShare))
    // this.mediaShareData.on('mediaShareDeleted', share => this.handleMediaShareDeleted(share))
  }

  findMediaByHash(hash) {
    return this.map.get(hash)
  }

  handleMediaAppeared(node) {

    let media = this.findMediaByHash(node.hash)
    if (!media) {
      media = new Media(node.hash)
      media.type = node.magic
      media.nodes.add(node)
      this.map.set(node.hash, media)
    } else {
      media.nodes.add(node)
    }

    if (!media.metadata) node.identify()

  }

  handleMediaDisappearing(node) {

    let media = this.findMediaByHash(node.hash)
    if (!media) {
      // log
      return
    }

    media.nodes.delete(node)
    if (media.isEmpty()) this.map.delete(node.hash)
  }

  mediaIdentified(node, metadata) {
    let media = this.findMediaByHash(node.hash)
    if (!media) {
      return
    } else {
      media.metadata = metadata
    }
  }

  // indexMediaShare(share) {
  //   //FIXME:
  //   share.doc.contents.forEach(item => {
  //     let digest = item.digest
  //     let media = this.findMediaByHash(digest)
  //     if (media) {
  //       // use 2-tuple for faster check on both creator and member
  //       media.shares.add([item, share]) 
  //     } else {
  //       media = new Media(digest)
  //       media.shares.add([item, share])
  //       this.map.set(digest, media)
  //     }
  //   })
  // }

  // return all media objects that has item removed, but empty ones are not removed out of map
  // unindexMediaShare(share) {

  //   return share.doc.contents.reduce((acc, item) => {

  //     let media = this.findMediaByHash(item.digest)
  //     if (media) {
  //       if (media.shares.has([item, share])) {
  //         media.shares.delete([item, share])
  //         acc.push(media)
  //         return acc
  //       }
  //     }
  //     // let index = medium.sharedItems.findIndex(pair => pair[0] === item)
  //     // medium.sharedItems.splice(index, 1)
  //     // acc.push(medium)
  //     // return acc
  //   }, [])
  // }

  cleanEmpty(medias) {
    medias.forEach(media => media.isEmpty() && this.map.delete(media.digest))
  }

  // handleMediaShareCreated(shares) {
  //   shares.forEach(share => this.indexMediaShare(share))
  // }

  // share { doc { contents: [ item {creator, digest} ] } }
  // handleMediaShareUpdated(oldShare, newShare) {

  //   // 1. splice all indexed item inside media object
  //   let spliced = this.unindexMediaShare(oldShare)

  //   // 2. index all new media.
  //   this.indexMediaShare(newShare)

  //   // 3. remove empty spliced.
  //   this.cleanEmpty(spliced)
  // }

  // handleMediaShareDeleted(share) {

  //   let spliced = this.unindexMediaShare(share)
  //   this.cleanEmpty(spliced)
  // }

  // mediaSharingStatus(userUUID, media) {

  //   let sharedWithOthers = false
  //   let sharedWithMe = false
  //   let sharedWithMeAvailable = false
  //   let sharesArr = Array.from(media.shares)
  //   let nodesArr = Array.from(media.nodes)

  //   //FIXME:
  //   for (let i = 0; i < sharesArr.length; i++) {

  //     let pair = sharesArr[i]
  //     let item = pair[0]
  //     let doc = pair[1].doc
  //     if (item.creator === userUUID) sharedWithOthers = true
  //     if (doc.maintainers.includes(userUUID) || doc.viewers.includes(userUUID)) {
  //       sharedWithMe = true
  //       sharedWithMeAvailable = this.model.userIsLocal(doc.author) ?
  //         true :
  //         nodesArr.some(node => this.fileData.fromUserService(doc.author, node))
  //     }

  //     // if available is false, there is a chance that
  //     // another remote user shared the same medium with me
  //     if (sharedWithOthers && sharedWithMe && sharedWithMeAvailable)
  //       return {
  //         sharedWithOthers,
  //         sharedWithMe,
  //         sharedWithMeAvailable
  //       }
  //   }

  //   return {
  //     sharedWithOthers,
  //     sharedWithMe,
  //     sharedWithMeAvailable
  //   }
  // }

  mediaProperties(userUUID, media) {
    let props = {
      permittedToShare: false
      // authorizedToRead: false,
      // sharedWithOthers: false,
      // sharedWithMe: false
    }
    let nodes = Array.from(media.nodes)
    // let shares = Array.from(media.shares)
    // 1. user permitted to share (from fileData)
    // 2. from user library (from fileData)
    props.permittedToShare = nodes.some(node =>  
      this.fileData.userPermittedToShare(userUUID, node))

    // // 3. user authorized to read (from fileShareData)
    // props.authorizedToRead = nodes.some(node => 
    //   this.fileShareData.userAuthorizedToRead(userUUID, node)) 
    // // 4. shared with others 
    // props.sharedWithOthers = shares.some(share => 
    //   this.mediaShareData.sharedWithOthers(userUUID, share))
    // // 5. shared with me
    // props.sharedWithMe = shares.some(share => 
    //   this.mediaShareData.sharedWithMe(userUUID, share))
    // 5.1 serviceAvailable 
    if (!props.sharedWithMe) {
      props.serviceAvailable = nodes.some(node => 
        this.fileData.fromUserService(userUUID, node))
    }
    return props
  }

  // mediaShareAllowed(userUUID, digest) {
  //   let media = this.findMediaByHash(digest)
  //   if(!media) return
  //   else {
  //     let nodes = Array.from(media.nodes)
  //     return nodes.some(node => this.fileData.userPermittedToShare(userUUID, node))
  //   }
  // }

  getAllMedia(userUUID) {

    let map = new Map()
    for (let pair of this.map) {
      let props = this.mediaProperties(userUUID, pair[1])
     
      if (props.permittedToShare || props.authorizedToRead ||
        props.sharedWithOthers || props.sharedWithMe) {
        //put authorization in metadata
        map.set(pair[0], {
          metadata: pair[1].metadata,
          permittedToShare: props.permittedToShare
          // authorizedToRead: props.authorizedToRead,
          // sharedWithOthers: props.sharedWithOthers,
          // sharedWithMe: props.sharedWithMe
        })
      }
    }
    return map
  }
}

export default MediaData