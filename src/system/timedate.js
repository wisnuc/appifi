import child from 'child_process'

export default (callback) => 
  child.exec('timedatectl', (err, stdout, stderr) => 
    err ? callback(err) : callback(null, stdout.toString().split('\n').filter(l => l.length)
      .reduce((prev, curr) => {
        let pair = curr.split(': ').map(str => str.trim())
        prev[pair[0]] = pair[1]
        return prev
      }, {})))

 

