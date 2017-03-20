class ShareAllowed {
  constructor(){}

  mediaShareAllowed(user, digest) {
   return true
  }
}

let shareAllowed = new ShareAllowed()

export {shareAllowed} 