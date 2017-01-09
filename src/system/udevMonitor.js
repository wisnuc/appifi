import child from 'child_process'
import EventEmitter from 'events'
import readline from 'readline'
import { refreshStorage } from './storage'

class UdevMonitor extends EventEmitter {

  constructor(rl) {

    super()

    this.rl = rl
    this.timer = -1
    this.queue = []

    rl.on('line', line => {

      let t = line.trim()
      if (!t.endsWith('(block)')) return
        
      let split = t.split(' ')
        .map(x => x.trim())
        .filter(x => !!x.length)

      if (split.length !== 5 || 
        split[0] !== 'UDEV' || 
        (split[2] !== 'add' && split[2] !== 'remove') || 
        split[4] !== '(block)')
        return

      let action = split[2]
      let blkpath = split[3]

      if (this.timer !== -1) 
        clearTimeout(this.timer)
        
      this.queue.push({action, blkpath})
      this.timer = setTimeout(() => {
        this.emit('events', this.queue)
        this.queue = []
        this.timer = -1
      }, 150)
    })

    rl.on('close', () => {
      console.log('unexpected close of udev monitor')
    })
  }
}

const createUdevMonitor = () => {

  const spawn = child.spawn('stdbuf', ['-oL', 'udevadm', 'monitor',  '--udev', '-s', 'block'])
  const rl = readline.createInterface({ input: spawn.stdout })

  return new UdevMonitor(rl)  
}

const udevmon = createUdevMonitor()

udevmon.on('events', events => {

  console.log('udev events', events)

  let add = false
  let remove = false
  
  events.forEach(evt => {
    if (evt.action === 'add') add = true
    if (evt.action === 'remove') remove = true    
  })

  if (add || remove)
    refreshStorage()
      .then(() => {})
      .catch(e => {
        console.log('udevmon, refreshStorage error >>>>')
        console.log(e)
        console.log('udevmon, refreshStorage error <<<<')
      })
})


