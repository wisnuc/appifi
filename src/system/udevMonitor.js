import child from 'child_process'
import readline from 'readline'

const spawn = child.spawn('stdbuf', ['-oL', 'udevadm', 'monitor',  '--udev'])

spawn.stdout.on('data', data => console.log(data.toString()))
spawn.stderr.on('data', data => console.log(data.toString()))

spawn.on('close', () => console.log('spawn closed'))

console.log(spawn.pid)

