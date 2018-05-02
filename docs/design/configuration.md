# 系统配置

appifi/fruitmix项目为针对平台、部署、和开发可配置的。

`src/configurations.js`文件提供了系统的可选配置，在启动入口文件中导入了该配置。

目前系统设计支持两种配置：

+ configurations.phicomm.n2是针对n2设备的配置
+ configurations.wisnuc.default是针对wisnuc设备的配置

配置的格式如下：

```js
{ 
  chassis: {
    userBinding: true,          // 是否使用chassis-user binding
                                // 如果为true，系统管理员的绑定属性从外部注入，包括离线密码
    volumeBinding: true,        // 是否使用chassis-volume binding
    dir: '/etc/phicomm',        // chassis目录
    tmpDir: '/etc/phicomm/atmp' // chassis临时目录，需要与chassis目录位于同一个文件系统
  },  
  storage: {
    fruitmixDir: 'phicomm/n2',            // 在btrfs卷上，fruitmix的目录
    volumeDir: '/run/phicomm/volumes',    // 系统挂载所有btrfs磁盘卷的目录位置
    nonVolumeDir: '/run/phicomm/blocks',  // 系统挂载所有非btrfs磁盘文件系统的位置，
                                          // 但不包含用udisksctl挂载的USB设备上的文件系统
    userProps: ['uuid', 'username']       // boot/probe提取的用户文件字段
  }
}
```

# Boot配置

```js
{
  configuration: {},        // appifi global configuration
  fruitmixOpts: {}          // fruitmix option
}
```

使用Boot启动fruitmix时，fruitmixOpts无须提供fruitmixDir，Boot自己决定该参数。

# Fruitmix配置

```js
{
  fruitmixDir: "absolute path of fruitmix root",
  useSmb: false,            // 使用Samba
  useDlna: false,
  useTransmision: false
}
```
