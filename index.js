const core = require('@actions/core');
const github = require('@actions/github');

async function getParserRules({octokit, owner, repo, path}) {
  const result = await octokit.repos.getContents({owner, repo, path});
  core.debug("in getParserRules")
  const content = Buffer.from(result.data.content, 'base64').toString('ascii');
  core.debug(JSON.stringify(content))
  return JSON.parse(content);
}

async function run() {
  let octokit
  try {
    octokit = new github.GitHub(process.env.ADMIN_TOKEN);
  } catch(error) {
    core.debug('Error while trying to create github client.');
    core.debug(error.stack)
    core.setFailed(error.message); 
  }
  try {
    core.debug((new Date()).toTimeString());

    const {issue} = github.context.payload;
    const parsingRulePath = core.getInput('PARSING_RULES_PATH');

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const parserRules = await getParserRules({octokit, owner, repo, path: parsingRulePath});

    const emailMatch = issue.body.match(parserRules.email.regex);
    const usernameMatch = issue.body.match(parserRules.username.regex);

    if(!emailMatch && !usernameMatch) {
      throw Error('Parsing error: email and username not found.');
    }

    const email = emailMatch.groups.email;
    const username = usernameMatch.groups.username;

    if(email) {
      const result = await octokit.orgs.createInvitation({
        org: owner,
        role: core.getInput("USER_ROLE"),
        email
      });
      core.debug(result);
      core.info(`User with email ${email} has been invited into the org.`);
    } else {
      const result = await octokit.orgs.addOrUpdateMembership({
        org: owner,
        username
      })
      core.debug(result);
      core.info(`User with username ${username} has been invited into the org.`);
    }
    core.info((new Date()).toTimeString())
  }
  catch (error) {
    core.debug(error.stack)
    core.setFailed(error.message);
  }
}

run();
