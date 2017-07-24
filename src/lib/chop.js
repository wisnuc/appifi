const SIZE_1G = 1024

const chop = number => {

  let arr = []
  for (; number > SIZE_1G; number -= SIZE_1G) {
    let start = arr.length === 0 ? 0 : arr[arr.length - 1].end
    arr.push({ start, end: start + SIZE_1G })
  }

  let start = arr.length === 0 ? 0 : arr[arr.length - 1].end
  arr.push({ start, end: start + number})

  return arr
}

module.exports = chop

