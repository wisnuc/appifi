
/** app definition in javascript, easier to be maintained than json **/
/*
export default [
  {
    name: 'library/httpd',
    alias: 'apache',
    image: 'apache.png'
  },
  {
    name: 'library/solr',
    alias: 'solr',
    image: 'solr.png'
  },
  {
    name: 'library/owncloud',
    alias: 'owncloud',
    image: 'owncloud.png'
  },
  {
    name: 'library/redis',
    alias: 'redis',
    image: 'redis.png'
  },
  {
    name: 'dperson/transmission',
    alias: 'transmission',
    image: 'transmission.png'
  },
  {
    name: 'library/postgres',
    alias: 'postgres',
    image: 'postgresql.png'
  },
  {
    name: 'library/wordpress',
    alias: 'wordpress',
    image: 'wordpress.png'
  }
]
*/

export default [
  {
    appname: 'busybox',
    components: [
      {
        name: 'busybox',
        namespace: 'library',
        imageLink: 'busybox.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {},
        volumes: []
      }
    ]
  },
  {
    appname: 'ownCloud',
    components: [
      {
        name: 'owncloud',
        namespace: 'library',
        imageLink: 'owncloud.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          } 
        },
        volumes: []
      } 
    ]
  },
  {
    appname: 'calibre',
    components: [
      {
        name: 'docker-rdp-calibre',
        namespace: 'aptalca',
        imageLink: 'calibre.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          }
        },
        volumes: []
      }
    ]
  },
  {
    appname: 'elasticsearch',
    components: [
      {
        name: 'elasticsearch',
        namespace: 'library',
        imageLink: 'elasticsearch.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          }
        },
        volumes: []
      }
    ]
  }, 
  {
    appname: 'apache',
    components: [
      {
        name: 'httpd',
        namespace: 'library',
        imageLink: 'apache.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          }
        },
        volumes: [] 
      }
    ]
  },
  {
    appname: 'solr',
    components: [
      {
        name: 'solr',
        namespace: 'library',
        imageLink: 'solr.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          },
        },
        volumes: []
      }
    ]   
  },
  {
    appname: 'redis',
    components: [
      {
        name: 'redis',
        namespace: 'library',
        imageLink: 'redis.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          }
        },
        volumes: []
      }
    ]
  },
  {
    appname: 'transmission',
    components: [
      {
        name: 'transmission',
        namespace: 'dperson',
        imageLink: 'transmission.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          }
        },
        volumes: []
      }
    ]
  },
  {
    appname: 'postgres',
    components: [
      {
        name: 'postgres',
        namespace: 'library',
        imageLink: 'postgresql.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          }
        },
        volumes: []
      }
    ]
  },
  {
    appname: 'wordpress',
    components: [
      {
        name: 'wordpress',
        namespace: 'library',
        imageLink: 'wordpress.png',
        tag: 'latest',
        repo: null,
        overlay: true,
        config: {
          HostConfig: {
            RestartPolicy: {
              Name: 'unless-stopped'
            },
            PublishAllPorts: true
          }
        },
        volumes: []
      }
    ]
  },
]
































