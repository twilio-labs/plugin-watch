const { expect, test } = require('@twilio/cli-test');
const { Config, ConfigData } = require('@twilio/cli-core').services.config;
const Watch = require('../../src/commands/watch');

/* eslint-disable camelcase */
const INFO_LOG = {
  sid: 'NO11111111111111111111111111111111',
  log_level: 'info',
  error_code: '11111',
  alert_text: 'My name is "Sue"!',
  date_created: '1969-02-24T19:39:29Z'
};

const WARN_LOG = {
  sid: 'NO22222222222222222222222222222222',
  log_level: 'warning',
  error_code: '22222',
  alert_text: 'How do you do!?',
  date_created: '1969-02-24T20:40:30Z'
};
/* eslint-enable camelcase */

const testConfig = test
  .stdout()
  .stderr()
  .twilioFakeProject(ConfigData)
  .twilioCliEnv(Config);

describe('watch', () => {
  describe('historical', () => {
    const testHelper = (args, responseCode, responseBody) =>
      testConfig
        .nock('https://monitor.twilio.com', api => {
          api
            .get('/v1/Alerts')
            .query(true)
            .reply(responseCode, responseBody);
        })
        .twilioCommand(Watch, args);

    testHelper([], 200, { alerts: [INFO_LOG] }).it('prints alert/log events', ctx => {
      expect(ctx.stdout).to.contain(INFO_LOG.alert_text);
    });

    testHelper(['--start-date', '2000-01-01', '--end-date', '2001-01-01'], 200, { alerts: [WARN_LOG] }).it(
      'accepts date args',
      ctx => {
        expect(ctx.stdout).to.contain(WARN_LOG.alert_text);
      }
    );

    testHelper([], 404, { code: 12345, message: 'Now you gonna die!' })
      .exit(12345)
      .it('prints errors', ctx => {
        expect(ctx.stderr).to.contain('Now you gonna die!');
      });
  });

  describe('streaming', function () {
    // Give the stream enough time to complete.
    this.timeout(5000);

    testConfig
      .nock('https://monitor.twilio.com', api => {
        api
          .get('/v1/Alerts')
          .query(true)
          .times(2)
          .reply(200, { alerts: [INFO_LOG, WARN_LOG, INFO_LOG] })
          .get('/v1/Alerts')
          .query(true)
          .reply(404, { code: 999, message: 'Now you gonna die!' });
      })
      .twilioCommand(Watch, ['--streaming'])
      .exit(999)
      .it('streams and then quits', ctx => {
        expect(ctx.stdout.match(INFO_LOG.error_code)).to.have.length(1);
        expect(ctx.stdout.match(WARN_LOG.alert_text)).to.have.length(1);

        expect(ctx.stderr).to.contain('Now you gonna die!');
      });

    testConfig
      .twilioCommand(Watch, ['--streaming', '--end-date', '2020-01-01'])
      .exit(1)
      .it('does not like end dates when steaming');

    testConfig
      .twilioCommand(Watch, ['--streaming', '--start-date', '3005-01-01'])
      .exit(1)
      .it('does not like futuristic stat dates');
  });
});
