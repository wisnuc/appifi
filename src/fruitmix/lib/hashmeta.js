
const hashMeta = async (fpath, uuid) => {

  let xstat = await readXstat(fpath)
  if (xstat.uuid !== uuid) 
}
