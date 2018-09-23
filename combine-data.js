data = JSON.parse(JSON.stringify(require("./all.json")));
content = data.slice(1).reduce(
  (memo, item) => {
    if (
      memo[memo.length - 1].date - item.date < 60 &&
      memo[memo.length - 1].fromID === item.fromID
    ) {
      memo[memo.length - 1].message =
        memo[memo.length - 1].message + ". " + item.message;
      return memo;
    }
    return memo.concat(item);
  },
  [data[0]]
);
require("fs").writeFileSync(
  "all-combined-data.json",
  JSON.stringify(content, null, 2)
);
