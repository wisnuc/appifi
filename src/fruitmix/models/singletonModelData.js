
// import { storeDispatch } from '../../reducers'
import { createModelDataAsync } from './modelData'

let modelData = null;

(async () => {
	// mfilepath, ufilepath, dfilepath, tmpfolder
	modelData = await createModelDataAsync('','','','');
})();

export default modelData
