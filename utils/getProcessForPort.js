/**
 * 进程信息处理
 */
'use strict';

import chalk from 'chalk';
import { execSync, exec } from 'child_process';
import path from 'path';

var execOptions = {
  encoding: 'utf8',
  stdio: [
    'pipe', // stdin (default)
    'pipe', // stdout (default)
    'ignore', //stderr
  ],
};

/**
 * 根据命令字符判定是否uwebpack
 * @param {string} processCommand 命令字符串
 */
function isProcessAUWebpackApp(processCommand) {
  return /^node .*uwebpack\/scripts\/start\.js\s?$/.test(processCommand);
}
/**
 * 根据端口号获取进程id
 * @param {string} port 端口号
 */
function getProcessIdOnPort(port) {
  return execSync(`lsof -i ${port} -P -t -sTCP:LISTEN`, execOptions).split('\n')[0].trim();
}
/**
 * 根据目录获取package name
 * @param {string} directory 目录
 */
function getPackageNameInDirectory(directory) {
  let packagePath = path.join(directory.trim(), 'package.json');

  try {
    return require(packagePath).name;
  } catch (err) {
    return null;
  }
}
/**
 * 根据进程id和进程目录获取进程执行命令
 * @param {string} processId 进程id
 * @param {string} processDirectory 进程目录
 */
function getProcessCommand(processId, processDirectory) {
  let command = execSync(`ps -o command -p ${processId} | sed -n 2p`, execOptions);
  command = command.replace(/\n$/, '');

  if (isProcessAUWebpackApp(command)) {
    const packageName = getPackageNameInDirectory(processDirectory);
    return packageName || command;
  } else {
    return null;
  }
}
/**
 * 根据进程id获取执行目录
 * @param {string} processId 进程id
 */
function getDirectoryOfProcessId(processId) {
  return execSync(`lsof -p ${processId} | awk '$4="cwd" { for (i = 9; i < NF; i++) printf "%s ", $i}'`, execOptions).trim();
}
/**
 * 根据端口获取进程信息
 * @param {stirng} port 端口
 */
function getProcessForPort(port) {
  try {
    let processId = getProcessIdOnPort(port);
    let directory = getDirectoryOfProcessId(processId);
    let command = getProcessCommand(processId, directory);

    return (
      chalk.cyan(command) +
      chalk.grey(` (pid ${processId})\n`) +
      chalk.blue('  in ') +
      chalk.cyan(directory)
    )
  } catch (err) {
    return null
  }
}

export default getProcessForPort;


