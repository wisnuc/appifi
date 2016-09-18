import path from 'path'

import Promise from 'bluebird'
import clone from 'clone'
import bcrypt from 'bcryptjs'
import jwt from 'jwt-simple'

import paths from '../lib/paths'
import models from '../models/models'
import { createUserModelAsync } from '../models/userModel'
import { createDriveModelAsync } from '../models/driveModel'

import { mkdirpAsync, rimrafAsync, fs } from './async'

import { secret } from '../config/passportJwt'


/** UUIDs **/
const aliceUUID   = "5da92303-33a1-4f79-8d8f-a7b6becde6c3"
const aliceHome   = "b9aa7c34-8b86-4306-9042-396cf8fa1a9c"
const aliceLib    = "f97f9e1f-848b-4ed4-bd47-1ddfa82b2777"

const bobUUID     = "e5f23cb9-1852-475d-937d-162d2554e22c"
const bobHome     = "ed1d9638-8130-4077-9ed8-05be641a9ab4"
const bobLib      = "c18aa308-ab32-4e2d-bc34-0c6385711b55"

const charlieUUID = "1f4faecf-1bb5-4ff1-ab41-bd44a0cd0809"
const charlieHome = "6bd8cbad-3c7d-4a32-831b-0fadf3c8ef53"
const charlieLib  = "1ec6533f-fab8-4fad-8e76-adc76f80aa2f"

const davidUUID   = "3908afee-0818-4a3e-b327-76c2578ecb80"
const davidHome   = "5292b85f-f15c-470d-845b-6d80d5caf79c"
const davidLib    =  "d3932743-7587-4c91-a3bd-776846f14f6b"

const emilyUUID   = "831b5cc9-6a14-4a4f-b1b6-666c5b282783"
const emilyHome   = "4d807647-0feb-4692-aea4-4eaf26232916"
const emilyLib    = "4a8bf8dc-1467-4429-91e5-ef635055368c"

const frankUUID   = "9d4873e2-c0b7-4541-b535-87d5fd637f70"
const frankHome   = "93858ec9-57ef-45cb-8201-8aa1fc57ad40"
const frankLib    = "4cba25be-b1d4-4aed-8085-827bb2a07d3a"

const georgeUUID  = "278a60cf-2ba3-4eab-8641-e9a837c12950"
const georgeHome  = "bc097836-b056-46ef-862c-e0423e440b4c"
const georgeLib   = "a9c4e86d-f20c-4002-b8c8-a824f911ae29"

const henryUUID   = "04f91652-bd23-421b-854a-81b466c084bc"
const henryHome   = "c9f1d82e-5d88-46d7-ad43-24d51b1b6628"
const henryLib    = "e6f93d0a-144e-41fe-9afa-a03e1cccad8f"

const ianUUID     = "bc53b2f7-045b-4e86-91b9-9b5731489a13"
const ianHome     = "ec374b5a-490c-47ea-9a33-cb9ae1103b3b"
const ianLib      = "b8ff0e08-0acb-4013-8129-a4d913e79339"

const janeUUID    = "c190c542-c57c-47ea-96ab-643e95be23c6"
const janeHome    = "574c0a58-09d9-4e0f-a22f-0a30b38b6255"
const janeLib     = "d7dcaa59-217d-401d-a264-9e9148236792"

const kateUUID    = "f3b846d3-ab25-42bf-9c2f-caa7b339902c"
const kateHome    = "857689e7-ebe1-4c74-9c42-6bdcaf46071e"
const kateLib     = "85c4c3dd-04ca-4508-85db-8e19d20d6dbe"

const leoUUID     = "6e702f92-6073-4c11-a406-0a4776212d14"
const leoHome     = "6f300568-3faa-41c3-870e-fcbbe923343d"
const leoLib      = "ff5d42b9-4b8f-452d-a102-ebfde5cdf948"

const maryUUID    = "2a55e63e-10d2-4b45-aa44-524ee1e5e5da"
const maryHome    = "4dcb5c31-7500-4188-8602-b876a2c91b29"
const maryLib     = "ad3c1ce8-ef19-48e3-bbfa-3d6b275276f3"

const nicoleUUID  = "4ba43b18-326a-4011-90ce-ec78afca9c43"
const nicoleHome  = "6790cdcb-8bce-4c67-9768-202a90aad8bf"
const nicoleLib   = "8359f954-ade1-43e1-918e-8ca9d2dc81a0"

const oliviaUUID  = "ff490ac4-138a-4491-9c23-b021fa403a8e"
const oliviaHome  = "4a1ecce8-00af-4726-b0e7-03412a12a2b0"
const oliviaLib   = "97e352f8-5535-473d-9dac-8706ffb79abb"

