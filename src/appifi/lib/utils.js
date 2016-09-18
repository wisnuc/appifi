
function toLines(output) { 
  return output.toString().split(/\n/).filter(l => l.length).map(l => l.trim())
}

async function delay(duration) {

  return  new Promise((resolve) => { // reject not used
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

export { toLines, delay }

