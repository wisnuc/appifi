const toLines = (output) => { 
  return output.toString().split(/\n/).filter(l => l.length).map(l => l.trim())
}

export { toLines }

