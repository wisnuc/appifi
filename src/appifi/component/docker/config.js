const dockerUrl = 'http://127.0.0.1:1688'

const dockerPidFile = '/home/wisnuc/git/appifi/run/wisnuc/app/docker.pid'

const modelJsonPath = ['path'].reduce((acc, c) => {
    Object.assign(acc, { [c] : argv(c) }), {}
  }
)

export {
  dockerUrl,
  dockerPidFile,
  modelJsonPath,
}


  // console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>')
  // console.log(mpath)
  // console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<')