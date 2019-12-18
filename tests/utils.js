jest.mock("@actions/core");
jest.mock("@actions/github");

const { GitHub, context } = require("@actions/github");
const core = require("@actions/core");

let functions = {
  createInvitation: jest.fn(),
  getContents: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  debug: jest.fn()
};

function startup() {
  const github = {
    repos: {
      getContents: functions.getContents
    },
    orgs: {
      createInvitation: functions.createInvitation
    }
  };
  GitHub.mockImplementation(() => github);
  core.debug = functions.debug;
  core.setFailed = functions.setFailed;
  core.setOutput = functions.setOutput;
  process.env.GITHUB_REPOSITORY = "testOwner/testRepo";
  context.repo = {
    owner: "owner",
    repo: "repo"
  };
}

let utils = {
  resetMocks: () => {
    jest.resetModules();
    Object.entries(functions).forEach(fn => {
      fn[1].mockClear();
    });
  }
};

startup();
module.exports = { core, GitHub, context, functions, utils };
