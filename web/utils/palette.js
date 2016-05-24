import * as colors from 'material-ui/styles/colors'
import { fade } from 'material-ui/utils/colorManipulator'

let palette = {

  red : {
    50: colors.red50,
    100: colors.red100,
    200: colors.red200,
    300: colors.red300,
    400: colors.red400,
    500: colors.red500,
    600: colors.red600,
    700: colors.red700,
    800: colors.red800,
    900: colors.red900,
    A100: colors.redA100,
    A200: colors.redA200,
    A400: colors.redA400,
    A700: colors.redA700
  },
  pink : {
    50: colors.pink50,
    100: colors.pink100,
    200: colors.pink200,
    300: colors.pink300,
    400: colors.pink400,
    500: colors.pink500,
    600: colors.pink600,
    700: colors.pink700,
    800: colors.pink800,
    900: colors.pink900,
    A100: colors.pinkA100,
    A200: colors.pinkA200,
    A400: colors.pinkA400,
    A700: colors.pinkA700
  },
  purple : {
    50: colors.purple50,
    100: colors.purple100,
    200: colors.purple200,
    300: colors.purple300,
    400: colors.purple400,
    500: colors.purple500,
    600: colors.purple600,
    700: colors.purple700,
    800: colors.purple800,
    900: colors.purple900,
    A100: colors.purpleA100,
    A200: colors.purpleA200,
    A400: colors.purpleA400,
    A700: colors.purpleA700
  },
  deepPurple : {
    50: colors.deepPurple50,
    100: colors.deepPurple100,
    200: colors.deepPurple200,
    300: colors.deepPurple300,
    400: colors.deepPurple400,
    500: colors.deepPurple500,
    600: colors.deepPurple600,
    700: colors.deepPurple700,
    800: colors.deepPurple800,
    900: colors.deepPurple900,
    A100: colors.deepPurpleA100,
    A200: colors.deepPurpleA200,
    A400: colors.deepPurpleA400,
    A700: colors.deepPurpleA700
  },
  indigo : {
    50: colors.indigo50,
    100: colors.indigo100,
    200: colors.indigo200,
    300: colors.indigo300,
    400: colors.indigo400,
    500: colors.indigo500,
    600: colors.indigo600,
    700: colors.indigo700,
    800: colors.indigo800,
    900: colors.indigo900,
    A100: colors.indigoA100,
    A200: colors.indigoA200,
    A400: colors.indigoA400,
    A700: colors.indigoA700
  },
  blue : {
    50: colors.blue50,
    100: colors.blue100,
    200: colors.blue200,
    300: colors.blue300,
    400: colors.blue400,
    500: colors.blue500,
    600: colors.blue600,
    700: colors.blue700,
    800: colors.blue800,
    900: colors.blue900,
    A100: colors.blueA100,
    A200: colors.blueA200,
    A400: colors.blueA400,
    A700: colors.blueA700
  },
  lightBlue : {
    50: colors.lightBlue50,
    100: colors.lightBlue100,
    200: colors.lightBlue200,
    300: colors.lightBlue300,
    400: colors.lightBlue400,
    500: colors.lightBlue500,
    600: colors.lightBlue600,
    700: colors.lightBlue700,
    800: colors.lightBlue800,
    900: colors.lightBlue900,
    A100: colors.lightBlueA100,
    A200: colors.lightBlueA200,
    A400: colors.lightBlueA400,
    A700: colors.lightBlueA700
  },
  cyan : {
    50: colors.cyan50,
    100: colors.cyan100,
    200: colors.cyan200,
    300: colors.cyan300,
    400: colors.cyan400,
    500: colors.cyan500,
    600: colors.cyan600,
    700: colors.cyan700,
    800: colors.cyan800,
    900: colors.cyan900,
    A100: colors.cyanA100,
    A200: colors.cyanA200,
    A400: colors.cyanA400,
    A700: colors.cyanA700
  },
  teal : {
    50: colors.teal50,
    100: colors.teal100,
    200: colors.teal200,
    300: colors.teal300,
    400: colors.teal400,
    500: colors.teal500,
    600: colors.teal600,
    700: colors.teal700,
    800: colors.teal800,
    900: colors.teal900,
    A100: colors.tealA100,
    A200: colors.tealA200,
    A400: colors.tealA400,
    A700: colors.tealA700
  },
  green : {
    50: colors.green50,
    100: colors.green100,
    200: colors.green200,
    300: colors.green300,
    400: colors.green400,
    500: colors.green500,
    600: colors.green600,
    700: colors.green700,
    800: colors.green800,
    900: colors.green900,
    A100: colors.greenA100,
    A200: colors.greenA200,
    A400: colors.greenA400,
    A700: colors.greenA700
  },
  lightGreen : {
    50: colors.lightGreen50,
    100: colors.lightGreen100,
    200: colors.lightGreen200,
    300: colors.lightGreen300,
    400: colors.lightGreen400,
    500: colors.lightGreen500,
    600: colors.lightGreen600,
    700: colors.lightGreen700,
    800: colors.lightGreen800,
    900: colors.lightGreen900,
    A100: colors.lightGreenA100,
    A200: colors.lightGreenA200,
    A400: colors.lightGreenA400,
    A700: colors.lightGreenA700
  },
  lime : {
    50: colors.lime50,
    100: colors.lime100,
    200: colors.lime200,
    300: colors.lime300,
    400: colors.lime400,
    500: colors.lime500,
    600: colors.lime600,
    700: colors.lime700,
    800: colors.lime800,
    900: colors.lime900,
    A100: colors.limeA100,
    A200: colors.limeA200,
    A400: colors.limeA400,
    A700: colors.limeA700
  },
  yellow : {
    50: colors.yellow50,
    100: colors.yellow100,
    200: colors.yellow200,
    300: colors.yellow300,
    400: colors.yellow400,
    500: colors.yellow500,
    600: colors.yellow600,
    700: colors.yellow700,
    800: colors.yellow800,
    900: colors.yellow900,
    A100: colors.yellowA100,
    A200: colors.yellowA200,
    A400: colors.yellowA400,
    A700: colors.yellowA700
  },
  amber : {
    50: colors.amber50,
    100: colors.amber100,
    200: colors.amber200,
    300: colors.amber300,
    400: colors.amber400,
    500: colors.amber500,
    600: colors.amber600,
    700: colors.amber700,
    800: colors.amber800,
    900: colors.amber900,
    A100: colors.amberA100,
    A200: colors.amberA200,
    A400: colors.amberA400,
    A700: colors.amberA700
  },
  orange : {
    50: colors.orange50,
    100: colors.orange100,
    200: colors.orange200,
    300: colors.orange300,
    400: colors.orange400,
    500: colors.orange500,
    600: colors.orange600,
    700: colors.orange700,
    800: colors.orange800,
    900: colors.orange900,
    A100: colors.orangeA100,
    A200: colors.orangeA200,
    A400: colors.orangeA400,
    A700: colors.orangeA700
  },
  deepOrange : {
    50: colors.deepOrange50,
    100: colors.deepOrange100,
    200: colors.deepOrange200,
    300: colors.deepOrange300,
    400: colors.deepOrange400,
    500: colors.deepOrange500,
    600: colors.deepOrange600,
    700: colors.deepOrange700,
    800: colors.deepOrange800,
    900: colors.deepOrange900,
    A100: colors.deepOrangeA100,
    A200: colors.deepOrangeA200,
    A400: colors.deepOrangeA400,
    A700: colors.deepOrangeA700
  },
  brown : {
    50: colors.brown50,
    100: colors.brown100,
    200: colors.brown200,
    300: colors.brown300,
    400: colors.brown400,
    500: colors.brown500,
    600: colors.brown600,
    700: colors.brown700,
    800: colors.brown800,
    900: colors.brown900
  },
  grey : {
    50: colors.grey50,
    100: colors.grey100,
    200: colors.grey200,
    300: colors.grey300,
    400: colors.grey400,
    500: colors.grey500,
    600: colors.grey600,
    700: colors.grey700,
    800: colors.grey800,
    900: colors.grey900
  },
  blueGrey : {
    50: colors.blueGrey50,
    100: colors.blueGrey100,
    200: colors.blueGrey200,
    300: colors.blueGrey300,
    400: colors.blueGrey400,
    500: colors.blueGrey500,
    600: colors.blueGrey600,
    700: colors.blueGrey700,
    800: colors.blueGrey800,
    900: colors.blueGrey900
  }
}


