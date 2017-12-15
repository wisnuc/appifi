# Unit Tesing xstat.js

## readXstat
1. (7个UT) 必须为文件或者文件夹 --> (字符链接、套字节文件、块设备二进制文件、字符设备、命名管道、文件、文件夹)
2. (4个UT) 必须为一个合法的uuid --> (obj、string、[]、UUID.v4()) --> pass
3. (7个UT) owner必须为一个合法的uuid数组,可能为空 --> (obj、undefined、UUID.v4()、[obj]、[]、[UUID.v4()]、[UUID.v4(),string]) --> pass
4. (1个UT) 文件夹没有hash属性 --> (文件夹) --> pass
5. (5个UT) 文件必须有一个合法的hash属性或者hash属性undefined --> (obj、[]、hash value)  --> pass
6. (?个UT) writelist必须是一个合法的uuid数组或者为undefined，readlist必须是一个合法的uuid数组或者为undefined，并且writelist和readlist类型 --> () --> pass
7. (1个UT) 返回预设的值 --> (全部合法) --> pass

## updateXattrOwner
1. (3个UT) target必须为一个文件或者文件夹路径 --> (obj、string、path)
2. (2个UT) uuid必须相等 -->(相等、不相等)
3. (6个UT) owner必须为一个合法的uuid数组 --> (obj、undefined、UUID.v4()、[obj]、[]、[UUID.v4()])
4. (1个UT) 返回预设的值 --> (全部合法)

## updateXattrPermission
1. (3个UT) target必须为一个文件或者文件夹路径 --> (obj、string、path)
2. (2个UT) uuid必须相等 -->(相等、不相等)
3. (?个UT) writelist必须是一个合法的uuid数组或者为undefined，readlist必须是一个合法的uuid数组或者为undefined，并且writelist和readlist类型 --> ()
4. (1个UT) 返回预设的值 --> (全部合法)

## updateXattrHash
1. (3个UT) target必须为一个文件或者文件夹路径 --> (obj、string、path)
2. (2个UT) uuid必须相等 -->(相等、不相等)
3. (3个UT) 必须为一个合法的hash --> (obj、string、hash)
4. (2个UT) htime必须相等 --> (相等、不相等)
5. (1个UT) 返回预设的值 --> (全部合法)
