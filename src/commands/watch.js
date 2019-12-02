const chalk = require('chalk');
const columnify = require('columnify');
const { flags } = require('@oclif/command');
const { TwilioClientCommand } = require('@twilio/cli-core').baseCommands;
const { OutputFormats } = require('@twilio/cli-core').services.outputFormats;
const { capitalize } = require('@twilio/cli-core').services.namingConventions;
const { sleep } = require('@twilio/cli-core').services.JSUtils;
const moment = require('moment');
const querystring = require('querystring');

const STREAMING_DELAY_IN_SECONDS = 1;
const STREAMING_HISTORY_IN_MINUTES = 5;
const STREAMING_HISTORY_IN_MS = STREAMING_HISTORY_IN_MINUTES * 60 * 1000;

function headingTransform(heading) {
  const capitalizeWords = ['Id', 'Sid', 'Iso', 'Sms', 'Url'];

  heading = heading.replace(/([A-Z])/g, ' $1');
  heading = capitalize(heading);
  heading = heading
    .split(' ')
    .map(word => (capitalizeWords.indexOf(word) > -1 ? word.toUpperCase() : word))
    .join(' ');
  return chalk.bold(heading);
}

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

    const logger = this.logger;

    if (process.platform === 'win32') {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.on('SIGINT', () => {
        process.emit('SIGINT');
      });
    }

    process.on('SIGINT', () => {
      // graceful shutdown
      logger.info('And now my watch is ended.');
      /* eslint-disable no-process-exit */
      process.exit();
    });

    const props = this.parseProperties() || {};
    logger.info('And now my watch begins. It shall not end until CTRL-C (SIGINT).');

    // Get any historical data first so we know what's new
    this.startDate = new Date(new Date() - STREAMING_HISTORY_IN_MS);
    const logEvents = await this.getLogEvents();
    if (props.showRecentHistory) {
      this.outputLogEvents(logEvents);
    }

    // Then get streaming data.
    /* eslint-disable no-await-in-loop, no-constant-condition */
    while (true) {
      this.startDate = new Date(new Date() - STREAMING_HISTORY_IN_MS);

      const logEvents = await this.getLogEvents();
      this.outputLogEvents(logEvents);

      await sleep(STREAMING_DELAY_IN_SECONDS * 1000);
    }
  }

  async getLogEvents() {
    try {
      const [logEvents, smsEvents, callEvents] = await Promise.all([
        this.twilioClient.monitor.alerts.list({ startDate: this.startDate }),
        this.twilioClient.messages.list({ dateSentAfter: this.startDate }),
        this.twilioClient.calls.list({ startTimeAfter: this.startDate })
      ]);

      return this.filterLogEvents(logEvents, 'debugger', e => e.sid)
        .map(e => ({
          date: this.formatDateTime(e.dateCreated),
          type: e.logLevel,
          code: e.errorCode,
          text: this.formatAlertText(e.alertText),
          raw: e
        }))
        .concat(
          this.filterLogEvents(smsEvents, 'message', e => e.sid + e.status).map(e => ({
            date: this.formatDateTime(e.dateUpdated),
            type: `message[${this.directionInOrOut(e, 'in', 'out')}]`,
            code: e.status,
            text: this.flags['no-pii'] ? e.body.length + ' chars' : e.body,
            raw: e
          }))
        )
        .concat(
          this.filterLogEvents(callEvents, 'call', e => e.sid + e.status).map(e => ({
            date: this.formatDateTime(e.dateUpdated),
            type: `call[${this.directionInOrOut(e, 'in', 'out')}]`,
            code: e.status,
            text: `FROM: ${this.redactPhone(e.from)}, TO: ${this.redactPhone(e.to)}`,
            raw: e
          }))
        )
        .sort((a, b) => {
          if (a.date < b.date) {
            return -1;
          }
          return a.date > b.date ? 1 : 0;
        });
    } catch (error) {
      this.logger.error(error.message);
      this.exit(error.code);
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

  redactPhone(num) {
    return this.flags['no-pii'] ? num.substring(0, 5) + num.substring(5).replace(/\d/g, '*') : num;
  }

  outputLogEvents(logEvents) {
    const COL_1 = 20;
    const COL_2 = 12;
    const COL_3 = 12;
    const COL_4 = process.stdout.columns - COL_1 - COL_2 - COL_3 - 3;

    if (logEvents.length > 0) {
      if (this.outputProcessor === OutputFormats.columns) {
        process.stdout.write(
          columnify(
            logEvents.map(e => {
              delete e.raw;
              return e;
            }),
            {
              truncate: true,
              showHeaders: this.showHeaders,
              config: {
                date: { minWidth: COL_1, maxWidth: COL_1, headingTransform },
                type: { minWidth: COL_2, maxWidth: COL_2, headingTransform },
                code: { minWidth: COL_3, maxWidth: COL_3, headingTransform },
                text: { minWidth: COL_4, maxWidth: COL_4, headingTransform }
              }
            }
          ) + '\n'
        );
      } else {
        this.output(logEvents, this.flags.properties, { showHeaders: this.showHeaders });
      }
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
      return data.parserMessage || data.Msg || text;
    } catch (e) {
      return text;
    }
  }
}

Watch.description = 'Keep an eye on incoming alerts, messages, and calls. Polls every 1 second.';

Watch.PropertyFlags = {
  'show-recent-history': flags.boolean({
    default: false,
    description: 'show recent events that occurred prior to beginning my watch'
  }),
  'no-pii': flags.boolean({
    default: false,
    description: 'mask columns that may contain personally identifiable information (PII)'
  })
};

Watch.flags = Object.assign(
  {
    properties: flags.string({
      default: 'date, type, code, text',
      description: 'event properties you would like to display'
    })
  },
  Watch.PropertyFlags,
  TwilioClientCommand.flags
);

module.exports = Watch;
