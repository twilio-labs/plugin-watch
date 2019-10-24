@twilio-labs/plugin-watch
=========================

Access and stream your Twilio debugger logs along with your calls and messages.

[![Video overview](https://img.youtube.com/vi/2GRw-6dgMZ0/0.jpg)](https://www.youtube.com/watch?v=2GRw-6dgMZ0)

# Installation
```
twilio plugins:install @twilio-labs/plugin-watch
```

# Commands
<!-- commands -->
* [`twilio watch`](#twilio-watch)

## `twilio watch`

Keep an eye on incoming alerts, messages, and calls. Polls every 1 second.

```
USAGE
  $ twilio watch

OPTIONS
  -l=(debug|info|warn|error|none)  [default: info] Level of logging messages.
  -o=(columns|json|tsv)            [default: columns] Format of command output.
  -p, --profile=profile            Shorthand identifier for your Twilio profile.
  --no-pii                         mask columns that may contain personally identifiable information (PII)
  --properties=properties          [default: date, type, code, text] event properties you would like to display
  --show-recent-history            show recent events that occurred prior to beginning my watch
```

_See code: [src/commands/watch.js](https://github.com/twilio-labs/plugin-watch/blob/2.0.2/src/commands/watch.js)_
<!-- commandsstop -->