const peterUUID   = "adde641e-2ab0-4d73-895f-78844d30cd97"
const peterHome   = "2e770755-3ff7-4e10-b79b-9cd0337f940f"
const peterLib    = "5e5393ca-0bd3-4f39-83d3-b0518340f292"

const quinnUUID   = "76121355-8a44-4739-b1f6-3f6dcdbe4ae3"
const quinnHome   = "592ae12f-b997-4a7d-ada7-50c9e53a0465"
const quinnLib    = "75b5dac2-591a-4c63-8e5e-a955ce51b576"

const robbieUUID  = "d5c9bb7b-6558-42ee-87da-a7c32abf2907"
const robbieHome  = "a474d150-a7d4-47f2-8338-3733fa4b8783"
const robbieLib   = "cd14ff07-c35f-48f0-81be-5b8fcaad38b2"

const sophieUUID  = "ccadabf0-1af4-41a5-8028-8e3dfe09e94e"
const sophieHome  = "cc1daf1c-adcb-45ea-a09d-6ec51b1e037e"
const sophieLib   = "b8106597-7ad7-4913-92fe-86757f9d5e0d"

const tomUUID     = "2648a820-6f84-4c29-a989-a6f0dd3e75e1"
const tomHome     = "1a72fc51-668a-4740-807f-ca625592dfa2"
const tomLib      = "8d2dfcfa-5dcc-4683-80f0-3d4020615143"

const ulyssesUUID = "69790809-251d-42bf-a1ab-182aa730a640"
const ulyssesHome = "dbe8957e-c0cc-451d-abd4-6d0b7a276a21"
const ulyssesLib  = "e6d8729b-a120-4658-a91c-c53a16b5517f"

const vincentUUID = "d22fc1ea-aa3e-4fef-ac8e-8c5db9437ace"
const vincentHome = "8f2826a0-22e6-402d-8052-0a828ebdee7e"
const vincentLib  = "11579501-c662-4ad6-981f-6f2ed6978186"

const williamUUID = "5655a5a0-eb8e-4be1-9705-bae2a5bfcb24"
const williamHome = "b6092e10-b58c-4e9a-af5d-e0e571126374"
const williamLib  = "905ea680-9501-4ffe-b471-685bc241f9a5"

const xenaUUID    = "a71beb7c-1df0-4211-849e-e8f77ce005c1"
const xenaHome    = "2eb5446c-88f3-4cbb-a523-c6de17ee64a8"
const xenaLib     = "294251fe-bd53-4492-8544-dc83b479c86a"

const yvonneUUID  = "3cef7502-df7c-4845-96db-6a0eb10faf67"
const yvonneHome  = "faef4600-51a3-400f-b367-a3020b1a6b1a"
const yvonneLib   = "a1662400-003a-451e-b8f1-be797298533f"

const zoeyUUID    = "634385bc-31c0-418d-b340-92cf0e0a038e"
const zoeyHome    = "c7b74342-b169-425f-8929-546cadbec232"
const zoeyLib     = "2bf5aa45-166e-405d-ac9b-f935f7b9131e"


