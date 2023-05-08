const fs = require('fs-extra');
const glob = require("glob");
const path = require("path")
const { exit } = require("process");
const { AutotaskClient } = require('defender-autotask-client');
require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH });

console.info(".env file: ", process.env.DOTENV_CONFIG_PATH);

const srcPath = "./src/abis";
const destPath = "./dist/abis";
const distPath = "./dist";

if (!fs.existsSync(srcPath)) {
  console.error(`${srcPath} does not exist`);
  exit(1);
}

fs.ensureDirSync(destPath);
fs.emptyDirSync(destPath);

const files = glob.sync(srcPath + "/**/*.json");
files.forEach(file => {
  fs.copySync(file, `${destPath}/${path.basename(file)}`,
    {
      preserveTimestamps: true
    });
});

/**
 * see here on how to use this API:  https://www.npmjs.com/package/defender-autotask-client
 * and here: https://docs.openzeppelin.com/defender/autotasks-api-reference#code-endpoint
 * 
 * autotask_id comes from the autotask's edit page, or the url of the autotask's page itself.
 */
const { API_KEY_TEAM: apiKey, API_SECRET_TEAM: apiSecret, AUTOTASK_ID: autoTaskId } = process.env;

const client = new AutotaskClient({ apiKey, apiSecret });
client.updateCodeFromFolder(autoTaskId, distPath).then(() => {
  console.log("deploy complete");
  exit(0);
})

