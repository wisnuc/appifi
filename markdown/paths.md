# Paths

`src/lib/paths` is responsible for building the folder/file hierarchy for fruitmix

```
/ # root
  /documents
  /drives
    /drive-uuid
    /remote-user (? seems to be a good idea)
  /models
  /mediashare (ref)
  /mediatalk (ref)
    /userUUID.mediaDigest 
  /etc
    /certs
      /public
      /private
    users.json
    drives.json
  /tmp

  /remotes
    /user-uuid
      /etc
      /share (ref) ???
      /talk (ref)
        
```
