import * as Octo from "@octokit/rest";
import { Model } from "./candidate";

const octokit = new Octo();

const GIST_ID = process.env.GIST_ID as string;
const REPLIES_GIST_ID = process.env.REPLIES_GIST_ID as string;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN as string;

const authPromise = octokit.authenticate({
  type: "token",
  token: GITHUB_TOKEN
});

export async function getReplies() {
  await authPromise;

  const repliesGist = await octokit.gists.get({
    gist_id: REPLIES_GIST_ID
  });

  return JSON.parse(repliesGist.data.files["replies.json"].content);
}

export async function getModel() {
  await authPromise;

  const modelGist = await octokit.gists.get({
    gist_id: GIST_ID
  });

  return JSON.parse(modelGist.data.files["model.json"].content);
}

export async function storeModel(model: Model) {
  await authPromise;

  return octokit.gists.edit({
    gist_id: GIST_ID,
    files: {
      "model.json": {
        filename: "model.json",
        content: JSON.stringify(model, null, 2)
      }
    } as any // TODO
  });
}
