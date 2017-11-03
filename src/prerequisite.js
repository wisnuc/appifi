const fs = require('fs')
const child = require('child_process')
const rimraf = require('rimraf')

const installed = name => {
  try {
    let stdout = child.execSync(`dpkg -s ${name}`)
    let l = stdout.toString()
      .split('\n')
      .filter(l => l.length)
      .map(l => l.trim())
      .find(l => l.startsWith('Status:') && l.endsWith('installed'))
    return !!l
  } catch (e) {
    return false
  }
}

const opts = {
  stdio: ['ignore', process.stdout, process.stderr],
  timeout: 1000 * 120
}


const install = name => {
  for (let i = 0; i < 3; i ++) {    
    try {
      child.execSync(`apt-get -y install ${name}`, opts) 
    } catch (e) {
      console.log(e.message)

      if (i === 2) {
        console.log('installation failed 3 times', e.message)
        throw e
      } else {
        console.log('installation failed, wait 1 sec to retry')
        child.execSync('sleep 1')
      }
    }
  }
}

const names = [
  'libimage-exiftool-perl', 
]

const packages = names.map(name => ({
  name,
  status: installed(name) ? 'installed' : 'not-installed'
}))

const pre = {
  packages,
  message: 'ok',
  error: null
}

module.exports = pre

if (packages.every(pac => pac.status === 'installed')) return

const unlock = () => rimraf.sync('/var/lib/apt/lists/lock')

for (let i = 0; i < 3; i ++) {
  try {
    unlock()
    child.execSync('apt-get -y update', opts)
    break
  } catch (e) {
    console.log(e.message)
  
    if (i === 2) {
      pre.message = 'apt-get update failed for 3 times'
      pre.code = 'EAPTUPDATE'
      pre.error = e
      return
    } else {
      console.log('update failed, wait 1 sec to retry')
      child.execSync('sleep 1') 
    }
  }
}

let missing = packages.filter(pac => pac.status === 'not-installed')

for (let i = 0; i < missing.length; i++) {
  try {
    unlock()
    install(missing[i].name)
    missing[i].status = 'installed'
  } catch (e) {
    missing[i].status = 'install-failed'
    pre.messsage = `failed to install package ${missing[i]}`
    pre.code = 'EINSTALLPACKAGE'
    pre.error = e
    return
  }
} 

console.log(pre)

