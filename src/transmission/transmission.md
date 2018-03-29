#transmission
##Definition
### torrent object
```
"id": Id of task,
"name": Name of task,
"dirUUID": Target directory uuid,
"rateDownload": Download rate in bps,
"percentDone": Download progress 0.0 to 1.0,
"eta": Estimated number of seconds left when downloading,
"status": below
```
### status
Return torrent status with integer '0-7'
```
transmission.status =
  STOPPED       : 0  # Torrent is stopped (pause)
  CHECK_WAIT    : 1  # Queued to check files
  CHECK         : 2  # Checking files
  DOWNLOAD_WAIT : 3  # Queued to download
  DOWNLOAD      : 4  # Downloading 
  SEED_WAIT     : 5  # Queued to seed (finish)
  SEED          : 6  # Seeding (finish)
  ISOLATED      : 7  # Torrent can't find peers
```
## Apis
___ 
### Get &nbsp; /transmission

Get torrents info

####    Header 
>Authorization: token
___ 
###Post &nbsp; /transmission/magnet
Add torrents to transmission with `magnet` url
####    Header 
>Authorization: token
####    Body(application/json)
>magnetURL
>dirUUID
___ 
###Post &nbsp; /transmission/torrent

Add torrents to transmission with `torrent` file
####    Header 
>Authorization: token
####    Body(form-data)
>torrent: torrent file
>dirUUID
___ 
###Patch &nbsp; /transmission/:id 
Operation on task (pause/resume/remove)
####    Header 
>Authorization: token
####    Body(application/json)
>op : [pause, resume, remove]
