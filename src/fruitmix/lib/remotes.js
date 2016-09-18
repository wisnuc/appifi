
// a remote represents a remote user
//
// the key design criteria is: like the git, conceptually there is
// a local branch mirroring a remote one. This local branch is read-only,
// can only be updated atomically from the remote server.
// this is a simple model to avoid all the issues raised from inconsistent status
// between two parties. 
class Remote {

  constructor(myUUID) {

    this.myUUID = myUUID

    this.friendUUIDs = friendUUIDs

    this.shareMap = new Map()
    this.mediaMap = new Map()
    this.talkMap = new Map()
  }

  // an update should replace everything!
  update() {

  }

  getShares(friendUUID) {
    
  }

  getTalks(mediaUUID, friendUUID) {

  }
}
