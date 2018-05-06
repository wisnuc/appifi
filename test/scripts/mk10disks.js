const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))

/**
This sequence of commands create 3 primary and 3 logical partitions on given disk.
*/
const fdiskCmds = [
  'o',    // create a new empty DOS partition table
  'n',    // add a new partition
  'p',    // primary
  '1',    // number 1
  '',     // first sector
  '+1G',  // last sector 
  'n',    // add a new partition
  'p',    // primary
  '2',    // number 2
  '',     // first sector
  '+1G',  // last sector
  'n',    // add a new partition
  'p',    // primary
  '3',    // number 3
  '',     // first sector
  '+1G',  // last sector
  'n',    // add a new partition
  'e',    // extended
  '4',    // number 4
  '',     // first sector
  '',     // last sector
  'n',    // new logic partition
  '',     // first sector
  '+1G',  // last sector
  'n',    // new logic partition
  '',     // first sector
  '+1G',  // last sector
  'n',    // new logic partition
  '',     // first sector
  '',     // last sector
  'w'     // final write
]

const UUIDBC = 'ea774718-30db-41fd-b64f-4dec14bc935d'
const UUIDDE = '73defbe1-00d3-4891-9377-5de6689fc179'
const UUIDF = 'a840b693-018b-4080-8aca-9abe40b85f24'
const UUIDG = 'f7997c56-547b-4fd3-b738-d244845d8907'
const UUIDH = '0a78bbec-5cf5-4f6c-b72d-022c76f6c782'

const fdisk = (devname, callback) => {
  let fd = child.spawn('fdisk',  [devname])
  fd.stdout.pipe(process.stdout)
  fd.stdin.write(fdiskCmds.join('\n'))
  fd.stdin.end()
  fd.on('exit', (code, signal) => (code || signal) 
    ? callback(new Error(`fdisk error, code ${code}, signal ${signal}`))
    : callback())
}

const fdiskAsync = Promise.promisify(fdisk)

const main = async () => {

  let s = 'bcdefghijk'
  for (let i = 0; i < s.length; i++) await child.execAsync(`wipefs -a /dev/sd${s.charAt(i)}`)

  // create btrfs volume on sdb + sdc, raid1
  await child.execAsync(`mkfs.btrfs -d raid1 /dev/sdb /dev/sdc -U ${UUIDBC}`)

  // create btrfs volume on sdd + sde, single
  await child.execAsync(`mkfs.btrfs -d raid1 /dev/sdd /dev/sde -U ${UUIDDE}`)

  // create btrfs volume on sdf, single
  await child.execAsync(`mkfs.btrfs /dev/sdf -U ${UUIDF}`)

  // create btrfs volume on sdg + sdk, raid1, then erase sdk
  await child.execAsync(`mkfs.btrfs -d raid1 /dev/sdg /dev/sdk -U ${UUIDG}`) 
  await child.execAsync('wipefs -a /dev/sdk')

  // create btrfs volume on sdh + sdk, single, then erase sdk
  await child.execAsync(`mkfs.btrfs -d single /dev/sdh /dev/sdk -U ${UUIDH}`)
  await child.execAsync('wipefs -a /dev/sdk')

  await fdiskAsync('/dev/sdi') 
  await child.execAsync('mkfs.ext4 /dev/sdi1')
  await child.execAsync('mkfs.ext4 /dev/sdi5')
  await child.execAsync('mkfs.ntfs /dev/sdi2')
  await child.execAsync('mkfs.ntfs /dev/sdi6')
  await child.execAsync('mkfs.vfat /dev/sdi3')
  await child.execAsync('mkfs.vfat /dev/sdi7')

  await fdiskAsync('/dev/sdj')
  await child.execAsync('mkfs.xfs -f /dev/sdj1')
  await child.execAsync('mkfs.xfs -f /dev/sdj5')
  await child.execAsync('mkswap /dev/sdj2')
  await child.execAsync('mkswap /dev/sdj6')
 
}

main().then(() => console.log('done')).catch(e => console.log(e))





