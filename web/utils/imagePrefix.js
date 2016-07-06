import { configState } from './storeState'

const imagePrefix = (imagePath) => {

  let url
  if (configState() && configState().appstoreMaster) {
    url = 'https://raw.githubusercontent.com/wisnuc/appifi-recipes/master' + imagePath
  }
  else 
    url = 'https://raw.githubusercontent.com/wisnuc/appifi-recipes/release' + imagePath
  
  console.log(url)
  return url
}

export default imagePrefix

