const OLLI = 84925287;

const data = require("./all.json").reverse();

function join(str, str2) {
  if (str === "") {
    return str2;
  }
  return str + ". " + str2;
}

const conversation = data.reduce((convo, item) => {
  if (convo.length === 0) {
    return convo.concat({ ...item, reply: "" });
  }

  const previous = convo[convo.length - 1];

  // Push Olli's reply to previous message item
  if (item.fromID === OLLI) {
    previous.reply = join(previous.reply, item.message);
    return convo;
  }

  // Olli had already replied
  if (previous.reply !== "" && item.fromID !== OLLI) {
    return convo.concat({ ...item, reply: "" });
  }

  // Participant stays the same
  if (item.fromID === previous.fromID) {
    previous.message = join(previous.message, item.message);
    return convo;
  }

  // Participant changed and Olli did not reply
  if (previous.reply === "") {
    return convo;
    //   return convo.slice(-1).concat({ ...item, reply: "" });
  }

  return convo.concat({ ...item, reply: "" });
}, []);

const content = conversation.reduce(
  (memo, item) => ({ ...memo, [item.message]: item.reply }),
  {}
);

require("fs").writeFileSync(
  "convo-object.json",
  JSON.stringify(content, null, 2)
);
