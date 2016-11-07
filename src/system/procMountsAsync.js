import { fs } from '../common/async'

export default async () => {

  let data = await fs.readFileAsync('/proc/mounts')
  let lines = data.toString().split(/\n/).filter(l => l.length)
  let all = lines.map(l => {
    let tmp = l.split(' ')
    return {
      device: tmp[0],
      mountpoint: tmp[1],
      fs_type: tmp[2],
      opts: tmp[3].split(',') 
    }
  })

  let filtered = all.filter(m => (m.device.startsWith('/dev/sd') || m.device.startsWith('/dev/mmc')))
  return filtered
}

