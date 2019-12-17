jest.mock("@actions/core");
jest.mock("@actions/github");

const main = require("../src/main");

const { GitHub, context } = require("@actions/github");
const core = require("@actions/core");

const OLD_ENV = process.env;

const emailRule = {
  regex: ".*@gmail.com$"
};

const parserRules = {
  username: {
    regex: "<p>Name of Requester:\\s*(?<username>.+?)<\\/p>"
  },
  email: {
    regex: "<p>Email of Requester:\\s*(?<email>.+?)<\\/p>"
  }
};

const configFile = {
  emailRule: emailRule,
  parserRules: parserRules
};

let functions = {
  createInvitation: jest.fn().mockReturnValue(true),
  getContents: jest.fn().mockReturnValue({
    data: {
      content: Buffer.from(JSON.stringify(configFile)).toString("base64")
    }
  }),

  setFailed: jest.fn(msg => {
    console.error(`MOCK ERROR: ${msg}`);
  }),
  setOutput: jest.fn((name, value) => {
    let returnObj = {};
    returnObj[name] = value;
    return returnObj;
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

  setIssueBody("<p>Email of Requester: user@gmail.com</p>");

  core.debug = message => {
    console.log(`MOCK DEBUG: ${message}`);
  };
  core.setFailed = functions.setFailed;
  core.setOutput = functions.setOutput;

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
    expect(functions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("parses the parser rules and throws an exception with an invalid body", async () => {
    setIssueBody("Any test data without an email");
    core.getInput = jest
      .fn()
      .mockReturnValueOnce("/path")
      .mockReturnValueOnce("direct_member");
    await main.main();
    expect(functions.getContents).toHaveBeenCalledTimes(1);
    expect(functions.createInvitation).toHaveBeenCalledTimes(0);
    expect(functions.setFailed).toHaveBeenCalledTimes(1);
    expect(functions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("parses the config and throws an exception due to an invalid email", async () => {
    const email = "user@email.com";
    setIssueBody(`<p>Email of Requester: ${email}</p>`);
    const errorMessage = `Email ${email} not from a valid domain`;

    core.getInput = jest
      .fn()
      .mockReturnValueOnce("/path")
      .mockReturnValueOnce("direct_member");
    await main.main();
    expect(functions.getContents).toHaveBeenCalledTimes(1);
    expect(functions.createInvitation).toHaveBeenCalledTimes(0);
    expect(functions.setFailed).toHaveBeenCalledTimes(1);
    expect(functions.setFailed).toHaveBeenCalledWith(errorMessage);
    expect(functions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("fails to get a good octokit instance and throws an exception", async () => {
    const errorMessage = "Failed to get a proper GitHub client.";
    GitHub.mockImplementation(() => {
      throw Error(errorMessage);
    });
    await main.main();

    expect(functions.getContents).toHaveBeenCalledTimes(0);
    expect(functions.createInvitation).toHaveBeenCalledTimes(0);
    expect(functions.setFailed).toHaveBeenCalledTimes(1);
    expect(functions.setFailed).toHaveBeenCalledWith(errorMessage);
    expect(functions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("validateConfig returns true with a valid configFile", () => {
    expect(main.validateConfig({ config: configFile })).toEqual(true);
  });

  it("validateConfig throws an error with a missing emailRule", () => {
    const invalidFile = {
      parsergRules: parserRules
    };

    // toThrow expects a function, so wrapping in an anonymous function
    expect(() => {
      main.validateConfig({ config: invalidFile });
    }).toThrowError("Config lacks valid email rule");
  });

  it("validateConfig throws an error with a missing parsingRule", () => {
    const invalidFile = {
      emailRule: emailRule
    };

    expect(() => {
      main.validateConfig({ config: invalidFile });
    }).toThrowError("Config lacks valid parser rules");
  });

  it("validateEmail returns true with a valid email", () => {
    expect(
      main.validateEmail({
        email: "user@email.com",
        emailRegex: ".*@email.com$"
      })
    ).toEqual(true);
  });

  it("validateEmail returns false with a valid email", () => {
    expect(
      main.validateEmail({
        email: "user@gmail.com",
        emailRegex: ".*@email.com$"
      })
    ).toEqual(false);
  });
});
