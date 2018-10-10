'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function checkRequiredFiles(files) {
  let currentFilePath;
  try {
    files.forEach(filePath => {
      currentFilePath = filePath;
      fs.accessSync(filePath, fs.F_OK);
    });

    return true;
  } catch (err) {
    let dirName = path.dirname(currentFilePath);
    let fileName = path.basename(currentFilePath);

    console.log(chalk.red('Could not find a required file.'));
    console.log(chalk.red('  Name: ') + chalk.cyan(fileName));
    console.log(chalk.red('  Searched in: ') + chalk.cyan(dirName));
    return false;
  }
}

module.exports = checkRequiredFiles;