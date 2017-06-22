FORMAT: 1A

HOST: http://wisnuc.station:3722

# Appifi API

**Appifi** is essentially a docker management tool, providing a easy-to-use way for home user to extend **wisnuc os** functionality.

It is focused on docker image and container management.


## Related API

+ [Wisnuc Cloud](https://github.com/wisnuc/*.md)
+ [Wisnuc Fruitmix](https://github.com/wisnuc/*.md)


## Data Structures

### allParam
+ status: 6 (number)
+ developer (object)
+ docker (object)
  - Include dockerParam
+ appstore (object)
  - Include appstoreParam
+ task (array[taskParam])


### dockerParam
+ containers (array)
+ images (object)
+ imageDetails (array[imageDetailsParam])
+ info (object)
+ version (object)
+ volumes (object)
+ networks (array)
+ installeds (array)


### appstoreParam
+ status: LOADED, LOADING, ERROR (enum)
+ result (object)


### taskParam
+ type: appInstall (string)
+ id: dockerhub:library:busybox:latest:vanilla (string)
+ status: started (string)
+ erron: 0 (number)
+ message (string, nullable)
+ uuid: 02bda726-c01f-46ee-8862-abc0eaae50af (string)
+ recipe (object)
+ jobs (object)


### imageDetailsParam
+ Id: `sha256:c75bebcdd211f41b3a460c7bf82970ed6c75acaab9cd4c9a4e125b03ca113798` (string)
+ RepoTags: `busybox:latest` (array[string]
+ RepoDigests: `busybox@sha256:c79345819a6882c31b41bc771d9a94fc52872fa651b36771fbe0c8461d7ee558` (array[string])
+ Parent (string)
+ Comment (string)
+ Created: `2017-05-15T22:15:45.515786084Z` (string)
+ Container: `a3c2e8914eef4442b3758b801542fd7e853deb283637fc7cec7f8aa5c9058b64` (string)
+ Include containerConfig


### containerConfig
+ ContainerConfig (object)
  - Include containerParam


### containerParam
+ Hostname: `wisnuc` (string, required) - hostname to use for the container
+ Domainname (string) - domain name to use for the container
+ User (string) - the user inside the container
+ AttachStdin: `false` (boolean, required) - attaches to *stdin*
+ AttachStdout: `false` (boolean, required) - attaches to *stdout*
+ AttachStderr: `false` (boolean, required) - attaches to *stderr*
+ Tty: `false` (boolean, required) - attach standard streams to a *tty*, including *stdin* if it is not closed
+ OpenStdin: `false` (boolean, required) - opens *stdin*
+ StdinOnce: `false` (boolean, required) - close *stdin* after the 1 attached client disconnects
+ Env (array) - a list of environment
+ Cmd (string, nullable) - command to run
+ Image (string) - image name to use for the container
+ Volumes (object) - mount point paths inside the container to empty objects
+ WorkingDir (string) - the working directory for commands to run in
+ Entrypoint (string, nullable) - set the entrypoint to the container
+ OnBuild (string, nullable)
+ Labels (object) - adds a map of labels to a container
+ HostConfig (object)
  - Include hostConfig
+ NetworkingConfig (object)
  - EndpointsConfig (object)


### hostConfig
+ Binds (array, nullable) - a list of bind-mounts for this container
+ ContainerIDFile (string)
+ LogConfig (object)
  - Type (string)
  - Config (object)
+ NetworkMode: default, bridge, host, none, container:<name | id> (enum) - sets the networking mode for the container
+ PortBindings (object) - a map of exposed container ports and the host port they should map to
+ RestartPolicy (object) - the behavior to apply when the container exits
  - Name: no, always, `unless-stopped`, `on-failure` (enum)
  - MaximumRetryCount: 0 (number)
+ AutoRemove: false (boolean) - automatically remove the container when the container's process exits
+ VolumeDriver (string)
+ VolumesFrom (string, nullable)
+ CapAdd (string, nullable)
+ CapDrop (string, nullable)
+ Dns (array)
+ DnsOptions (array)
+ DnsSearch (array)
+ ExtraHosts (string, nullable)
+ GroupAdd (string, nullable)
+ IpcMode (string)
+ Cgroup (string)
+ Links (string, nullable)
+ OomScoreAdj: 0 (number)
+ PidMode (string)
+ Privileged: false (boolean)
+ PublishAllPorts: false (boolean)
+ ReadonlyRootfs: false (boolean)
+ SecurityOpt (string, nullable)
+ StorageOpt (string, nullable)
+ UTSMode (string)
+ UsernsMode (string)
+ ShmSize: 0 (number)
+ ConsoleSize: 0, 0 (array)
+ Isolation (string)
+ CpuShares: 0 (number)
+ Memory: 0 (number)
+ CgroupParent (string)
+ BlkioWeight: 0 (number)
+ BlkioWeightDevice (string, nullable)
+ BlkioDeviceReadBps (string, nullable)
+ BlkioDeviceWriteBps (string, nullable)
+ BlkioDeviceReadIOps (string, nullable)
+ BlkioDeviceWriteIOps (string, nullable)
+ CpuPeriod: 0 (number)
+ CpuQuota: 0 (number)
+ CpusetCpus (string)
+ CpusetMems (string)
+ Devices (array)
+ DiskQuota: 0 (number)
+ KernelMemory: 0 (number)
+ MemoryReservation: 0 (number)
+ MemorySwap: 0 (number)
+ MemorySwappiness: `-1` (string)
<!--+ MemorySwappiness: -1 (number)-->
+ OomKillDisable: false (boolean)
+ PidsLimit: 0 (number)
+ Ulimits (string, nullable)
+ CpuCount: 0 (number)
+ CpuPercent: 0 (number)
+ BlkioIOps: 0 (number)
+ BlkioBps: 0 (number)
+ SandboxSize: 0 (number)


### installDocker
+ operation: `appInstall` (string, required) - operation name
+ args: `dockerhub: library: busybox: latest: vanilla` (array, required) - operation args


### uninstallDocker
+ operation: `appUninstall` (string, required) - operation name
+ args: `918b3900-b190-44bb-8c1f-9c9aa8182050` (array, required) - uuid


### daemonStart
+ operation: `daemonStart` (string, required) - operation name
+ args (array)


### daemonStop
+ operation: `daemonStop` (string, required) - operation name
+ args (array)


### containerStart
+ operation: `containerStart` (string, required) - operation name
+ args: `3c2e8914eef4442b3758b801542fd7e853deb283637fc7cec7f8aa5c9058b64` (string, required) - container id


### containerStop
+ operation: `containerStop` (string, required) - operation name
+ args: `3c2e8914eef4442b3758b801542fd7e853deb283637fc7cec7f8aa5c9058b64` (string, required) - container id


### containerDelete
+ operation: `containerDelete` (string, required) - operation name
+ args: `3c2e8914eef4442b3758b801542fd7e853deb283637fc7cec7f8aa5c9058b64` (string, required) - container id


### installedStart
+ operation: `installedStart` (string, required) - operation name
+ args: `918b3900-b190-44bb-8c1f-9c9aa8182050` (array, required) - uuid


### installedStop
+ operation: `installedStop` (string, required) - operation name
+ args: `918b3900-b190-44bb-8c1f-9c9aa8182050` (array, required) - uuid


# Group Modules

It's all about appifi-related modules. You can get or change every module's status, and start or stop appstore's docker.


## All Modules [/server]

It includes modules like below:

+ appifi own status

+ docker

+ appstore

+ tasks


### All [GET]

It will get all modules' current status.

+ Response 200 (application/json)

  + Body

    + Attributes (allParam)


### Docker [POST]

Use for **appstore**, it can download a new specified docker image into appstore or remove a specified docker image which stored in appstore.

+ Request installDocker (application/json)

  + Body

    + Attributes (installDocker)

+ Response 200


+ Request uninstallDocker (application/json)

  + Body

    + Attributes (uninstallDocker)

+ Response 200


+ Request daemonStart (application/json)

  + Body

    + Attributes (daemonStart)

+ Response 200


+ Request daemonStop (application/json)

  + Body

    + Attributes (daemonStop)

+ Response 200


+ Request containerStart (application/json)

  + Body

    + Attributes (containerStart)

+ Response 200


+ Request containerStop (application/json)

  + Body

    + Attributes (containerStop)

+ Response 200


+ Request containerDelete (application/json)

  + Body

    + Attributes (containerDelete)

+ Response 200


+ Request installedStart (application/json)

  + Body

    + Attributes (installedStart)

+ Response 200


+ Request installedStop (application/json)

  + Body

    + Attributes (installedStop)

+ Response 200

## Appifi Own [/server/status]

It only includes appifi itself.


### Status [GET]

+ Response 200 (application/json)

  + Body

            {
              "status": 6
            }

### Placeholder [POST]

+ Response 200 (application/json)

