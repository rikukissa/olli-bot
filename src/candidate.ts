const snowball = require("node-snowball");

export type Model = [
  string[],
  {
    [key: number]: Model;
  }
];

export type Candidate = string;
export type Candidates = Candidate[];
export type Replies = string[];

function randomFromArray(arr: Array<any>, amount: number) {
  if (arr.length === 0) {
    return [];
  }
  return Array(amount)
    .fill(null)
    .map(() => arr[Math.floor((arr.length - 1) * Math.random())]);
}

function getWords(message: string): string[] {
  return snowball.stemword(
    message
      .replace(/[\!\?\.]/g, "")
      .split(" ")
      .map(word => word.toLowerCase().trim()),
    "finnish"
  );
}

function getCandidateWithWeighting(candidates: Candidates, value: number) {
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

export function getRandomReplies(replies: Replies) {
  return randomFromArray(replies, 5);
}

export function getBestMatchingCandidate(
  model: Model,
  replies: Replies,
  message: string
) {
  const candidates = getCandidates(model, message, replies);

  const random = Math.random();

  return getCandidateWithWeighting(candidates, random);
}

export function storeCandidate(
  model: Model,
  message: string,
  candidate: Candidate
) {
  const words = getWords(message);

  let node = model;

  for (let word of words) {
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
  return model;
}

function getNodeWithPath(model: Model, words: string[]): Model | undefined {
  let node = model;

  for (let word of words) {
    node = node[1][word];
    if (!node) {
      break;
    }
  }

  return node;
}

function getRepliesFromPath(model: Model, words: string[]) {
  let node = model;
  let i = 0;
  let results: string[] = [];

  while (node[1][words[i]] !== undefined) {
    node = node[1][words[i]];
    results = results.concat(node[0]);
    i++;
  }
  return results;
}

function getMatchesFromSiblings(tree: Model, parentNode: Model) {
  return Object.keys(parentNode[1])
    .filter(key => parentNode[1][key] !== tree)
    .reduce((memo, key) => memo.concat(parentNode[1][key][0]), []);
}

function getAllReplies(tree: Model): string[] {
  return Object.keys(tree[1]).reduce(
    (memo, key) => memo.concat(getAllReplies(tree[1][key])),
    tree[0]
  );
}

export function getCandidates(
  model: Model,
  message: string,
  replies: Replies
): string[] {
  const words = getWords(message);

  const matchingNode = getNodeWithPath(model, words);
  const parentNode = getNodeWithPath(model, words.slice(0, -1));

  const perfectMatches = matchingNode ? matchingNode[0] : [];

  const matchesFromFurtherInTree = matchingNode
    ? getAllReplies(matchingNode)
    : [];

  const matchesFromSiblings =
    matchingNode && parentNode
      ? getMatchesFromSiblings(matchingNode, parentNode)
      : [];

  const matchesFromBranchesBelow =
    words.length > 1
      ? getRepliesFromPath(model, words.slice(0, -1)).reverse()
      : [];

  let i = 0;
  let matchesFromSiblingsBelow: string[] = [];
  while (i < words.length) {
    const parent = getNodeWithPath(model, words.slice(0, words.length - i));
    if (parent) {
      matchesFromSiblingsBelow = getAllReplies(parent);
    }
    i++;
  }

  return [
    ...perfectMatches,
    ...matchesFromFurtherInTree,
    ...matchesFromSiblings,
    ...matchesFromBranchesBelow,
    ...matchesFromSiblingsBelow,
    ...getRandomReplies(replies)
  ];
}
