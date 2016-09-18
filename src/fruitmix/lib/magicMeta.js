export default (magic) => {

  let meta = {}
  if (magic.startsWith('JPEG image data')) {

    meta.type = 'JPEG'

    let regex = /Exif Standard: \[(.*?)\], /i
    let exif = regex.exec(magic)
    let sliced = exif ? (magic.slice(0, exif.index) + magic.slice(exif.index + exif[0].length)) : null
    let datetime = null
    if (exif) {
      let arr = exif[1].split(',').map(i => i.trim())
      let dtStr = arr.find(l => /^datetime=\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(l))
      if (dtStr) datetime = dtStr.slice(9)
    }

    // remove exif bracket and split
    // let items = magic.replace(/\[.*\]/g, '').split(',').map(item => item.trim())
    let items = (exif ? sliced : magic).split(',').map(item => item.trim())

    // find width x height
    let x = items.find(item => /^\d+x\d+$/.test(item))
    if (!x) return null
  
    let y = x.split('x')
    meta.width = parseInt(y[0])
    meta.height = parseInt(y[1])
    meta.datetime = datetime ? datetime : null
    meta.extended = exif ? true : false

    return meta // type = JPEG, width, height, extended
  }
  return null
}


