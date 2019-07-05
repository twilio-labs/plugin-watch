const { flags } = require('@oclif/command');
const { TwilioClientCommand } = require('@twilio/cli-core').baseCommands;
const { sleep } = require('@twilio/cli-core').services.JSUtils;
const moment = require('moment');
const querystring = require('querystring');

const STREAMING_DELAY_IN_SECONDS = 1;
const STREAMING_HISTORY_IN_MINUTES = 5;
const STREAMING_HISTORY_IN_MS = STREAMING_HISTORY_IN_MINUTES * 60 * 1000;

class Watch extends TwilioClientCommand {
  constructor(argv, config, secureStorage) {
    super(argv, config, secureStorage);

    this.showHeaders = true;
    this.latestLogEvents = {
      debugger: [],
      message: [],
      call: []
    };
  }

  async run() {
    await super.run();

    const props = this.parseProperties() || {};
    this.logger.info('Watching for alerts, messages, and calls...');

    // Get any historical data first so we know what's new
    props.startDate = new Date(new Date() - STREAMING_HISTORY_IN_MS);
    await this.getLogEvents(props);

    // Then get streaming data.
    /* eslint-disable no-await-in-loop, no-constant-condition */
    while (true) {
      props.startDate = new Date(new Date() - STREAMING_HISTORY_IN_MS);

      const logEvents = await this.getLogEvents(props);
      this.outputLogEvents(logEvents);

      await sleep(STREAMING_DELAY_IN_SECONDS * 1000);
    }
  }

  async getLogEvents(props) {
    try {
      const [logEvents, smsEvents, callEvents] = await Promise.all([
        this.twilioClient.monitor.alerts.list(props),
        this.twilioClient.messages.list({ dateSentAfter: props.startDate }),
        this.twilioClient.calls.list({ startTimeAfter: props.startDate })
      ]);

      return this.filterLogEvents(logEvents, 'debugger', e => e.sid)
        .map(e => ({
          date: this.formatDateTime(e.dateCreated),
          type: e.logLevel,
          code: e.errorCode,
          text: this.formatAlertText(e.alertText)
        }))
        .concat(
          this.filterLogEvents(smsEvents, 'message', e => e.sid + e.status).map(e => ({
            date: this.formatDateTime(e.dateUpdated),
            type: `message[${this.directionInOrOut(e, 'in', 'out')}]`,
            code: e.status,
            text: e.body
          }))
        )
        .concat(
          this.filterLogEvents(callEvents, 'call', e => e.sid + e.status).map(e => ({
            date: this.formatDateTime(e.dateUpdated),
            type: `call[${this.directionInOrOut(e, 'in', 'out')}]`,
            code: e.status,
            text: `FROM: ${e.from}, TO: ${e.to}`
          }))
        )
        .sort((a, b) => {
          if (a.date < b.date) {
            return -1;
          }
          return a.date > b.date ? 1 : 0;
        });
    } catch (err) {
      this.logger.error(err.message);
      this.exit(err.code);
    }
  }

  filterLogEvents(logEvents, eventType, keyFunc) {
    const previousLogEvents = new Set(this.latestLogEvents[eventType]);
    this.latestLogEvents[eventType] = new Set(logEvents.map(keyFunc));

    // Filter out any events that we just saw, and then reverse them so they're
    // in ascending order.
    return logEvents.filter(event => !previousLogEvents.has(keyFunc(event))).reverse();
  }

  directionInOrOut(message, inboundText, outboundText) {
    return message.direction.includes('out') ? outboundText : inboundText;
  }

  outputLogEvents(logEvents) {
    if (logEvents.length > 0) {
      this.output(logEvents, this.flags.properties, { showHeaders: this.showHeaders });
      this.showHeaders = false;
    }
  }

  formatDateTime(dateTime) {
    return moment(dateTime)
      .utc()
      .toISOString()
      .replace('T', ' ')
      .replace('.000Z', '');
  }

  formatAlertText(text) {
    try {
      const data = querystring.parse(text);
      return data.Msg || text;
    } catch (e) {
      return text;
    }
  }
}

Watch.description = 'Keep an eye on incoming alerts, messages, and calls. Polls every 1 second.';

Watch.flags = Object.assign(
  {
    properties: flags.string({
      default: 'date, type, code, text',
      description: 'The event properties you would like to display (date, type, code, & text)'
    })
  },
  Watch.PropertyFlags,
  TwilioClientCommand.flags
);

module.exports = Watch;