let cyan = {
  primary1Color: colors.cyan500,
  primary2Color: colors.cyan700,
  primary3Color: colors.grey400,
  accent1Color: colors.purpleA200,
  accent2Color: colors.grey100,
  accent3Color: colors.grey500,
  textColor: colors.darkBlack,
  alternateTextColor: colors.white,
  canvasColor: colors.white,
  borderColor: colors.grey300,
  disabledColor: fade(colors.darkBlack, 0.3),
  pickerHeaderColor: colors.cyan500,
  clockCircleColor: fade(colors.darkBlack, 0.07),
  shadowColor: colors.fullBlack
}

/**
let hues = [
  'red',          // 4
  'pink',         // 340
  'purple',       // 291
  'deepPurple',   // 262  51.9  47.3
  'indigo',       // 231  48.4  47.8
  'blue',         //  
  'lightBlue',    //
  'cyan',         //
  'teal',         //
  'green',        //
  'lightGreen',   //
  'lime',         //
  'yellow',       //
  'amber',        //
  'orange',       //
  'deepOrange',   //
  'brown',        //
  'grey',         //
  'blueGrey'      //
]
**/

export default (color) => {

  if (palette[color] === undefined) {
    console.log('warning: invalid color passed to palette -> ' + color)
    return cyan
  }

  let primary1Color = palette[color][600]
  let primary2Color = palette[color][900]
  let pickerHeaderColor = palette[color][600]
  let accent1Color = colors.pinkA200

  if (color === 'orange' || color === 'deepOrange')
    accent1Color = colors.teal600
    

  return Object.assign({}, cyan, {
    primary1Color, primary2Color, pickerHeaderColor, accent1Color
  })
}


