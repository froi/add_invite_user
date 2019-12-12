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

let createInvitation = jest.fn().mockReturnValue(true);
let getContents = jest.fn().mockReturnValue({
  data: {
    content: Buffer.from(JSON.stringify(parsingRules)).toString("base64")
  }
});

beforeEach(() => {
  process.env.GITHUB_REPOSITORY = "testOwner/testRepo";

  const github = {
    repos: {
      getContents: getContents
    },
    orgs: {
      createInvitation: createInvitation
    }
  };

  context.repo = {
    owner: "owner",
    repo: "repo"
  };

  context.payload = {
    issue: {
      body: "<p>Email of Requester: user@email.com</p>"
    }
  };

  core.debug = message => {
    console.log(`MOCK DEBUG: ${message}`);
  };

  GitHub.mockImplementation(() => github);
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe("test", () => {
  it("tests stuff", async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce("/path")
      .mockReturnValueOnce("direct_member");
    await main.main();
    expect(getContents).toHaveBeenCalledTimes(1);
    expect(createInvitation).toHaveBeenCalledTimes(1);
  });
});
