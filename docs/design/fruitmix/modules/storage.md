# Storage

## usage

usage检查结果来自两个不同的命令：

```bash
btrfs filesystem usage -b ${mountpoint}

Overall:
    Device size:		       21474836480
    Device allocated:		        4311744512
    Device unallocated:		       17163091968
    Device missing:		                 0
    Used:			           1310720
    Free (estimated):		        9654763520	(min: 9654763520)
    Data ratio:			              2.00
    Metadata ratio:		              2.00
    Global reserve:		          16777216	(used: 0)

Data,RAID1: Size:1073741824, Used:524288
   /dev/sdb	1073741824
   /dev/sdc	1073741824

Metadata,RAID1: Size:1073741824, Used:114688
   /dev/sdb	1073741824
   /dev/sdc	1073741824

System,RAID1: Size:8388608, Used:16384
   /dev/sdb	   8388608
   /dev/sdc	   8388608

Unallocated:
   /dev/sdb	8581545984
   /dev/sdc	8581545984

```

和

```bash
btrfs device usage -b ${mountpoint}

/dev/sdb, ID: 1
   Device size:          10737418240
   Data,RAID1:           1073741824
   Metadata,RAID1:       1073741824
   System,RAID1:            8388608
   Unallocated:          8581545984

/dev/sdc, ID: 2
   Device size:          10737418240
   Data,RAID1:           1073741824
   Metadata,RAID1:       1073741824
   System,RAID1:            8388608
   Unallocated:          8581545984

```

两者被混合到一个json对象上，其中`devices`属性给出的是第二个命令的结果。

```json
{
  "mountpoint": "/run/phicomm/volumes/cd175561-e2bc-4f6c-82ea-22ead4a1277f",
  "overall": {
    "deviceSize": 21474836480,
    "deviceAllocated": 4311744512,
    "deviceUnallocated": 17163091968,
    "deviceMissing": 0,
    "used": 1310720,
    "free": 9654763520,
    "freeMin": 9654763520,
    "dataRatio": "2.00",
    "metadataRatio": "2.00",
    "globalReserve": 16777216,
    "globalReserveUsed": 0
  },
  "data": {
    "devices": [],
    "mode": "RAID1",
    "size": 1073741824,
    "used": 524288
  },
  "metadata": {
    "devices": [],
    "mode": "RAID1",
    "size": 1073741824,
    "used": 114688
  },
  "system": {
    "devices": [],
    "mode": "RAID1",
    "size": 8388608,
    "used": 16384
  },
  "unallocated": {
    "devices": []
  },
  "devices": [
    {
      "data": {
        "mode": "RAID1",
        "size": 1073741824
      },
      "metadata": {
        "mode": "RAID1",
        "size": 1073741824
      },
      "system": {
        "mode": "RAID1",
        "size": 8388608
      },
      "name": "/dev/sdb",
      "id": 1,
      "size": 10737418240,
      "unallocated": 8581545984
    },
    {
      "data": {
        "mode": "RAID1",
        "size": 1073741824
      },
      "metadata": {
        "mode": "RAID1",
        "size": 1073741824
      },
      "system": {
        "mode": "RAID1",
        "size": 8388608
      },
      "name": "/dev/sdc",
      "id": 2,
      "size": 10737418240,
      "unallocated": 8581545984
    }
  ]
}
```

在重新格式化的时候，前面的整体usage部分放入`usage`属性，device里的usage部分混入`devices`属性。