const puppeteer = require("puppeteer");
async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://news.google.com/rss/articles/CBMiVkFVX3lxTE0xelk5ajNiQlB4NF9yZ1lTOVVIVVQ5dkJBOWV0eHRGUnFGY3RQdzFjSlhjZl9EaUJScERObGt4YzNrV3FwN3FqSUJYaUZIaW11V25PMUtn?oc=5";
  console.log("Navigating...");
  await page.goto(url, { waitUntil: "networkidle2" });
  console.log("Redirected URL: " + page.url());
  await browser.close();
}
run();
