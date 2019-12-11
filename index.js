const core = require("@actions/core");
const github = require("@actions/github");
const outdent = require("outdent");

async function getParserRules({ octokit, owner, repo, path }) {
  const result = await octokit.repos.getContents({ owner, repo, path });
  core.debug("in getParserRules");
  const content = Buffer.from(result.data.content, "base64").toString("ascii");
  core.debug(JSON.stringify(content));
  return JSON.parse(content);
}

async function writeStatusToIssue({ octokit, owner, repo, issue, status }) {
  return await octokit.issues.createComment({
    owner: owner,
    repo: repo,
    issue_number: issue.number,
    body: status
  });
}

function __generateMessageBody(messageSuffix, actions) {
  let message = messageSuffix;

  actions.forEach(action => {
    message += `* ${action}  \n`;
  });
  return message;
}

function buildStatusFromActions({ actions, errors }) {
  let status;
  if (actions) {
    status = __generateMessageBody(
      outdent`
            # Issue processed

            ## The following actions were taken:

        `,
      actions
    );
  }

  if (errors) {
    status = __generateMessageBody(
      outdent`
            # Errors encountered while processing

        `,
      errors
    );
  }
  return status;
}

async function run() {
  let octokit;
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
  const { issue } = github.context.payload;
  let errors = [];
  let actions = [];
  try {
    octokit = new github.GitHub(process.env.ADMIN_TOKEN);
  } catch (error) {
    core.debug("Error while trying to create github client.");
    core.debug(error.stack);
  }
  try {
    core.debug(new Date().toTimeString());

    const parsingRulePath = core.getInput("PARSING_RULES_PATH");

    const parserRules = await getParserRules({
      octokit,
      owner,
      repo,
      path: parsingRulePath
    });

    const emailMatch = issue.body.match(parserRules.email.regex);

    core.debug(issue.body);
    if (!emailMatch) {
      throw Error("Parsing error: email not found.");
    }

    const email = emailMatch.groups.email;
    const role = core.getInput("USER_ROLE") || "direct_member";

    if (email) {
      const result = await octokit.orgs.createInvitation({
        org: owner,
        role,
        email
      });
      core.debug(result);
      let actionMessage = `User with email ${email} has been invited into the org.`;
      core.info(actionMessage);
      actions.push(actionMessage);
    } else {
      throw "Email not found in issue";
    }
    core.info(new Date().toTimeString());
  } catch (error) {
    core.debug(error.stack);
    errors.push(error.message);
    // write error to issue
    writeStatusToIssue({
      octokit: octokit,
      owner: owner,
      repo: repo,
      issue: issue,
      status: buildStatusFromActions({ errors: errors })
    });
    core.setFailed(error.message);
  }
  writeStatusToIssue({
    octokit: octokit,
    owner: owner,
    repo: repo,
    issue: issue,
    status: buildStatusFromActions({ actions: actions })
  });
}

run();
