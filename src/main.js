const core = require("@actions/core");
const github = require("@actions/github");

async function getParserRules({ octokit, owner, repo, path }) {
  const result = await octokit.repos.getContents({ owner, repo, path });
  core.debug("in getParserRules");
  const content = Buffer.from(result.data.content, "base64").toString("ascii");
  core.debug(JSON.stringify(content));
  return JSON.parse(content);
}

function handleError(error) {
  core.debug(error.message);
  core.debug(error.stack);
  core.setOutput("message", error.message);
  core.setOutput("stepStatus", "failed");
  core.setFailed(error.message);
}
function getOctokit() {
  let octokit;
  try {
    octokit = new github.GitHub(process.env.ADMIN_TOKEN);
    return octokit;
  } catch (error) {
    throw new Error("Failed to get a proper GitHub client.");
  }
}
async function main() {
  try {
    core.debug(new Date().toTimeString());
    const octokit = getOctokit();

    const { issue } = github.context.payload;
    const parsingRulePath = core.getInput("PARSING_RULES_PATH");

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const parserRules = await getParserRules({
      octokit,
      owner,
      repo,
      path: parsingRulePath
    });

    const emailMatch = issue.body.match(parserRules.email.regex);

    core.debug(issue.body);
    if (!emailMatch) {
      throw new Error("Parsing error: email not found.");
    }

    const email = emailMatch.groups.email;
    const role = core.getInput("USER_ROLE") || "direct_member";

    if (email) {
      const result = await octokit.orgs.createInvitation({
        org: owner,
        role,
        email
      });
      const successMessage = `User with email ${email} has been invited into the org.`;
      core.debug(result);
      core.info(successMessage);
      core.setOutput("message", successMessage);
      core.setOutput("stepStatus", "success");
    } else {
      throw new Error("Email not found in issue");
    }

    core.info(new Date().toTimeString());
  } catch (error) {
    handleError(error);
  }
}

module.exports = { main, getParserRules };
