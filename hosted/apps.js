
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
    flavor: 'vanilla',
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
































