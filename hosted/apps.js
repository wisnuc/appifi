
/** app definition in javascript, easier to be maintained than json **/
/*
export default [
  {
    name: 'library/busybox',
    alias: 'busybox',
    image: 'busybox.png'
  },
  {
    name: 'aptalca/docker-rdp-calibre',
    alias: 'calibre',
    image: 'calibre.png'
  },
  {
    name: 'library/elasticsearch',
    alias: 'elasticsearch',
    image: 'elasticsearch.png'
  },
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
    appname: 'owncloud',
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
  }
]