const users = [
  {
    uuid: aliceUUID,
    username: 'Alice',
    password: null,
    avatar: null,
    email: null,
    isFirstUser: true,
    isAdmin: true,
    home: aliceHome,
    library: aliceLib,
  },
  {
    uuid: bobUUID,
    username: 'Bob',
    password: null,
    avatar: null,
    email: null,
    isAdmin: true,
    home: bobHome,
    library: bobLib,
  },
  {
    uuid: charlieUUID,
    username: 'Charlie',
    password: null,
    avatar: null,
    email: null,
    home: charlieHome,
    library: charlieLib
  },
  {
    uuid: davidUUID,
    username: 'David',
    password: null,
    avatar: null,
    email: null,
    home: davidHome,
    library: davidLib
  },
  {
    uuid: emilyUUID,
    username: 'Emily',
    password: null,
    avatar: null,
    email: null,
    home: emilyHome,
    library: emilyLib,
  },
  {
    uuid: frankUUID,
    username: 'Frank',
    password: null,
    avatar: null,
    email: null,
    home: frankHome,
    library: frankLib,
  },
  {
    uuid: georgeUUID,
    username: 'George',
    password: null,
    avatar: null,
    email: null,
    home: georgeHome,
    library: georgeLib
  },
  {
    uuid: henryUUID,
    username: 'Henry',
    password: null,
    avatar: null,
    email: null,
    home: henryHome,
    library: henryLib,
  },
  {
    uuid: ianUUID,
    username: 'Ian',
    password: null,
    avatar: null,
    email: null,
    home: ianHome,
    library: ianLib,
  },
  {
    uuid: janeUUID,
    username: 'Jane',
    password: null,
    avatar: null,
    email: null,
    home: janeHome,
    library: janeLib,
  },
  {
    uuid: kateUUID,
    username: 'Kate',
    password: null,
    avatar: null,
    email: null,
    home: kateHome,
    library: kateLib,
  },
  {
    uuid: leoUUID,
    username: 'Leo',
    password: null,
    avatar: null,
    email: null,
    home: leoHome,
    library: leoLib,
  },
  {
    uuid: maryUUID,
    username: 'Mary',
    password: null,
    avatar: null,
    email: null,
    home: maryHome,
    library: maryLib,
  },
  {
    uuid: nicoleUUID,
    username: 'Nicole',
    password: null,
    avatar: null,
    email: null,
    home: nicoleHome,
    library: nicoleLib
  },
  {
    uuid: oliviaUUID,
    username: 'Olivia',
    password: null,
    avatar: null,
    email: null,
    home: oliviaHome,
    library: oliviaLib
  },
  {
    uuid: peterUUID,
    username: 'Peter',
    password: null,
    avatar: null,
    email: null,
    home: peterHome,
    library: peterLib,
  },
  {
    uuid: quinnUUID,
    username: 'Quinn',
    password: null,
    avatar: null,
    email: null,
    home: quinnHome,
    library: quinnLib
  },
  {
    uuid: robbieUUID,
    username: 'Robbie',
    password: null,
    avatar: null,
    email: null,
    home: robbieHome,
    library: robbieLib,
  },
  {
    uuid: sophieUUID,
    username: 'Sophie',
    password: null,
    avatar: null,
    email: null,
    home: sophieHome,
    library: sophieLib
  },
  {
    uuid: tomUUID,
    username: 'Tom',
    password: null,
    avatar: null,
    email: null,
    home: tomHome,
    library: tomLib
  },
  {
    uuid: ulyssesUUID,
    username: 'Ulysses',
    password: null,
    avatar: null,
    email: null,
    home: ulyssesHome,
    library: ulyssesLib
  },
  {
    uuid: vincentUUID,
    username: 'Vincent',
    password: null,
    avatar: null,
    email: null,
    home: vincentHome,
    library: vincentLib
  },
  {
    uuid: williamUUID,
    username: 'William',
    password: null,
    avatar: null,
    email: null,
    home: williamHome,
    library: williamLib
  },
  {
    uuid: xenaUUID,
    username: 'Xena',
    password: null,
    avatar: null,
    email: null,
    home: xenaHome,
    library: xenaLib
  },
  {
    uuid: yvonneUUID,
    username: 'Yvonne',
    password: null,
    avatar: null,
    email: null,
    home: yvonneHome,
    library: yvonneLib
  },
  {
    uuid: zoeyUUID,
    username: 'Zoey',
    password: null,
    avatar: null,
    email: null,
    home: zoeyHome,
    library: zoeyLib,
  }
]


