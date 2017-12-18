# Library

No specific storage for Library

File uploaded by library api are stored in library drive.

* library POST create uuid (device instance)

device instance

alice's library drive

/xxxxxxxxxx/
   /uuid (folder)
    xxxxx



* upload: library/xxxxxxxxx/ POST multipart formdata update-preview

{
  library uuid: client applied uuid, device instance uuid,
  digest: xxxxx,
  time: integer UTC
}

* log: library/xxxxxxx/log GET

123 check ???
234 check 234
345
