#!/usr/bin/env node

'use strict';
var spawn = require('cross-spawn');
const args = process.argv.slice(2);
const scriptIndex = args.findIndex(
  x => x === 'build' || x === 'start' // || x === 'eject' || x === 'test' 暂时屏蔽
)
const script = scriptIndex === -1 ? args[0] : args[scriptIndex];
const nodeArgs = scriptIndex > 0 ? args.slice(0, scriptIndex) : [];

console.log(args)
console.log(scriptIndex)
console.log(args.slice(scriptIndex + 1))

switch (script) {
  case 'build':
  case 'start': {
    const result = spawn.sync(
      'node',
      nodeArgs
        .concat(require.resolve('../scripts/' + script))
        .concat(args.slice(scriptIndex + 1)),
      { stdio: 'inherit' }
    );

    if (result.signal) {
      if (result.signal === 'SIGKILL') {
        console.log(
          'The build failed because the process exited too early. ' +
          'This probably means the system ran out of memory or someone called ' +
          '`kill -9` on the process.'
        );
      } else if (result.signal === 'SIGTERM') {
        console.log(
          'The build failed because the process exited too early. ' +
          'Someone might have called `kill` or `killall`, or the system could ' +
          'be shutting down.'
        );
      }
      process.exit(1);
    }
    process.exit(result.status);
    break;
  }
  default:
    console.log('Unknown script "' + script + '".');
    break;
}