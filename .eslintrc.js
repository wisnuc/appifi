module.exports = {
  "env": {
    "browser": true,
    "node": true,
    "es6": true,
    "jest": true,
    "jquery": true
  },
  "extends": "standard",
  "plugins": [
      "standard",
      "promise"
  ],
  "parserOptions": {
    "ecmaVersion": 8,
    "sourceType": "module"
  },
  "rules": {
    "padded-blocks": ["error", { 
      "blocks": "never",
      "classes": "always",
      "switches": "never"
    }],
    "no-new": 0
  }
};
