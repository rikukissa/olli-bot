const snowball = require("node-snowball");

export type Tree = [
  string[],
  {
    [key: number]: Tree;
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

function unique(arr: Array<any>) {
  return arr.filter((item, i) => arr.slice(0, i).indexOf(item) === -1);
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

export function getReply(tree: Tree, message: string, replies: Replies) {
  const candidates = getCandidates(tree, message, replies);

  const random = Math.random();

  return getCandidateWithWeighting(candidates, random);
}

export function storeCandidate(
  tree: Tree,
  message: string,
  candidate: Candidate
) {
  const words = getWords(message);

  let node = tree;

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
  return tree;
}

export function getCandidates(
  tree: Tree,
  message: string,
  replies: Replies
): string[] {
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
    return getRandomReplies(replies);
  }

  const matchesFromBranchesHigherUp = previousBranches
    .reverse()
    .slice(1)
    .reduce((memo, [matchesList]) => [...memo, ...matchesList], []);

  return [
    ...matches, // all from found node
    ...unique(randomFromArray(matches.slice(2), 2)), // 2 other ones from the found node
    ...matchesFromBranchesHigherUp,
    ...getRandomReplies(replies) // random ones
  ].slice(0, 5);
}
