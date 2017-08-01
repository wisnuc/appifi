module.exports = {
  "rules": {
    "padded-blocks": ["error", { 
      "blocks": "never",
      "classes": "always",
      "switches": "never"
    }]
  },
  "extends": "standard",
  "plugins": [
      "standard",
      "promise"
  ]
};
