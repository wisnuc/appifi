// for all operations, user should be valid, shareUUID should be validated by caller (rest router)
class MediaShareOperations {

  constructor(forest, mediaShareCollection) {
    this.forest = forest
    this.msc = mediaShareCollection
  }

  // return { digest, doc } // for compatibility
  // post should be non-null js object
  async createMediaShare(user, post) {
  } 

  // return { digest, doc } // for compatibility 
  // patch should be non-null js object
  async updateMediaShare(user, shareUUID, patch) {
  } 

  // return undefined, never fail, idempotent
  async deleteMediaShare(user, shareUUID) {
  }
}

////

const testData = Map.from([
  [uuid, { digest, doc, lock: true }]
])

deepFreeze(testData)


describe(() => {

  let msc = new MediaShareCollection(shareStore)
  msc.shareMap = testData

  msc.updatre
})


const shareStore = {
  async storeAsync(doc) {
    return 'xxxx'
  }
}
