const parse = text => {
  if (text.startsWith('JPEG image data')) {
    return 'JPEG'
  } else if (text.startsWith('PNG image data')) {
    return 'PNG'
  } else if (text.startsWith('GIF image data')) {
    return 'GIF'
  } else if (text.startsWith('ISO Media, MPEG v4 system, 3GPP')) {
    return '3GP'
  } else if (text.startsWith('ISO Media, MP4 v2 [ISO 14496-14]')) {
    return 'MP4'
  } else if (text.startsWith('ISO Media, Apple QuickTime movie, Apple QuickTime (.MOV/QT)')) {
    return 'MOV'
  } else {
    return 
  }
}

module.exports = {
  parse,
  ver: 1
}
