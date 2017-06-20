FORMAT: 1A

HOST: http://wisnuc.station:3722

# Appifi API

**Appifi** is essentially a docker management tool, providing a easy-to-use way for home user to extend **wisnuc os** functionality.

It is focused on docker image and container management.


## Related API

+ [Wisnuc Cloud](https://github.com/wisnuc/*.md)
+ [Wisnuc Fruitmix](https://github.com/wisnuc/*.md)

## Data Structures

### installDocker
+ operation: `appInstall` (string, required) - operation name
+ args: `dockerhub: library: busybox: latest: vanilla` (array, required) - operation args

### uninstallDocker
+ operation: `appUninstall` (string, required) - operation name
+ args: `918b3900-b190-44bb-8c1f-9c9aa8182050` (array, required) - operation args

# Group Modules

It's all about appifi-related modules. You can get or change every module's status, and start or stop appstore's docker.


## Appifi [/server]

It includes modules like below:

+ its own status

+ docker

+ appstore

+ tasks


### Get Current Status [GET]
It will get all modules' current status.

+ Request

    + Headers

            Accept: application/json

    + Body

            {}

+ Response 200

    + Headers

            Accept: application/json

    + Body

            {
              "status": 6,
              "developer": {},
              "docker": {
                "containers": [],
                "images": [
                  {
                    "Id": "sha256:c75bebcdd211f41b3a460c7bf82970ed6c75acaab9cd4c9a4e125b03ca113798",
                    "ParentId": "",
                    "RepoTags": [
                      "busybox:latest"
                    ],
                    "RepoDigests": [
                      "busybox@sha256:c79345819a6882c31b41bc771d9a94fc52872fa651b36771fbe0c8461d7ee558"
                    ],
                    "Created": 1494886545,
                    "Size": 1106304,
                    "VirtualSize": 1106304,
                    "Labels": {}
                  }
                ],
                "imageDetails": [
                  {
                    "Id": "sha256:c75bebcdd211f41b3a460c7bf82970ed6c75acaab9cd4c9a4e125b03ca113798",
                    "RepoTags": [
                      "busybox:latest"
                    ],
                    "RepoDigests": [
                      "busybox@sha256:c79345819a6882c31b41bc771d9a94fc52872fa651b36771fbe0c8461d7ee558"
                    ],
                    "Parent": "",
                    "Comment": "",
                    "Created": "2017-05-15T22:15:45.515786084Z",
                    "Container": "a3c2e8914eef4442b3758b801542fd7e853deb283637fc7cec7f8aa5c9058b64",
                    "ContainerConfig": {
                      "Hostname": "971d7095b61b",
                      "Domainname": "",
                      "User": "",
                      "AttachStdin": false,
                      "AttachStdout": false,
                      "AttachStderr": false,
                      "Tty": false,
                      "OpenStdin": false,
                      "StdinOnce": false,
                      "Env": [
                        "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
                      ],
                      "Cmd": [
                        "/bin/sh",
                        "-c",
                        "#(nop) ",
                        "CMD [\"sh\"]"
                      ],
                      "ArgsEscaped": true,
                      "Image": "sha256:7cc4b5aefd1d0cadf8d97d4350462ba51c694ebca145b08d7d41b41acc8db5aa",
                      "Volumes": null,
                      "WorkingDir": "",
                      "Entrypoint": null,
                      "OnBuild": null,
                      "Labels": {}
                    },
                    "DockerVersion": "17.03.1-ce",
                    "Author": "",
                    "Config": {
                      "Hostname": "971d7095b61b",
                      "Domainname": "",
                      "User": "",
                      "AttachStdin": false,
                      "AttachStdout": false,
                      "AttachStderr": false,
                      "Tty": false,
                      "OpenStdin": false,
                      "StdinOnce": false,
                      "Env": [
                        "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
                      ],
                      "Cmd": [
                        "sh"
                      ],
                      "ArgsEscaped": true,
                      "Image": "sha256:7cc4b5aefd1d0cadf8d97d4350462ba51c694ebca145b08d7d41b41acc8db5aa",
                      "Volumes": null,
                      "WorkingDir": "",
                      "Entrypoint": null,
                      "OnBuild": null,
                      "Labels": {}
                    },
                    "Architecture": "amd64",
                    "Os": "linux",
                    "Size": 1106304,
                    "VirtualSize": 1106304,
                    "GraphDriver": {
                      "Name": "btrfs",
                      "Data": null
                    },
                    "RootFS": {
                      "Type": "layers",
                      "Layers": [
                        "sha256:4ac76077f2c741c856a2419dfdb0804b18e48d2e1a9ce9c6a3f0605a2078caba"
                      ]
                    }
                  }
                ],
                "info": {
                  "ID": "VW2M:2TPN:SXFW:KAKL:OVNQ:CFJM:NNQW:QXED:ZN5Y:6XKP:S6GQ:NALY",
                  "Containers": 0,
                  "ContainersRunning": 0,
                  "ContainersPaused": 0,
                  "ContainersStopped": 0,
                  "Images": 1,
                  "Driver": "btrfs",
                  "DriverStatus": [
                    [
                      "Build Version",
                      "Btrfs v3.17"
                    ],
                    [
                      "Library Version",
                      "101"
                    ]
                  ],
                  "SystemStatus": null,
                  "Plugins": {
                    "Volume": [
                      "local"
                    ],
                    "Network": [
                      "null",
                      "bridge",
                      "overlay",
                      "host"
                    ],
                    "Authorization": null
                  },
                  "MemoryLimit": true,
                  "SwapLimit": false,
                  "KernelMemory": true,
                  "CpuCfsPeriod": true,
                  "CpuCfsQuota": true,
                  "CPUShares": true,
                  "CPUSet": true,
                  "IPv4Forwarding": true,
                  "BridgeNfIptables": true,
                  "BridgeNfIp6tables": true,
                  "Debug": true,
                  "NFd": 15,
                  "OomKillDisable": true,
                  "NGoroutines": 25,
                  "SystemTime": "2017-06-15T11:16:10.570559138+08:00",
                  "ExecutionDriver": "",
                  "LoggingDriver": "json-file",
                  "CgroupDriver": "cgroupfs",
                  "NEventsListener": 1,
                  "KernelVersion": "4.4.0-79-generic",
                  "OperatingSystem": "Ubuntu 16.04.1 LTS",
                  "OSType": "linux",
                  "Architecture": "x86_64",
                  "IndexServerAddress": "https://index.docker.io/v1/",
                  "RegistryConfig": {
                    "InsecureRegistryCIDRs": [
                      "127.0.0.0/8"
                    ],
                    "IndexConfigs": {
                      "docker.io": {
                        "Name": "docker.io",
                        "Mirrors": null,
                        "Secure": true,
                        "Official": true
                      }
                    },
                    "Mirrors": null
                  },
                  "NCPU": 4,
                  "MemTotal": 2079203328,
                  "DockerRootDir": "/run/wisnuc/volumes/56b53ac8-b541-492e-9dda-0733f6361312/appifi/g",
                  "HttpProxy": "",
                  "HttpsProxy": "",
                  "NoProxy": "",
                  "Name": "wisnuc-virtual-machine",
                  "Labels": null,
                  "ExperimentalBuild": false,
                  "ServerVersion": "1.12.4",
                  "ClusterStore": "",
                  "ClusterAdvertise": "",
                  "SecurityOptions": [
                    "apparmor",
                    "seccomp"
                  ],
                  "Runtimes": {
                    "runc": {
                      "path": "docker-runc"
                    }
                  },
                  "DefaultRuntime": "runc",
                  "Swarm": {
                    "NodeID": "",
                    "NodeAddr": "",
                    "LocalNodeState": "inactive",
                    "ControlAvailable": false,
                    "Error": "",
                    "RemoteManagers": null,
                    "Nodes": 0,
                    "Managers": 0,
                    "Cluster": {
                      "ID": "",
                      "Version": {},
                      "CreatedAt": "0001-01-01T00:00:00Z",
                      "UpdatedAt": "0001-01-01T00:00:00Z",
                      "Spec": {
                        "Orchestration": {},
                        "Raft": {},
                        "Dispatcher": {},
                        "CAConfig": {},
                        "TaskDefaults": {}
                      }
                    }
                  },
                  "LiveRestoreEnabled": false
                },
                "version": {
                  "Version": "1.12.4",
                  "ApiVersion": "1.24",
                  "GitCommit": "1564f02",
                  "GoVersion": "go1.6.4",
                  "Os": "linux",
                  "Arch": "amd64",
                  "KernelVersion": "4.4.0-79-generic",
                  "BuildTime": "2016-12-13T02:47:26.489232908+00:00"
                },
                "volumes": {
                  "Volumes": null,
                  "Warnings": null
                },
                "networks": [
                  {
                    "Name": "host",
                    "Id": "3d988c51c8f4521b45ee474559928025ced3def1de87ed490b4f5bb6c05da844",
                    "Scope": "local",
                    "Driver": "host",
                    "EnableIPv6": false,
                    "IPAM": {
                      "Driver": "default",
                      "Options": null,
                      "Config": []
                    },
                    "Internal": false,
                    "Containers": {},
                    "Options": {},
                    "Labels": {}
                  },
                  {
                    "Name": "none",
                    "Id": "b60756b0d4d3e9f1340a05f1d7b47e36d53e27621852e99224119c6e2acf7226",
                    "Scope": "local",
                    "Driver": "null",
                    "EnableIPv6": false,
                    "IPAM": {
                      "Driver": "default",
                      "Options": null,
                      "Config": []
                    },
                    "Internal": false,
                    "Containers": {},
                    "Options": {},
                    "Labels": {}
                  },
                  {
                    "Name": "bridge",
                    "Id": "d218f2959ce09628610055dcd879bd6280571e15714850d1ac9a940e99d21379",
                    "Scope": "local",
                    "Driver": "bridge",
                    "EnableIPv6": false,
                    "IPAM": {
                      "Driver": "default",
                      "Options": null,
                      "Config": [
                        {
                          "Subnet": "172.17.0.0/16",
                          "Gateway": "172.17.0.1"
                        }
                      ]
                    },
                    "Internal": false,
                    "Containers": {},
                    "Options": {
                      "com.docker.network.bridge.default_bridge": "true",
                      "com.docker.network.bridge.enable_icc": "true",
                      "com.docker.network.bridge.enable_ip_masquerade": "true",
                      "com.docker.network.bridge.host_binding_ipv4": "0.0.0.0",
                      "com.docker.network.bridge.name": "docker0",
                      "com.docker.network.driver.mtu": "1500"
                    },
                    "Labels": {}
                  }
                ],
                "installeds": []
              },
              "appstore": {
                "status": "LOADED",
                "result": [
                  {
                    "appname": "ownCloud",
                    "flavor": "vanilla",
                    "components": [
                      {
                        "name": "owncloud",
                        "namespace": "library",
                        "imageLink": "owncloud.png",
                        "tag": "latest",
                        "repo": {
                          "user": "library",
                          "name": "owncloud",
                          "namespace": "library",
                          "repository_type": "image",
                          "status": 1,
                          "description": "ownCloud is a self-hosted file sync and share server.",
                          "is_private": false,
                          "is_automated": false,
                          "can_edit": false,
                          "star_count": 726,
                          "pull_count": 6034821,
                          "last_updated": "2017-06-14T14:26:02.944016Z",
                          "build_on_cloud": null,
                          "has_starred": false,
                          "full_description": "# Supported tags and respective `Dockerfile` links\n\n-\t[`8.0.16-apache`, `8.0-apache`, `8.0.16`, `8.0` (*8.0/apache/Dockerfile*)](https://github.com/docker-library/owncloud/blob/2c9fddfe6a17a2c1d631dd7a6f1c7f87763f7d10/8.0/apache/Dockerfile)\n-\t[`8.0.16-fpm`, `8.0-fpm` (*8.0/fpm/Dockerfile*)](https://github.com/docker-library/owncloud/blob/2c9fddfe6a17a2c1d631dd7a6f1c7f87763f7d10/8.0/fpm/Dockerfile)\n-\t[`8.1.12-apache`, `8.1-apache`, `8.1.12`, `8.1` (*8.1/apache/Dockerfile*)](https://github.com/docker-library/owncloud/blob/2e581bdb03a2961e5dad7764f59ff363da94e6fb/8.1/apache/Dockerfile)\n-\t[`8.1.12-fpm`, `8.1-fpm` (*8.1/fpm/Dockerfile*)](https://github.com/docker-library/owncloud/blob/2e581bdb03a2961e5dad7764f59ff363da94e6fb/8.1/fpm/Dockerfile)\n-\t[`8.2.11-apache`, `8.2-apache`, `8-apache`, `8.2.11`, `8.2`, `8` (*8.2/apache/Dockerfile*)](https://github.com/docker-library/owncloud/blob/3182c1fc072fb43c165d65de7bee16aa2374efd7/8.2/apache/Dockerfile)\n-\t[`8.2.11-fpm`, `8.2-fpm`, `8-fpm` (*8.2/fpm/Dockerfile*)](https://github.com/docker-library/owncloud/blob/3182c1fc072fb43c165d65de7bee16aa2374efd7/8.2/fpm/Dockerfile)\n-\t[`9.0.10-apache`, `9.0-apache`, `9.0.10`, `9.0` (*9.0/apache/Dockerfile*)](https://github.com/docker-library/owncloud/blob/6bb84a4253c8a84af6a9b3968eb61388c65be5fb/9.0/apache/Dockerfile)\n-\t[`9.0.10-fpm`, `9.0-fpm` (*9.0/fpm/Dockerfile*)](https://github.com/docker-library/owncloud/blob/6bb84a4253c8a84af6a9b3968eb61388c65be5fb/9.0/fpm/Dockerfile)\n-\t[`9.1.6-apache`, `9.1-apache`, `9-apache`, `apache`, `9.1.6`, `9.1`, `9`, `latest` (*9.1/apache/Dockerfile*)](https://github.com/docker-library/owncloud/blob/4a90ae0bfeec972185fd920130b70b6c51eec6f4/9.1/apache/Dockerfile)\n-\t[`9.1.6-fpm`, `9.1-fpm`, `9-fpm`, `fpm` (*9.1/fpm/Dockerfile*)](https://github.com/docker-library/owncloud/blob/4a90ae0bfeec972185fd920130b70b6c51eec6f4/9.1/fpm/Dockerfile)\n\n# Quick reference\n\n-\t**Where to get help**:  \n\t[the Docker Community Forums](https://forums.docker.com/), [the Docker Community Slack](https://blog.docker.com/2016/11/introducing-docker-community-directory-docker-community-slack/), or [Stack Overflow](https://stackoverflow.com/search?tab=newest&q=docker)\n\n-\t**Where to file issues**:  \n\t[https://github.com/docker-library/owncloud/issues](https://github.com/docker-library/owncloud/issues)\n\n-\t**Maintained by**:  \n\t[the Docker Community](https://github.com/docker-library/owncloud)\n\n-\t**Published image artifact details**:  \n\t[repo-info repo's `repos/owncloud/` directory](https://github.com/docker-library/repo-info/blob/master/repos/owncloud) ([history](https://github.com/docker-library/repo-info/commits/master/repos/owncloud))  \n\t(image metadata, transfer size, etc)\n\n-\t**Image updates**:  \n\t[official-images PRs with label `library/owncloud`](https://github.com/docker-library/official-images/pulls?q=label%3Alibrary%2Fowncloud)  \n\t[official-images repo's `library/owncloud` file](https://github.com/docker-library/official-images/blob/master/library/owncloud) ([history](https://github.com/docker-library/official-images/commits/master/library/owncloud))\n\n-\t**Source of this description**:  \n\t[docs repo's `owncloud/` directory](https://github.com/docker-library/docs/tree/master/owncloud) ([history](https://github.com/docker-library/docs/commits/master/owncloud))\n\n-\t**Supported Docker versions**:  \n\t[the latest release](https://github.com/docker/docker/releases/latest) (down to 1.6 on a best-effort basis)\n\n# What is ownCloud?\n\nownCloud is a self-hosted file sync and share server. It provides access to your data through a web interface, sync clients or WebDAV while providing a platform to view, sync and share across devices easily—all under your control. ownCloud’s open architecture is extensible via a simple but powerful API for applications and plugins and it works with any storage.\n\n> [owncloud.org](https://owncloud.org/)\n\n![logo](https://raw.githubusercontent.com/docker-library/docs/9d36b4ed7cabc35dbd3849272ba2bd7abe482172/owncloud/logo.png)\n\n# How to use this image\n\n## Start ownCloud\n\nStarting the ownCloud 8.1 instance listening on port 80 is as easy as the following:\n\n```console\n$ docker run -d -p 80:80 owncloud:8.1\n```\n\nThen go to http://localhost/ and go through the wizard. By default this container uses SQLite for data storage, but the wizard should allow for connecting to an existing database. Additionally, tags for 6.0, 7.0, or 8.0 are available.\n\nFor a MySQL database you can link an database container, e.g. `--link my-mysql:mysql`, and then use `mysql` as the database host on setup.\n\n## Persistent data\n\nAll data beyond what lives in the database (file uploads, etc) is stored within the default volume `/var/www/html`. With this volume, ownCloud will only be updated when the file `version.php` is not present.\n\n-\t`-v /<mydatalocation>:/var/www/html`\n\nFor fine grained data persistence, you can use 3 volumes, as shown below.\n\n-\t`-v /<mydatalocation>/apps:/var/www/html/apps` installed / modified apps\n-\t`-v /<mydatalocation>/config:/var/www/html/config` local configuration\n-\t`-v /<mydatalocation>/data:/var/www/html/data` the actual data of your ownCloud\n\n### Caveat\n\nWhen using the 6.0 image, you need to map the host port to the container port that apache listens on when going through the installation wizard. By default, this is port 80.\n\n## Using `occ`\n\nThe [`occ` tool from upstream](https://doc.owncloud.org/server/9.0/admin_manual/configuration_server/occ_command.html) is simplest to use via `docker exec`, similar to the example provided there:\n\n```console\n$ docker exec -u www-data some-owncloud php occ status\n```\n\n## ... via [`docker-compose`](https://github.com/docker/compose)\n\nExample `docker-compose.yml` for `owncloud`:\n\n```yaml\n# ownCloud with MariaDB/MySQL\n#\n# Access via \"http://localhost:8080\" (or \"http://$(docker-machine ip):8080\" if using docker-machine)\n#\n# During initial ownCloud setup, select \"Storage & database\" --> \"Configure the database\" --> \"MySQL/MariaDB\"\n# Database user: root\n# Database password: example\n# Database name: pick any name\n# Database host: replace \"localhost\" with \"mysql\"\n\nversion: '2'\n\nservices:\n\n  owncloud:\n    image: owncloud\n    ports:\n      - 8080:80\n\n  mysql:\n    image: mariadb\n    environment:\n      MYSQL_ROOT_PASSWORD: example\n```\n\n# License\n\nView [license information](https://owncloud.org/contribute/agreement/) for the software contained in this image.",
                          "affiliation": null,
                          "permissions": {
                            "read": true,
                            "write": false,
                            "admin": false
                          }
                        },
                        "overlay": true,
                        "config": {
                          "HostConfig": {
                            "Binds": [
                              "/var/www/html:/var/www/html"
                            ],
                            "RestartPolicy": {
                              "Name": "unless-stopped"
                            },
                            "PortBindings": {
                              "80/tcp": [
                                {
                                  "HostPort": "10086"
                                }
                              ]
                            },
                            "PublishAllPorts": false
                          }
                        },
                        "volumes": []
                      }
                    ],
                    "key": "dockerhub:library:owncloud:latest:vanilla"
                  },
                  {
                    "appname": "transmission",
                    "flavor": "vanilla",
                    "components": [
                      {
                        "name": "transmission",
                        "namespace": "dperson",
                        "imageLink": "transmission.png",
                        "tag": "latest",
                        "repo": {
                          "user": "dperson",
                          "name": "transmission",
                          "namespace": "dperson",
                          "repository_type": "image",
                          "status": 1,
                          "description": "",
                          "is_private": false,
                          "is_automated": true,
                          "can_edit": false,
                          "star_count": 84,
                          "pull_count": 250885,
                          "last_updated": "2017-06-13T13:16:25.955216Z",
                          "build_on_cloud": null,
                          "has_starred": false,
                          "full_description": "[![logo](https://raw.githubusercontent.com/dperson/transmission/master/logo.png)](https://www.transmissionbt.com/)\n\n# Transmission\n\nTransmission docker container\n\n# What is Transmission?\n\nTransmission is a BitTorrent client which features a simple interface on top of\na cross-platform back-end.\n\n# How to use this image\n\nThis Transmission container was built to automatically download a level1 host\nfilter (can be used with dperson/openvpn).\n\n    sudo docker run -it --cap-add=NET_ADMIN --device /dev/net/tun --name vpn \\\n                --dns 8.8.4.4 --dns 8.8.8.8 --restart=always \\\n                -d dperson/openvpn-client ||\n    sudo docker run -it --name bit --net=container:vpn \\\n                -d dperson/transmission\n    sudo docker run -it --name web -p 80:80 -p 443:443 --link vpn:bit \\\n                -d dperson/nginx -w \"http://bit:9091/transmission;/transmission\"\n\n**NOTE**: The default username/password are `admin`/`admin`. See `TRUSER` and\n`TRGROUP` below, for how to change them.\n\n**NOTE2**: To connect to the transmission container, point your browser to the\nactual `<hostname_or_IP_address>` of the system running docker with a URI as\nbelow:\n\n    https://<hostname_or_IP_address>/transmission/web/\n\n**NOTE3**: To open the peer connection port add the following to the\n`docker run` command:\n\n    -p 51413:51413 -p 51413:51413/udp\n\n## Hosting a Transmission instance\n\n    sudo docker run -it --name transmission -p 9091:9091 -d dperson/transmission\n\nOR set local storage:\n\n    sudo docker run -it --name transmission -p 9091:9091 \\\n                -v /path/to/directory:/var/lib/transmission-daemon \\\n                -d dperson/transmission\n\n**NOTE**: The configuration is in `/var/lib/transmission-daemon/info`, downloads\nare in `/var/lib/transmission-daemon/downloads`, and partial downloads are in\n`/var/lib/transmission-daemon/incomplete`.\n\n## Configuration\n\n    sudo docker run -it --rm dperson/transmission -h\n\n    Usage: transmission.sh [-opt] [command]\n    Options (fields in '[]' are optional, '<>' are required):\n        -h          This help\n        -n          No auth config; don't configure authentication at runtime\n        -t \"\"       Configure timezone\n                    possible arg: \"[timezone]\" - zoneinfo timezone for container\n\n    The 'command' (if provided and valid) will be run instead of transmission\n\nENVIRONMENT VARIABLES (only available with `docker run`)\n\n * `TRUSER` - Set the username for transmission auth (default 'admin')\n * `TRPASSWD` - Set the password for transmission auth (default 'admin')\n * `TZ` - As above, configure the zoneinfo timezone, IE `EST5EDT`\n * `USERID` - Set the UID for the app user\n * `GROUPID` - Set the GID for the app user\n\nOther environment variables beginning with `TR_` will edit the configuration\nfile accordingly:\n\n * `TR_MAX_PEERS_GLOBAL=400` will translate to `\"max-peers-global\": 400,`\n\n## Examples\n\nAny of the commands can be run at creation with `docker run` or later with\n`docker exec -it transmission.sh` (as of version 1.3 of docker).\n\n### Setting the Timezone\n\n    sudo docker run -it --name transmission -d dperson/transmission -t EST5EDT\n\nOR using `environment variables`\n\n    sudo docker run -it --name transmission -e TZ=EST5EDT \\\n                -d dperson/transmission\n\nWill get you the same settings as\n\n    sudo docker run -it --name transmission -p 9091:9091 -d dperson/transmission\n    sudo docker exec -it transmission transmission.sh -t EST5EDT \\\n                ls -AlF /etc/localtime\n    sudo docker restart transmission\n\n# User Feedback\n\n## Issues\n\nIf you have any problems with or questions about this image, please contact me\nthrough a [GitHub issue](https://github.com/dperson/transmission/issues).",
                          "affiliation": null,
                          "permissions": {
                            "read": true,
                            "write": false,
                            "admin": false
                          }
                        },
                        "overlay": true,
                        "config": {
                          "HostConfig": {
                            "Binds": [
                              "/var/lib/transmission-daemon:/var/lib/transmission-daemon"
                            ],
                            "RestartPolicy": {
                              "Name": "unless-stopped"
                            },
                            "PortBindings": {
                              "9091/tcp": [
                                {
                                  "HostPort": "9091"
                                }
                              ]
                            },
                            "PublishAllPorts": false
                          }
                        },
                        "volumes": []
                      }
                    ],
                    "key": "dockerhub:dperson:transmission:latest:vanilla"
                  },
                  {
                    "appname": "calibre",
                    "flavor": "vanilla",
                    "components": [
                      {
                        "name": "docker-rdp-calibre",
                        "namespace": "aptalca",
                        "imageLink": "calibre.png",
                        "tag": "latest",
                        "repo": {
                          "user": "aptalca",
                          "name": "docker-rdp-calibre",
                          "namespace": "aptalca",
                          "repository_type": null,
                          "status": 1,
                          "description": "Full Calibre GUI and webserver accessible in a web browser",
                          "is_private": false,
                          "is_automated": true,
                          "can_edit": false,
                          "star_count": 25,
                          "pull_count": 362602,
                          "last_updated": "2016-09-17T04:04:03.474094Z",
                          "build_on_cloud": null,
                          "has_starred": false,
                          "full_description": "# Calibre GUI and Server\n\nRun the Calibre X app accessible in a web browser\n\n## Install On unRaid:\n\nOn unRaid, install from the Community Repositories and enter the app folder location and the port for the webUI.\n\n\n## Install On Other Platforms (like Ubuntu, Synology 5.2 DSM, etc.):\n\nOn other platforms, you can run this docker with the following command:\n\n```\ndocker run -d --name=\"RDP-Calibre\" -e EDGE=\"0\" -e WIDTH=\"1280\" -e HEIGHT=\"720\" -v /path/to/config:/config:rw -v /etc/localtime:/etc/localtime:ro -p XXXX:8080 -p YYYY:8081 aptalca/docker-rdp-calibre\n```\n\n### Setup Instructions\n- Replace the variable \"/path/to/config\" with your choice of folder on your system. That is where the config and the library files will reside, and they will survive an update, reinstallation, etc. of the container.\n- Change \"XXXX\" to a port of your choice, it will be the port for the main Calibre GUI\n- Change \"YYYY\" to a port of your choice, it will be the port for the Calibre webserver\n- If you would like to have the latest updates, change the EDGE variable to \"1\", and the container will update calibre to the latest version every time it is restarted\n- If you'd like to change the resolution for the GUI, you can modify the WIDTH and HEIGHT variables\n- IMPORTANT: On first start, select \"/config\" as the library location in the Calibre wizard\n\nYou can access the GUI by pointing your web browser to http://SERVERIP:XXXX/#/client/c/Calibre\n\nYou can access the Calibre webserver by pointing your web browser to http://SERVERIP:YYYY\n\n(Replace SERVERIP, XXXX and YYYY with your values)\n\n### Advanced Features (only for docker pros)\n#### Custom library location:\nIf you would like to change the library location you need to do a couple of things:\n- First add a new mount point for the library location in the docker run command. Example: -v /path/to/library:/library:rw\n- Then add an environment variable (LIBRARYINTERNALPATH) to specify the internal library location for the webserver. Example: -e LIBRARYINTERNALPATH=\"/library\"\n- When you fire up calibre the first time select your library location. Example: /library  \n\n#### Url Prefix for reverse proxy:\n- Add an environment variable (URLPREFIX) to docker run to specify the url prefix for the webserver. Example: -e URLPREFIX=\"/calibre\"\n- To access the webserver, go to http://SERVERIP:YYYY/calibre\n\n### Changelog:\n- 2016-09-16 - Remove X1-lock if exists, which prevents start up following an unclean shutdown\n- 2016-09-15 - Updated base to x11rdp1.3, which now supports clipboard through the left hand side menu (ctrl+alt+shift) - calibre updated to 2.67\n",
                          "affiliation": null,
                          "permissions": {
                            "read": true,
                            "write": false,
                            "admin": false
                          }
                        },
                        "overlay": true,
                        "config": {
                          "HostConfig": {
                            "RestartPolicy": {
                              "Name": "unless-stopped"
                            },
                            "PublishAllPorts": true
                          }
                        },
                        "volumes": []
                      }
                    ],
                    "key": "dockerhub:aptalca:docker-rdp-calibre:latest:vanilla"
                  },
                  {
                    "appname": "apache",
                    "flavor": "vanilla",
                    "components": [
                      {
                        "name": "httpd",
                        "namespace": "library",
                        "imageLink": "apache.png",
                        "tag": "latest",
                        "repo": {
                          "user": "library",
                          "name": "httpd",
                          "namespace": "library",
                          "repository_type": "image",
                          "status": 1,
                          "description": "The Apache HTTP Server Project",
                          "is_private": false,
                          "is_automated": false,
                          "can_edit": false,
                          "star_count": 1109,
                          "pull_count": 42550447,
                          "last_updated": "2017-06-01T16:58:24.058162Z",
                          "build_on_cloud": null,
                          "has_starred": false,
                          "full_description": "# Supported tags and respective `Dockerfile` links\n\n-\t[`2.2.32`, `2.2` (*2.2/Dockerfile*)](https://github.com/docker-library/httpd/blob/3e9afb8de1eca87f72b63d767a99ef807829944f/2.2/Dockerfile)\n-\t[`2.2.32-alpine`, `2.2-alpine` (*2.2/alpine/Dockerfile*)](https://github.com/docker-library/httpd/blob/3e9afb8de1eca87f72b63d767a99ef807829944f/2.2/alpine/Dockerfile)\n-\t[`2.4.25`, `2.4`, `2`, `latest` (*2.4/Dockerfile*)](https://github.com/docker-library/httpd/blob/3e9afb8de1eca87f72b63d767a99ef807829944f/2.4/Dockerfile)\n-\t[`2.4.25-alpine`, `2.4-alpine`, `2-alpine`, `alpine` (*2.4/alpine/Dockerfile*)](https://github.com/docker-library/httpd/blob/3e9afb8de1eca87f72b63d767a99ef807829944f/2.4/alpine/Dockerfile)\n\n# Quick reference\n\n-\t**Where to get help**:  \n\t[the Docker Community Forums](https://forums.docker.com/), [the Docker Community Slack](https://blog.docker.com/2016/11/introducing-docker-community-directory-docker-community-slack/), or [Stack Overflow](https://stackoverflow.com/search?tab=newest&q=docker)\n\n-\t**Where to file issues**:  \n\t[https://github.com/docker-library/httpd/issues](https://github.com/docker-library/httpd/issues)\n\n-\t**Maintained by**:  \n\t[the Docker Community](https://github.com/docker-library/httpd)\n\n-\t**Published image artifact details**:  \n\t[repo-info repo's `repos/httpd/` directory](https://github.com/docker-library/repo-info/blob/master/repos/httpd) ([history](https://github.com/docker-library/repo-info/commits/master/repos/httpd))  \n\t(image metadata, transfer size, etc)\n\n-\t**Image updates**:  \n\t[official-images PRs with label `library/httpd`](https://github.com/docker-library/official-images/pulls?q=label%3Alibrary%2Fhttpd)  \n\t[official-images repo's `library/httpd` file](https://github.com/docker-library/official-images/blob/master/library/httpd) ([history](https://github.com/docker-library/official-images/commits/master/library/httpd))\n\n-\t**Source of this description**:  \n\t[docs repo's `httpd/` directory](https://github.com/docker-library/docs/tree/master/httpd) ([history](https://github.com/docker-library/docs/commits/master/httpd))\n\n-\t**Supported Docker versions**:  \n\t[the latest release](https://github.com/docker/docker/releases/latest) (down to 1.6 on a best-effort basis)\n\n# What is httpd?\n\nThe Apache HTTP Server, colloquially called Apache, is a Web server application notable for playing a key role in the initial growth of the World Wide Web. Originally based on the NCSA HTTPd server, development of Apache began in early 1995 after work on the NCSA code stalled. Apache quickly overtook NCSA HTTPd as the dominant HTTP server, and has remained the most popular HTTP server in use since April 1996.\n\n> [wikipedia.org/wiki/Apache_HTTP_Server](http://en.wikipedia.org/wiki/Apache_HTTP_Server)\n\n![logo](https://raw.githubusercontent.com/docker-library/docs/8e367edd887f5fe876890a0ab4d08806527a1571/httpd/logo.png)\n\n# How to use this image.\n\nThis image only contains Apache httpd with the defaults from upstream. There is no PHP installed, but it should not be hard to extend. On the other hand, if you just want PHP with Apache httpd see the [PHP image](https://registry.hub.docker.com/_/php/) and look at the `-apache` tags. If you want to run a simple HTML server, add a simple Dockerfile to your project where `public-html/` is the directory containing all your HTML.\n\n### Create a `Dockerfile` in your project\n\n```dockerfile\nFROM httpd:2.4\nCOPY ./public-html/ /usr/local/apache2/htdocs/\n```\n\nThen, run the commands to build and run the Docker image:\n\n```console\n$ docker build -t my-apache2 .\n$ docker run -dit --name my-running-app my-apache2\n```\n\n### Without a `Dockerfile`\n\nIf you don't want to include a `Dockerfile` in your project, it is sufficient to do the following:\n\n```console\n$ docker run -dit --name my-apache-app -v \"$PWD\":/usr/local/apache2/htdocs/ httpd:2.4\n```\n\n### Configuration\n\nTo customize the configuration of the httpd server, just `COPY` your custom configuration in as `/usr/local/apache2/conf/httpd.conf`.\n\n```dockerfile\nFROM httpd:2.4\nCOPY ./my-httpd.conf /usr/local/apache2/conf/httpd.conf\n```\n\n#### SSL/HTTPS\n\nIf you want to run your web traffic over SSL, the simplest setup is to `COPY` or mount (`-v`) your `server.crt` and `server.key` into `/usr/local/apache2/conf/` and then customize the `/usr/local/apache2/conf/httpd.conf` by removing the comment from the line with `#Include conf/extra/httpd-ssl.conf`. This config file will use the certificate files previously added and tell the daemon to also listen on port 443. Be sure to also add something like `-p 443:443` to your `docker run` to forward the https port.\n\nThe previous steps should work well for development, but we recommend customizing your conf files for production, see [httpd.apache.org](https://httpd.apache.org/docs/2.2/ssl/ssl_faq.html) for more information about SSL setup.\n\n# Image Variants\n\nThe `httpd` images come in many flavors, each designed for a specific use case.\n\n## `httpd:<version>`\n\nThis is the defacto image. If you are unsure about what your needs are, you probably want to use this one. It is designed to be used both as a throw away container (mount your source code and start the container to start your app), as well as the base to build other images off of.\n\n## `httpd:alpine`\n\nThis image is based on the popular [Alpine Linux project](http://alpinelinux.org), available in [the `alpine` official image](https://hub.docker.com/_/alpine). Alpine Linux is much smaller than most distribution base images (~5MB), and thus leads to much slimmer images in general.\n\nThis variant is highly recommended when final image size being as small as possible is desired. The main caveat to note is that it does use [musl libc](http://www.musl-libc.org) instead of [glibc and friends](http://www.etalabs.net/compare_libcs.html), so certain software might run into issues depending on the depth of their libc requirements. However, most software doesn't have an issue with this, so this variant is usually a very safe choice. See [this Hacker News comment thread](https://news.ycombinator.com/item?id=10782897) for more discussion of the issues that might arise and some pro/con comparisons of using Alpine-based images.\n\nTo minimize image size, it's uncommon for additional related tools (such as `git` or `bash`) to be included in Alpine-based images. Using this image as a base, add the things you need in your own Dockerfile (see the [`alpine` image description](https://hub.docker.com/_/alpine/) for examples of how to install packages if you are unfamiliar).\n\n# License\n\nView [license information](https://www.apache.org/licenses/) for the software contained in this image.",
                          "affiliation": null,
                          "permissions": {
                            "read": true,
                            "write": false,
                            "admin": false
                          }
                        },
                        "overlay": true,
                        "config": {
                          "HostConfig": {
                            "RestartPolicy": {
                              "Name": "unless-stopped"
                            },
                            "PublishAllPorts": true
                          }
                        },
                        "volumes": []
                      }
                    ],
                    "key": "dockerhub:library:httpd:latest:vanilla"
                  },
                  {
                    "appname": "busybox",
                    "flavor": "vanilla",
                    "components": [
                      {
                        "name": "busybox",
                        "namespace": "library",
                        "imageLink": "busybox.png",
                        "tag": "latest",
                        "repo": {
                          "user": "library",
                          "name": "busybox",
                          "namespace": "library",
                          "repository_type": "image",
                          "status": 1,
                          "description": "Busybox base image.",
                          "is_private": false,
                          "is_automated": false,
                          "can_edit": false,
                          "star_count": 1033,
                          "pull_count": 256330393,
                          "last_updated": "2017-05-15T22:30:17.207691Z",
                          "build_on_cloud": null,
                          "has_starred": false,
                          "full_description": "# Supported tags and respective `Dockerfile` links\n\n-\t[`1.26.2-glibc`, `1.26-glibc`, `1-glibc`, `glibc` (*glibc/Dockerfile*)](https://github.com/docker-library/busybox/blob/de3cbcb2cd371e55119e460c03bf73b8abbbd064/glibc/Dockerfile)\n-\t[`1.26.2-musl`, `1.26-musl`, `1-musl`, `musl` (*musl/Dockerfile*)](https://github.com/docker-library/busybox/blob/de3cbcb2cd371e55119e460c03bf73b8abbbd064/musl/Dockerfile)\n-\t[`1.26.2-uclibc`, `1.26-uclibc`, `1-uclibc`, `uclibc`, `1.26.2`, `1.26`, `1`, `latest` (*uclibc/Dockerfile*)](https://github.com/docker-library/busybox/blob/de3cbcb2cd371e55119e460c03bf73b8abbbd064/uclibc/Dockerfile)\n\n# Quick reference\n\n-\t**Where to get help**:  \n\t[the Docker Community Forums](https://forums.docker.com/), [the Docker Community Slack](https://blog.docker.com/2016/11/introducing-docker-community-directory-docker-community-slack/), or [Stack Overflow](https://stackoverflow.com/search?tab=newest&q=docker)\n\n-\t**Where to file issues**:  \n\t[https://github.com/docker-library/busybox/issues](https://github.com/docker-library/busybox/issues)\n\n-\t**Maintained by**:  \n\t[the Docker Community](https://github.com/docker-library/busybox)\n\n-\t**Published image artifact details**:  \n\t[repo-info repo's `repos/busybox/` directory](https://github.com/docker-library/repo-info/blob/master/repos/busybox) ([history](https://github.com/docker-library/repo-info/commits/master/repos/busybox))  \n\t(image metadata, transfer size, etc)\n\n-\t**Image updates**:  \n\t[official-images PRs with label `library/busybox`](https://github.com/docker-library/official-images/pulls?q=label%3Alibrary%2Fbusybox)  \n\t[official-images repo's `library/busybox` file](https://github.com/docker-library/official-images/blob/master/library/busybox) ([history](https://github.com/docker-library/official-images/commits/master/library/busybox))\n\n-\t**Source of this description**:  \n\t[docs repo's `busybox/` directory](https://github.com/docker-library/docs/tree/master/busybox) ([history](https://github.com/docker-library/docs/commits/master/busybox))\n\n-\t**Supported Docker versions**:  \n\t[the latest release](https://github.com/docker/docker/releases/latest) (down to 1.6 on a best-effort basis)\n\n# What is BusyBox? The Swiss Army Knife of Embedded Linux\n\nComing in somewhere between 1 and 5 Mb in on-disk size (depending on the variant), [BusyBox](http://www.busybox.net/) is a very good ingredient to craft space-efficient distributions.\n\nBusyBox combines tiny versions of many common UNIX utilities into a single small executable. It provides replacements for most of the utilities you usually find in GNU fileutils, shellutils, etc. The utilities in BusyBox generally have fewer options than their full-featured GNU cousins; however, the options that are included provide the expected functionality and behave very much like their GNU counterparts. BusyBox provides a fairly complete environment for any small or embedded system.\n\n> [wikipedia.org/wiki/BusyBox](https://en.wikipedia.org/wiki/BusyBox)\n\n![logo](https://raw.githubusercontent.com/docker-library/docs/cc5d5e47fd7e0c57c9b8de4c1bfb6258e0dac85d/busybox/logo.png)\n\n# How to use this image\n\n## Run BusyBox shell\n\n```console\n$ docker run -it --rm busybox\n```\n\nThis will drop you into an `sh` shell to allow you to do what you want inside a BusyBox system.\n\n## Create a `Dockerfile` for a binary\n\n```dockerfile\nFROM busybox\nCOPY ./my-static-binary /my-static-binary\nCMD [\"/my-static-binary\"]\n```\n\nThis `Dockerfile` will allow you to create a minimal image for your statically compiled binary. You will have to compile the binary in some other place like another container. For a simpler alternative that's similarly tiny but easier to extend, [see `alpine`](https://hub.docker.com/_/alpine/).\n\n# Image Variants\n\nThe `busybox` images contain BusyBox built against various \"libc\" variants (for a comparison of \"libc\" variants, [Eta Labs has a very nice chart](http://www.etalabs.net/compare_libcs.html) which lists many similarities and differences).\n\nFor more information about the specific particulars of the build process for each variant, see `Dockerfile.builder` in the same directory as each variant's `Dockerfile` (see links above).\n\n## `busybox:glibc`\n\n-\t[glibc from Debian](https://packages.debian.org/search?searchon=names&exact=1&suite=all&section=all&keywords=libc6) (which is then included in the image)\n\n## `busybox:musl`\n\n-\t[musl from Alpine](https://pkgs.alpinelinux.org/packages?name=musl) (statically compiled)\n\n## `busybox:uclibc`\n\n-\t[uClibc](https://uclibc.org) via [Buildroot](https://buildroot.org) (statically compiled)\n\n# License\n\nView [license information](http://www.busybox.net/license.html) for the software contained in this image.",
                          "affiliation": null,
                          "permissions": {
                            "read": true,
                            "write": false,
                            "admin": false
                          }
                        },
                        "overlay": true,
                        "config": {},
                        "volumes": []
                      }
                    ],
                    "key": "dockerhub:library:busybox:latest:vanilla"
                  }
                ]
              },
              "tasks": [
                {
                  "type": "appInstall",
                  "id": "dockerhub:library:busybox:latest:vanilla",
                  "status": "started",
                  "errno": 0,
                  "message": null,
                  "uuid": "02bda726-c01f-46ee-8862-abc0eaae50af",
                  "recipe": {
                    "appname": "busybox",
                    "flavor": "vanilla",
                    "components": [
                      {
                        "name": "busybox",
                        "namespace": "library",
                        "imageLink": "busybox.png",
                        "tag": "latest",
                        "repo": null,
                        "overlay": true,
                        "config": {},
                        "volumes": []
                      }
                    ]
                  },
                  "jobs": [
                    {
                      "image": {
                        "type": "imageCreate",
                        "id": "library/busybox:latest",
                        "status": "started",
                        "errno": 0,
                        "message": null
                      },
                      "container": null
                    }
                  ]
                }
              ]
            }


### Docker [POST]

Use for **appstore**, it can download a new specified docker image into appstore or remove a specified docker image which stored in appstore.

+ Request install

  + Header

            Accept: application/json

  + Body

    + Attributes (installDocker)

+ Response 200

  + Header

            Accept: application/json

  + Body

            {}

+ Request uninstall

  + Header

            Accept: application/json

  + Body

    + Attributes (uninstallDocker)

+ Response 200

  + Header

            Accept: application/json

  + Body

            {}


## Appifi Own Status [/server/status]


### Only Get Appifi's Status [GET]

+ Request

    + Headers

            Accept: application/json

    + Body

            {}

+ Response 200

  + Header

            Accept: application/json

  + Body

            {
              "status": 8
            }