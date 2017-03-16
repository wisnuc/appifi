import cluster from 'cluster'

import UUID from 'node-uuid'




let start = () => process.on('message', (msg)=> {
  let { id, data, err } = msg

  let jobIndex = jobs.findIndex(job => job.id === id)
 

  if(jobIndex !== -1){
    let job = jobs[jobIndex]
    jobs.splice(jobIndex, 1)
    return job.callback(err ? err : null, data)
  } 

  console.log('job not found ' + msg)
})


//jobs
let jobs = []

/**
 * job :{
 *  id,
 *  op,
 *  args,
 *  timestamp,
 *  callback
 * }
 */

let call = (type = 'command', op, args, callback) => {
  let job = {
    id: UUID.v4(),
    op,
    args,
    callback,
    timestamp: new Date().getTime()
  }
  jobs.push(job)

  let msg = { type, op, args, id: job.id } 
  process.send(msg)
}

export default { start, call }