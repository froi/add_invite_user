/* global octomock */
const main = require("../src/main");
const outdent = require("outdent");

const emailRule = {
  regex: ".*@gmail.com$"
};

const configFile = {
  emailRule: emailRule
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
    .mockReturnValueOnce("user@gmail.com")
    .mockReturnValueOnce("direct_member")
    .mockReturnValueOnce("@someOwner,@anotherOwner");
  octomock.updateCoreImplementation(coreImpl);
});

afterEach(() => {});

let setIssueBody = body => {
  const context = octomock.getContext();
  context.payload.issue.body = body;
  context.payload.issue.number = 1;
  octomock.updateContext(context);
};

let setIssueUser = user => {
  const context = octomock.getContext();
  context.payload.issue.user = user;
  context.payload.issue.number = 1;
  octomock.updateContext(context);
};

describe("Main", () => {
  it("parses the parser rules and creates an invitation with a valid body", async () => {
    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("Adds the retry label and adds a comment on the issue when it hits the rate limit", async () => {
    octomock.mockFunctions.createInvitation.mockReturnValue(
      Promise.reject({
        name: "HttpError",
        status: 422,
        headers: {},
        request: {},
        errors: [
          {
            resource: "OrganizationInvitation",
            code: "unprocessable",
            field: "data",
            message: "Over invitation rate limit"
          }
        ],
        documentation_url:
          "https://developer.github.com/v3/orgs/members/#create-organization-invitation"
      })
    );

    await main.main();
    expect(octomock.mockFunctions.addLabels).toHaveBeenCalledWith({
      org: "testOwner",
      repo: "testRepo",
      issue_number: 1,
      labels: ["retry"]
    });
  });

  it("Adds the automation-failed label and adds a comment on the issue when it hits the rate limit", async () => {
    octomock.mockFunctions.createInvitation.mockReturnValue(
      Promise.reject({
        name: "HttpError",
        status: 422,
        headers: {},
        request: {},
        errors: [
          {
            resource: "OrganizationInvitation",
            code: "unprocessable",
            field: "data",
            message: "Some Other Error"
          }
        ],
        documentation_url:
          "https://developer.github.com/v3/orgs/members/#create-organization-invitation"
      })
    );

    await main.main();
    expect(octomock.mockFunctions.addLabels).toHaveBeenCalledWith({
      org: "testOwner",
      repo: "testRepo",
      issue_number: 1,
      labels: ["automation-failed"]
    });
    expect(octomock.mockFunctions.createComment).toHaveBeenCalledWith({
      org: "testOwner",
      repo: "testRepo",
      issue_number: 1,
      body: outdent`Automation Failed:
            Org Admins will review the request and action it manually.
            CC: @someOwner,@anotherOwner`
    });
  });
  it("throws an error when an email is not provided", async () => {
    let coreImpl = octomock.getCoreImplementation();
    coreImpl.getInput = jest
      .fn()
      .mockReturnValueOnce("/path")
      .mockReturnValueOnce("direct_member");
    octomock.updateCoreImplementation(coreImpl);

    await main.main();
    expect(octomock.mockFunctions.getContents).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.createInvitation).toHaveBeenCalledTimes(0);
    expect(octomock.mockFunctions.setFailed).toHaveBeenCalledTimes(1);
    expect(octomock.mockFunctions.setOutput).toHaveBeenCalledTimes(2);
  });

  it("parses the config and throws an exception due to an invalid email", async () => {
    const email = "user@email.com";
    const errorMessage = `Email ${email} not from a valid domain`;
    let coreImpl = octomock.getCoreImplementation();
    coreImpl.getInput = jest
      .fn()
      .mockReturnValueOnce("/path")
      .mockReturnValueOnce(email)
      .mockReturnValueOnce("direct_member");
    octomock.updateCoreImplementation(coreImpl);

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
    const invalidFile = {};

    // toThrow expects a function, so wrapping in an anonymous function
    expect(() => {
      main.validateConfig({ config: invalidFile });
    }).toThrowError("Config lacks valid email rule");
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
