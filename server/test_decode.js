const b64 = "CBMiVkFVX3lxTE0xelk5ajNiQlB4NF9yZ1lTOVVIVVQ5dkJBOWV0eHRGUnFGY3RQdzFjSlhjZl9EaUJScERObGt4YzNrV3FwN3FqSUJYaUZIaW11V25PMUtn";
const buf = Buffer.from(b64, "base64");
const str = buf.toString("utf8");
console.log("String representation containing hidden URL:");
console.log(str.match(/https?:\/\/[^\s\x00-\x1F\x7F]+/g) || "No URL found directly");

