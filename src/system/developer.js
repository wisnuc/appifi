const setting = {}

process.argv.forEach((val, index, array) => {

  if (val === '--no-fruitmix') setting.noFruitmix = true
  if (val === '--appstore-master') setting.appstoreMaster = true

})

module.exports = setting

