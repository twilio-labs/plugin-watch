const { expect, test } = require('@twilio/cli-test');
const { Config, ConfigData } = require('@twilio/cli-core').services.config;
const Watch = require('../../src/commands/watch');

const testConfig = test
  .stdout()
  .stderr()
  .twilioFakeProfile(ConfigData)
  .twilioCliEnv(Config);

describe('watch', () => {
  describe('streaming', function () {

    // TODO: write some tests :(

  });
});
