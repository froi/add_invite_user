/* global octomock */
const main = require("../src/main");

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
let buildContents = config => {
  return {
    data: {
      content: Buffer.from(JSON.stringify(config)).toString("base64")
    }
  };
};

octomock.mockFunctions.getContents.mockReturnValue(buildContents(configFile));
octomock.mockFunctions.setOutput.mockImplementation((name, value) => {
  return { [name]: value };
});

let updateConfigFile = config => {
  octomock.mockFunctions.getContents.mockReturnValue(buildContents(config));
};

beforeEach(() => {
  octomock.resetMocks();
  setIssueBody("<p>Email of Requester: user@gmail.com</p>");
  process.env.GITHUB_REPOSITORY = "testOwner/testRepo";
  let coreImpl = octomock.getCoreImplementation();
  coreImpl.getInput = jest
    .fn()
    .mockReturnValueOnce("/path")
    .mockReturnValueOnce("direct_member");
  octomock.updateCoreImplementation(coreImpl);
});

afterEach(() => {});

let ensureDefaultPayload = () => {
  if (!context.payload || !context.payload.issue) {
    context.payload = {
      issue: {
        body: "",
        user: {}
      }
    };
  }
};
let setIssueBody = body => {
  const context = octomock.getContext();
  context.payload.issue.body = body;
  octomock.updateContext(context);
};

let setIssueUser = user => {
  const context = octomock.getContext();
  context.payload.issue.user = user;
  octomock.updateContext(context);
};

describe("Main", () => {
  it("parses the parser rules and creates an invitation with a valid body", async () => {
    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("parses the parser rules and throws an exception with an invalid body", async () => {
    setIssueBody("Any test data without an email");
    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("parses the config and throws an exception due to an invalid email", async () => {
    const email = "user@email.com";
    setIssueBody(`<p>Email of Requester: ${email}</p>`);
    const errorMessage = `Email ${email} not from a valid domain`;

    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledWith(errorMessage);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("parses the config and throws an exception due to an invalid user that created the issue", async () => {
    const createdUser = "IAmAnInvalidUser";
    const errorMessage = `User that opened issue, ${createdUser} not a trusted user`;
    let oldConfigFile = configFile;
    oldConfigFile.trustedUserRule = {
      regex: "ValidUser"
    };
    updateConfigFile(oldConfigFile);

    setIssueUser({
      login: createdUser
    });

    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledWith(errorMessage);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
    
    setIssueUser({
        login: "ValidUser" 
    });
  });

  it("parses the config and throws an exception due to an invalid email", async () => {
    const email = "user@email.com";
    setIssueBody(`<p>Email of Requester: ${email}</p>`);
    const errorMessage = `Email ${email} not from a valid domain`;

    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledWith(errorMessage);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("parses the config and throws an exception due to an invalid user that created the issue", async () => {
    const createdUser = "IAmAnInvalidUser";
    const errorMessage = `User that opened issue, ${createdUser} not a trusted user`;
    let oldConfigFile = configFile;
    oldConfigFile.trustedUserRule = {
      regex: "ValidUser"
    };
    updateConfigFile(oldConfigFile);

    setIssueUser({
      login: createdUser
    });

    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledWith(errorMessage);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("fails to get a good octokit instance and throws an exception", async () => {
    const errorMessage = "Failed to get a proper GitHub client.";
    let ghImpl = octomock.getGitHubImplementation();
    ghImpl.GitHub = jest.fn(() => {
      throw Error(errorMessage);
    });
    octomock.updateGitHubImplementation(ghImpl);

    await main.main();

    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledWith(errorMessage);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("validateConfig returns true with a valid configFile", () => {
    expect(main.validateConfig({ config: configFile })).toEqual(true);
  });

  it("validateConfig throws an error with a missing emailRule", () => {
    const invalidFile = {
      parserRules: parserRules
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
