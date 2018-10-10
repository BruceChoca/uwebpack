'use strict';

import chalk from 'chalk';
import { execSync } from 'child_process';
import spawn from 'cross-spawn';
import opn from 'opn';

const OSX_CHROME = 'google chrome';
const Actions = Object.freeze({
  NONE: 0,
  BROWSER: 1,
  SCRIPT: 2,
});

/**
 * Attempt to honor this environment variable.
 * It is specific to the operating system.
 * See https://github.com/sindresorhus/opn#app for documentation.
 */
function getBrowserEnv() {
  const value = process.env.BROWSER;

  let action;
  if (!value) {
    action = Actions.BROWSER;
  } else if (value.toLowerCase().endsWith('.js')) {
    action = Actions.SCRIPT;
  } else if (value.toLowerCase() === 'none') {
    action = Actions.NONE;
  } else {
    action = Actions.BROWSER;
  }

  return { action, value }
}

function executeNodeScript(scriptPath, url) {
  const extraArgs = process.argv.slice(2);
  const child = spawn('node', [scriptPath, ...extraArgs, url], {
    stdio: 'inherit'
  });
  child.on('close', code => {
    if (code !== 0) {
      console.log();
      console.log(chalk.red('The script specified as BROWSER environment variable failed.'));
      console.log(chalk.cyan(scriptPath) + ' exited with code ' + code + '.');
      console.log();
    }
  });

  return true;
}

function startBrowserProcess(browser, url) {
  // 判断是不是OS X，是则执行AppleScript打开
  const shouldTryOpenChromeWithAppleScript =
    process.platform === 'darwin' &&
    (typeof browser !== 'string' || browser === OSX_CHROME);

  if (shouldTryOpenChromeWithAppleScript) {
    try {
      execSync('ps cax | grep "Google Chrome"');
      execSync('osascript openChrome.applescript "' + encodeURI(url) + '"', {
        cwd: __dirname,
        stdio: 'ignore',
      });
      return true;
    } catch (err) {

    }
  }

  // Fallback to opn
  // (It will always open new tab)
  try {
    var options = { app: browser };
    opn(url, options).catch(() => { }); // Prevent `unhandledRejection` error.
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 通过命令或者opn打开浏览器
 * @param {string} url url
 */
function openBrowser(url) {
  const { action, value } = getBrowserEnv();
  switch (action) {
    case Actions.NONE:
      // Special case: BROWSER="none" will prevent opening completely.
      return false;
    case Actions.SCRIPT:
      return executeNodeScript(value, url);
    case Actions.BROWSER:
      return startBrowserProcess(value, url);
    default:
      throw new Error('Not implemented.');
  }
}

export default openBrowser;