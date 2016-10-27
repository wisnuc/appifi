import udev from 'udev'

const ports = udev.list('ata_port')
const blocks = udev.list('block').filter(dev => !dev.DEVPATH.startsWith('/devices/virtual/'))
const usbblocks = udev.list().filter(dev => dev.SUBSYSTEM === 'block' && dev.ID_BUS === 'usb')

console.log(ports)
console.log(blocks)


