# Metadata

Metadata指文件内的文件信息，例如图片的尺寸和exif信息，不是指文件系统上的文件信息。



Metadata支持的文件类型，沿用linux文件系统的习惯，在File对象内的属性名称为`magic`，在`metadata`对象内使用`m`简写。如下所示



例子：File API GET一个目录的返回结果。

```json
{
    "path": [
        {
            "uuid": "02000ee4-bfbc-4681-98c8-f71b904260e9",
            "name": "02000ee4-bfbc-4681-98c8-f71b904260e9",
            "mtime": 1509326615986
        }
    ],
    "entries": [
        {
            "uuid": "298ca860-6733-4b52-be9d-dc9c4c6c7635",
            "type": "file",
            "name": "alonzo_church.jpg",
            "mtime": 1509245165107,
            "size": 39499,
            "magic": "JPEG",
            "hash": "8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408",
            "metadata": {
                "m": "JPEG",
                "w": 235,
                "h": 314,
                "size": 39499
            }
        },
        {
            "uuid": "aaf39b52-8204-4072-b2a4-906ddbbebc39",
            "type": "file",
            "name": "vpai001.jpg",
            "mtime": 1509326616030,
            "size": 4192863,
            "magic": "JPEG",
            "hash": "529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb",
            "metadata": {
                "m": "JPEG",
                "w": 4624,
                "h": 2608,
                "orient": 1,
                "datetime": "2017:06:17 17:31:18",
                "make": "Sony",
                "model": "G3116",
                "lat": "31/1, 10/1, 506721/10000",
                "latr": "N",
                "long": "121/1, 36/1, 27960/10000",
                "longr": "E",
                "size": 4192863
            }
        }
    ]
}
```

对应的Media API的返回结果：

```json
[
    {
        "m": "JPEG",
        "w": 235,
        "h": 314,
        "size": 39499,
        "hash": "8e28737e8cdf679e65714fe2bdbe461c80b2158746f4346b06af75b42f212408"
    },
    {
        "m": "JPEG",
        "w": 4624,
        "h": 2608,
        "orient": 1,
        "datetime": "2017:06:17 17:31:18",
        "make": "Sony",
        "model": "G3116",
        "lat": "31/1, 10/1, 506721/10000",
        "latr": "N",
        "long": "121/1, 36/1, 27960/10000",
        "longr": "E",
        "size": 4192863,
        "hash": "529e471a71866e439d8892179e4a702cf8529ff32771fcf4654cfdcea68c11fb"
    }
]
```



支持的MAGIC类型：

1. JPEG
2. PNG
3. GIF
4. 3GP
5. MP4
6. MOV
7. WEBM





