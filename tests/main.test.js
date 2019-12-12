jest.mock("@actions/core");
jest.mock("@actions/github");

const main = require("../src/main");

const { GitHub, context } = require("@actions/github");
const core = require("@actions/core");

const OLD_ENV = process.env;
const parsingRules = {
  username: {
    regex: "<p>Name of Requester:\\s*(?<username>.+?)<\\/p>"
  },
  email: {
    regex: "<p>Email of Requester:\\s*(?<email>.+?)<\\/p>"
  }
};

let functions = {
  createInvitation: jest.fn().mockReturnValue(true),
  getContents: jest.fn().mockReturnValue({
    data: {
      content: Buffer.from(JSON.stringify(parsingRules)).toString("base64")
    }
  }),

  setFailed: jest.fn(msg => {
    console.log(`MOCK ERROR: ${msg}`);
  })
};

beforeEach(() => {
  jest.resetModules();
  Object.entries(functions).forEach(fn => {
    fn[1].mockClear();
  });
  process.env.GITHUB_REPOSITORY = "testOwner/testRepo";

  const github = {
    repos: {
      getContents: functions.getContents
    },
    orgs: {
      createInvitation: functions.createInvitation
    }
  };

  context.repo = {
    owner: "owner",
    repo: "repo"
  };

  setIssueBody("<p>Email of Requester: user@email.com</p>");

  core.debug = message => {
    console.log(`MOCK DEBUG: ${message}`);
  };
  core.setFailed = functions.setFailed;

  GitHub.mockImplementation(() => github);
});

afterEach(() => {
  process.env = OLD_ENV;
});

let setIssueBody = body => {
  context.payload = {
    issue: {
      body: body
    }
  };
};

describe("Main", () => {
  it("parses the parser rules and creates an invitation with a valid body", async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce("/path")
      .mockReturnValueOnce("direct_member");
    await main.main();
    expect(functions.getContents).toHaveBeenCalledTimes(1);
    expect(functions.createInvitation).toHaveBeenCalledTimes(1);
  });

  it("prases the parser rules and throws an exception with an invalid bodh", async () => {
    setIssueBody("Any test data without an email");
    core.getInput = jest
      .fn()
      .mockReturnValueOnce("/path")
      .mockReturnValueOnce("direct_member");
    await main.main();
    expect(functions.getContents).toHaveBeenCalledTimes(1);
    expect(functions.createInvitation).toHaveBeenCalledTimes(0);
    expect(functions.setFailed).toHaveBeenCalledTimes(1);
  });

  it("fails to get a good octokit instance and throws an exception", async () => {
    const errorMessage = "Test Error";
    GitHub.mockImplementation(() => {
      throw Error(errorMessage);
    });
    await main.main();

    expect(functions.getContents).toHaveBeenCalledTimes(0);
    expect(functions.createInvitation).toHaveBeenCalledTimes(0);
    expect(functions.setFailed).toHaveBeenCalledTimes(1);
    expect(functions.setFailed).toHaveBeenCalledWith(errorMessage);
  });
});
