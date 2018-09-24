const fs = require("fs");
const { loadFile, storeCandidate } = require("./src/train");

let tree = loadFile();
let convo = require("./convo-object.json");

Object.keys(convo).forEach(message => {
  const candidate = convo[message];
  tree = storeCandidate(tree, message, candidate);
});
fs.writeFileSync("./model.json", JSON.stringify(tree, null, 2));
