import { getBestMatchingCandidate } from "src/candidate";
const model = require("./test/model.json");
const replies = require("./test/replies.json");

const mockMath = Object.create(global.Math);
mockMath.random = () => 0;
global.Math = mockMath;

describe("replies", () => {
  it("foobar", () => {
    expect(getBestMatchingCandidate(model, replies, "moro")).toMatchSnapshot();
    expect(
      getBestMatchingCandidate(model, replies, "mitäs kekke")
    ).toMatchSnapshot();
  });
});
