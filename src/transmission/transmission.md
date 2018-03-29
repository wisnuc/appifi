#transmission
##Definition
### torrent object
```
"id": 4,
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

### Get  /transmission
___ 
Get torrents info

####    Header 
>Authorization: token

###Post  /transmission/magnet

>aaa
>
>bbb

    var a = new Date()

***
---
___

this is an [example](http://www.baidu.com)

*this is ?*

`this is ?`

### a a 
#### a a
##### a
