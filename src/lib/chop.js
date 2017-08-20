const SIZE_1G = 1024 * 1024 * 1024

//
// !!! fs.read start and end are both INCLUSIVE !!!
//
module.exports = number => {
  if (!Number.isInteger(number) || number <= 0) throw new Error('number must be a positive integer')

  let arr = []
  while (number > SIZE_1G) {
    arr.push({
      start: arr.length * SIZE_1G,
      end: (arr.length + 1) * SIZE_1G - 1
    })
    number -= SIZE_1G
  }

  if (number !== 0) {
    arr.push({
      start: arr.length * SIZE_1G,
      end: arr.length * SIZE_1G + number - 1
    })
  }

  return arr
}
