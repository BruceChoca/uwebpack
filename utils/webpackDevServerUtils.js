'use strict';

const address = require('address');
const fs = require('fs');
const path = require('path');
const url = require('url');
const chalk = require('chalk');
const detect = require('detect-port-alt');   // 端口检测
const isRoot = require('is-root');           // 检测是否root用户
const inquirer = require('inquirer');        // 命令行交互工具
const clearConsole = require('./clearConsole');
const formatWebpackMessages = require('./formatWebpackMessages');
const getProcessForPort = require('./getProcessForPort');

const isInteractive = process.stdout.isTTY;

let hanldeCompile;
const isSmokeTest = process.argv.some(arg => arg.indexOf('--smoke-test') > -1);
if (isSmokeTest) {
  hanldeCompile = (err, state) => {
    if (err || state.hasErrors() || state.hasWarnings()) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

/**
 * 处理url信息
 * @param {string} protocol http协议
 * @param {string} host host
 * @param {string} port port
 */
function prepareUrls(protocol, host, port) {
  const formatUrl = hostname =>
    url.format({
      protocol,
      hostname,
      port,
      pathname: '/',
    });
  const prettyPrintUrl = hostname =>
    url.format({
      protocol,
      hostname,
      port: chalk.bold(port),
      pathname: '/',
    });

  const isUnspecifiedHost = host === '0.0.0.0' || host === '::';
  let prettyHost, lanUrlForConfig, lanUrlForTerminal;
  if (isUnspecifiedHost) {
    prettyHost = 'localhost';
    try {
      lanUrlForConfig = address.ip();
      if (lanUrlForConfig) {
        // Check if the address is a private ip
        // https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces
        if (/^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(lanUrlForConfig)) {
          lanUrlForTerminal = prettyPrintUrl(lanUrlForConfig);
        } else {
          lanUrlForTerminal = undefined;
        }
      }
    } catch (err) {
      // ignored
    }
  } else {
    prettyHost = host;
  }

  const loaclUrlForTerminal = prettyPrintUrl(prettyHost);
  const localUrlForBrowser = formatUrl(prettyHost);

  return {
    lanUrlForConfig,
    lanUrlForTerminal,
    loaclUrlForTerminal,
    localUrlForBrowser
  }
}

/**
 * 处理打印输出信息
 * @param {string} appName appName
 * @param {object} urls urls info
 * @param {boolean} useYarn 是否使用yarn
 */
function printInstructions(appName, urls, useYarn) {
  console.log();
  console.log(`You can now view ${chalk.bold(appName)} in the browser.`);
  console.log();

  if (urls.lanUrlForTerminal) {
    console.log(`  ${chalk.bold('Local:')}            ${urls.localUrlForTerminal}`);
    console.log(`  ${chalk.bold('On Your Network:')}  ${urls.lanUrlForTerminal}`);
  } else {
    console.log(`  ${urls.localUrlForTerminal}`);
  }

  console.log();
  console.log('Note that the development build is not optimized');
  console.log(`To create a production build, use ${chalk.cyan(`${useYarn ? 'yarn' : 'npm'} build`)}.`);
  console.log();
}

/**
 * 创建自定义webpack compiler
 * @param {function} webpack webpack
 * @param {Object} config webpackConfig
 * @param {string} appName appName
 * @param {Object} urls urls info
 * @param {boolean} useYarn 是否yarn
 */
function createCompiler(webpack, config, appName, urls, useYarn) {
  // Compiler：webpack提供的一个接口，
  // 方便通过钩子监听部分webpack事件并进行自定义处理
  let complier;

  try {
    complier = webpack(config, hanldeCompile);
  } catch (err) {
    console.log(chalk.red('Failed to compile.'));
    console.log();
    console.log(err.message || err);
    console.log();
    process.exit(1);
  }

  // 处理"invalid"事件
  // "invalid"在改变文件时触发，webpack重新编译新bundle，替换旧的
  // bundle invalidated
  complier.hooks.invalid.tap('invalid', () => {
    if (isInteractive) {
      clearConsole();
    }
    console.log('Compiling...');
  });

  let isFirstCompile = true;

  // 处理"done"事件
  // webpack重新编译完成时触发，无论是否有error或warn
  complier.hooks.done.tap('done', stats => {
    if (isInteractive) {
      clearConsole();
    }

    const messages = formatWebpackMessages(stats.toJson());
    const isSuccessful = !messages.errors.length && !messages.warnings.length;
    if (isSuccessful) {
      console.log(chalk.green('Compiled successfully!'));
    }

    if (isSuccessful && (isInteractive || isFirstCompile)) {
      printInstructions(appName, urls, useYarn)
    }

    isFirstCompile = false;

    if (messages.errors.length) {
      if (messages.errors.length > 1) {
        messages.errors.length = 1;
      }

      console.log(chalk.red('Failed to compile.\n'));
      console.log(messages.errors.join('\n\n'));
      return;
    }

    if (messages.warnings.length) {
      console.log(chalk.yellow('Compiled with warning.\n'));
      console.log(messages.warnings.join('\n\n'));

      console.log(
        '\nSearch for the ' +
        chalk.underline(chalk.yellow('keywords')) +
        ' to learn more about each warning.'
      );
      console.log(
        'To ignore, add ' +
        chalk.cyan('// eslint-disable-next-line') +
        ' to the line before.\n'
      );
    }
  });

  return complier;
}

function resolveLoopback(proxy) {
  const o = url.parse(proxy);
  o.host = undefined;
  if (o.hostname !== 'localhost') {
    return proxy;
  }

  try {
    if (!address.ip()) {
      o.hostname = '127.0.0.1';
    }
  } catch (err) {
    o.hostname = '127.0.0.1';
  }

  return url.format(o);
}

/**
 * 处理代理异常
 * @param {string} proxy 代理
 */
function onProxyError(proxy) {
  return (err, req, res) => {
    const host = req.headers && req.headers.host;
    console.log(
      `${chalk.red('Proxy Error:')} Could not proxy request ${chalk.cyan(req.url)} from ${chalk.cyan(host)} to ${chalk.cyan(proxy)}.`
    );
    console.log(
      `See https://nodejs.org/api/errors.html#errors_common_system_errors for more information (${chalk.cyan(err.code)}).`
    );
    console.log();

    if (res.writeHead && !res.headersSent) {
      res.writeHead(500);
    }

    res.send(`Proxy error: Could not proxy request ${req.url} from ${host} to ${proxy} (${err.code}).`);
  }
}

function prepareProxy(proxy, appPublicFolder) {
  if (!proxy) {
    return undefined;
  }

  if (typeof proxy !== 'object' && typeof proxy !== 'string') {
    console.log(chalk.red('When specified, "proxy" in package.json must be a string or an object.'));
    console.log(chalk.red(`Instead, the type of "proxy" was "${typeof proxy}".`));
    console.log(chalk.red('Either remove "proxy" from package.json, or make it an object'));

    process.exit(1)
  }

  function mayProxy(pathname) {
    const maybePublicPath = path.resolve(appPublicFolder, pathname.slice(1));
    return !fs.existsSync(maybePublicPath);
  }

  if (typeof proxy === 'string') {
    if (!/^http(s)?:\/\//.test(proxy)) {
      console.log(
        chalk.red('When "proxy" is specified in package.json it must start with either http:// or https://')
      );
      process.exit(1);
    }

    let target;
    if (process.platform === 'win32') {
      target = resolveLoopback(proxy);
    } else {
      target = proxy;
    }

    return [
      {
        target,
        logLevel: 'slient',
        context: function (pathname, req) {
          return (
            req.method !== 'GET' ||
            (mayProxy(pathname)) &&
            req.headers.accept &&
            req.headers.accept.indexOf('text/html') === -1
          )
        },
        onProxyReq: proxyReq => {
          if (proxyReq.getHeader('origin')) {
            proxyReq.setHeader('origin', target);
          }
        },
        onError: onProxyError(target),
        secure: false,
        changeOrigin: true,
        ws: true,
        xfwd: true,
      }
    ]
  }

  // Otherwise, proxy is an object so create an array of proxies to pass to webpackDevServer
  return Object.keys(proxy).map(function (context) {
    if (!proxy[context].hasOwnProperty('target')) {
      console.log(
        chalk.red(
          'When `proxy` in package.json is as an object, each `context` object must have a ' +
          '`target` property specified as a url string'
        )
      );
      process.exit(1);
    }
    let target;
    if (process.platform === 'win32') {
      target = resolveLoopback(proxy[context].target);
    } else {
      target = proxy[context].target;
    }
    return Object.assign({}, proxy[context], {
      context: function (pathname) {
        return mayProxy(pathname) && pathname.match(context);
      },
      onProxyReq: proxyReq => {
        // Browers may send Origin headers even with same-origin
        // requests. To prevent CORS issues, we have to change
        // the Origin to match the target URL.
        if (proxyReq.getHeader('origin')) {
          proxyReq.setHeader('origin', target);
        }
      },
      target,
      onError: onProxyError(target),
    });
  });
}

function choosePort(host, defaultPort) {
  return detect(defaultPort, host).then(
    port =>
      new Promise(resolve => {
        if (port === defaultPort) {
          return resolve(port);
        }
        const message =
          process.platform !== 'win32' && defaultPort < 1024 && !isRoot()
            ? `Admin permissions are required to run a server on a port below 1024.`
            : `Something is already running on port ${defaultPort}.`;
        if (isInteractive) {
          clearConsole();
          const existingProcess = getProcessForPort(defaultPort);
          const question = {
            type: 'confirm',
            name: 'shouldChangePort',
            message:
              chalk.yellow(
                message +
                `${existingProcess ? ` Probably:\n  ${existingProcess}` : ''}`
              ) + '\n\nWould you like to run the app on another port instead?',
            default: true,
          };
          inquirer.prompt(question).then(answer => {
            if (answer.shouldChangePort) {
              resolve(port);
            } else {
              resolve(null);
            }
          });
        } else {
          console.log(chalk.red(message));
          resolve(null);
        }
      }),
    err => {
      throw new Error(
        chalk.red(`Could not find an open port at ${chalk.bold(host)}.`) +
        '\n' +
        ('Network error message: ' + err.message || err) +
        '\n'
      );
    }
  );
}

module.exports = {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls,
}