const fs = require("fs");
const path = require("path");
const snowball = require("node-snowball");

const replies = require("../replies.json");
const MODEL_PATH = path.join(__dirname, "./model.json");

function loadFile() {
  if (!fs.existsSync(MODEL_PATH)) {
    console.log("Creating a new model");

    return [[], {}];
  }
  return require(MODEL_PATH);
}
module.exports.loadFile = loadFile;

function persistTree(tree) {
  fs.writeFileSync(MODEL_PATH, JSON.stringify(tree, null, 2));
}
module.exports.persistTree = persistTree;

function randomFromArray(arr, amount) {
  if (arr.length === 0) {
    return [];
  }
  return Array(amount)
    .fill(null)
    .map(() => arr[Math.floor((arr.length - 1) * Math.random())]);
}

function getRandomReplies() {
  return randomFromArray(replies, 5);
}
module.exports.getRandomReplies = getRandomReplies;

function unique(arr) {
  return arr.filter((item, i) => arr.slice(0, i).indexOf(item) === -1);
}

function getWords(message) {
  return snowball.stemword(
    message
      .replace(/[\!\?\.]/g, "")
      .split(" ")
      .map(word => word.toLowerCase().trim()),
    "finnish"
  );
}

function storeCandidate(tree, message, candidate) {
  const words = getWords(message);

  let node = tree;

  for (word of words) {
    if (!node[1][word]) {
      node[1][word] = [[], {}];
    }
    node = node[1][word];
  }

  const matches = node[0];

  const indexInMatches = matches.indexOf(candidate);
  const existsAndNotMostPopular = indexInMatches > 0;

  if (existsAndNotMostPopular) {
    let betterOne = matches[indexInMatches - 1];
    list[indexInMatches - 1] = candidate;
    list[indexInMatches] = betterOne;
  }

  if (indexInMatches === -1) {
    matches.push(candidate);
  }
  return tree;
}

module.exports.storeCandidate = storeCandidate;

function getCandidates(tree, message) {
  const words = getWords(message);

  let node = tree;
  let i = 0;

  while (node[1][words[i]] !== undefined) {
    node = node[1][words[i]];
    i++;
  }

  const matches = node[0];

  if (matches.length === 0) {
    return getRandomReplies();
  }

  return [
    ...matches.slice(0, 2),
    ...unique(randomFromArray(matches.slice(2), 2)),
    ...getRandomReplies()
  ].slice(0, 5);
}

module.exports.getCandidates = getCandidates;
