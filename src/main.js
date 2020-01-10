const github = require("@actions/github");
const core = require("@actions/core");

async function getConfig({ octokit, owner, repo, path }) {
  const result = await octokit.repos.getContents({ owner, repo, path });

  core.debug("in getParserRules");
  const content = Buffer.from(result.data.content, "base64").toString("ascii");
  core.debug(JSON.stringify(content));
  const config = JSON.parse(content);
  validateConfig({ config });
  return config;
}

function validateConfig({ config }) {
  if (!("emailRule" in config)) {
    throw new Error("Config lacks valid email rule");
  }

  return true;
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

function validateEmail({ email, emailRegex }) {
  return new RegExp(emailRegex).test(email);
}

function isTrustedUser({ issue, trustedUserRegex }) {
  return new RegExp(trustedUserRegex).test(issue.user.login);
}

async function main() {
  try {
    core.debug(new Date().toTimeString());
    const octokit = getOctokit();
    const { issue } = github.context.payload;
    const configPath = core.getInput("CONFIG_PATH");

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const { emailRule, trustedUserRule } = await getConfig({
      octokit,
      owner,
      repo,
      path: configPath
    });

    if (
      trustedUserRule &&
      !isTrustedUser({ issue, trustedUserRegex: trustedUserRule.regex })
    ) {
      throw new Error(
        `User that opened issue, ${issue.user.login} not a trusted user`
      );
    }

    core.debug(issue.body);

    const email = core.getInput("EMAIL");
    const role = core.getInput("USER_ROLE") || "direct_member";
    if (!validateEmail({ email, emailRegex: emailRule.regex })) {
      throw new Error(`Email ${email} not from a valid domain`);
    }

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

module.exports = { main, validateConfig, validateEmail, handleError };
