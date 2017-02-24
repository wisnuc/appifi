// Directed Acyclic Graph

class Media {

  constructor(key, type, metadata) {
    this.key = key
    this.type = type
    this.metadata = metadata
    this.files = []
    this.shares = []
  }
}

// Forest <- MediaShare
// MediaCollection -> Forest and MediaShare
class MediaCollection {

  constructor(forest, mediashare) {

    this.forest = forest
    this.forest.setMediaCollection(this)

    this.mediashare = mediashare
    this.mediashare = mediashare.setMediaCollection(this)
    
    this.map = new Map()
  }

  // given user uuid, return array of ALL I CAN VIEW
  // with properties
  getMedia(userUUID) {

    let arr = []
    this.map.forEach((media, sha256, map) => {

      let props = {}

      if (this.forest.includesFileOwnedByUser(this.files, userUUID))
        props.owned = true

      if (this.forest.includesFileInUserLibrary(this.files, userUUID))
        props.inLibrary = true
      
      // this.forest.fileCollectionProperties(this.files, userUUID)
      // {
      //   owned ?
      //   inLibrary ?
      //   readable ?
      //   readableSet
      // }
      
    })
  }
}