let drives = [
  {
    label: 'Alice home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: aliceHome,
    owner: [ aliceUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Alice library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: aliceLib,
    owner: [ aliceUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Bob home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: bobHome,
    owner: [ bobUUID ],
    writelist: [],
    readlist: [ aliceUUID ],
    cache: true
  },
  {
    label: 'Bob library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: bobLib,
    owner: [ bobUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Charlie home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: charlieHome,
    owner: [ charlieUUID ],
    writelist: [],
    readlist: [ aliceUUID, bobUUID ],
    cache: true
  },
  {
    label: 'Charlie library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: charlieLib,
    owner: [ charlieUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'David home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: davidHome,
    owner: [ davidUUID ],
    writelist: [ bobUUID ],
    readlist: [],
    cache: true
  },
  {
    label: 'David library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: davidLib,
    owner: [ davidUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Emily home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: emilyHome,
    owner: [ emilyUUID ],
    writelist: [ bobUUID ],
    readlist: [ aliceUUID ],
    cache: true
  },
  {
    label: 'Emily library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: emilyLib,
    owner: [ emilyUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Frank home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: frankHome,
    owner: [ frankUUID ],
    writelist: [ bobUUID ],
    readlist: [ aliceUUID, charlieUUID ],
    cache: true
  },
  {
    label: 'Frank library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: frankLib,
    owner: [ frankUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'George home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: georgeHome,
    owner: [ georgeUUID ],
    writelist: [ aliceUUID, bobUUID ],
    readlist: [],
    cache: true
  },
  {
    label: 'George library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: georgeLib,
    owner: [ georgeUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Henry home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: henryHome,
    owner: [ henryUUID ],
    writelist: [ aliceUUID, bobUUID ],
    readlist: [ charlieUUID ],
    cache: true
  },
  {
    label: 'Henry library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: henryLib,
    owner: [ henryUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Ian home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: ianHome,
    owner: [ ianUUID ],
    writelist: [ aliceUUID, bobUUID ],
    readlist: [ charlieUUID, davidUUID ],
    cache: true
  },
  {
    label: 'Ian library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: ianLib,
    owner: [ ianUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: '',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: janeHome,
    owner: [ janeUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Jane library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: janeLib,
    owner: [ janeUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: '@$%$$34445#$^#23',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: kateHome,
    owner: [ kateUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Kate library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: kateLib,
    owner: [ kateUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Leo home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: leoHome,
    owner: [ leoUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Mary library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: maryLib,
    owner: [ maryUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Nicole home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: nicoleHome,
    owner: [ nicoleUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Nicole library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: nicoleLib,
    owner: [ nicoleUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Olivia home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: oliviaHome,
    owner: [ oliviaUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Olivia library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: oliviaLib,
    owner: [ oliviaUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Peter home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: peterHome,
    owner: [ peterUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Peter library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: peterLib,
    owner: [ peterUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Quinn home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: quinnHome,
    owner: [ quinnUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Quinn library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: quinnLib,
    owner: [ quinnUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Robbie home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: robbieHome,
    owner: [ robbieUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Robbie library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: robbieLib,
    owner: [ robbieUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Sophie home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: sophieHome,
    owner: [ sophieUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Sophie library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: sophieLib,
    owner: [ sophieUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Tom home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: tomHome,
    owner: [ tomUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Tom library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: tomLib,
    owner: [ tomUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Ulysses home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: ulyssesHome,
    owner: [ ulyssesUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Ulysses library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: ulyssesLib,
    owner: [ ulyssesUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Vincent home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: vincentHome,
    owner: [ vincentUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Vincent library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: vincentLib,
    owner: [ vincentUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'William home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: williamHome,
    owner: [ williamUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'William library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: williamLib,
    owner: [ williamUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Xena home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: xenaHome,
    owner: [ xenaUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Xena library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: xenaLib,
    owner: [ xenaUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Yvonne home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: yvonneHome,
    owner: [ yvonneUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Yvonne library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: yvonneLib,
    owner: [ yvonneUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Zoey home',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: zoeyHome,
    owner: [ zoeyUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },
  {
    label: 'Zoey library',
    fixedOwner: true,
    URI: 'fruitmix',
    uuid: zoeyLib,
    owner: [ zoeyUUID ],
    writelist: [],
    readlist: [],
    cache: true
  },

]

const genPass = (text, callback) => {
  bcrypt.genSalt(10, (err, salt) => {
    if (err) return callback(err)
    bcrypt.hash(text, salt, (err, enc) => {
      if (err) return callback(err)
      callback(null, enc) 
    })
  }) 
}

const genPassAsync = Promise.promisify(genPass)

const commonPassword = '123456'
const commonEncrypted = '$2a$10$P75ZeC1RQOdR2e.cCEjRgeQmjBMjSJeMPKNC71UoYKbl1OlCsMJNC'

/**
genPassAsync(commonPassword)
  .then(r => {
    console.log(`encrypted version of common password: ${r}`)
  })
  .catch(e => {
    console.log(e)
  })
**/

export const getUsers = () => 
  users.map(user => Object.assign(clone(user), { password: commonEncrypted }))

// TODO change user to username
export const genUserToken = (user) => jwt.encode({ uuid: user.uuid }, secret)

export const initFamilyRoot = async (rootDir) => {

//  await rimrafAsync(rootDir)
  await mkdirpAsync(rootDir)

  await paths.setRootAsync(rootDir)

  let driveDir = paths.get('drives')  
  await Promise.all(drives.map(drv => mkdirpAsync(path.join(driveDir, drv.uuid))))

  let modelDir = paths.get('models')
  await fs.writeFileAsync(path.join(modelDir, 'users.json'), JSON.stringify(getUsers(), null, '  '))
  await fs.writeFileAsync(path.join(modelDir, 'drives.json'), JSON.stringify(drives, null, '  '))

  let userModel = await createUserModelAsync(path.join(modelDir, 'users.json'))
  let driveModel = await createDriveModelAsync(path.join(modelDir, 'drives.json'))

  models.setModel('user', userModel)
  models.setModel('drive', driveModel)
}








