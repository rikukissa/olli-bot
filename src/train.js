const fs = require("fs");
const path = require("path");
const snowball = require("node-snowball");

const replies = require("../replies.json");
const MODEL_PATH = path.join(__dirname, "../model.json");

function loadFile() {
  if (!fs.existsSync(MODEL_PATH)) {
    console.log("Creating a new model", MODEL_PATH);

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

function getCandidateWithWeighting(candidates, value) {
  const totalSlices = candidates.reduce((s, _, i) => s + i + 1, 0);
  const portions = candidates.map(
    (_, i) => (candidates.length - i) / totalSlices
  );

  let i = 0;
  let totalSum = 0;
  while (i < portions.length) {
    if (totalSum + portions[i] >= value || i === portions.length - 1) {
      break;
    }
    totalSum += portions[i];
    i++;
  }

  return candidates[i];
}

function getReply(tree, message) {
  const candidates = getCandidates(tree, message);

  const random = Math.random();

  return getCandidateWithWeighting(candidates, random);
}

module.exports.getReply = getReply;

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
    matches[indexInMatches - 1] = candidate;
    matches[indexInMatches] = betterOne;
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

  const previousBranches = [node];

  while (node[1][words[i]] !== undefined) {
    node = node[1][words[i]];
    previousBranches.push(node);
    i++;
  }

  const matches = node[0];

  if (matches.length === 0) {
    return getRandomReplies();
  }

  const matchesFromBranchesHigherUp = previousBranches
    .reverse()
    .slice(1)
    .reduce((memo, [matchesList]) => [...memo, ...matchesList], []);

  return [
    ...matches, // all from found node
    ...unique(randomFromArray(matches.slice(2), 2)), // 2 other ones from the found node
    ...matchesFromBranchesHigherUp,
    ...getRandomReplies() // random ones
  ].slice(0, 5);
}

module.exports.getCandidates = getCandidates;
