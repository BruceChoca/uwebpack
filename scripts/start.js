
'use strict';

process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

require('../config/env');

// 加载.env环境变量
// require('../config/env');
// 验证核心依赖包
// const verifyPackageTree = require('./utils/verifyPackageTree');
// if (process.env.SKIP_PREFLIGHT_CHECK !== 'true') {
//   verifyPackageTree();
// }

import fs from 'fs';
import chalk from 'chalk';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import checkRequiredFiles from '../utils/checkRequiredFiles';
import clearConsole from '../utils/clearConsole';
import {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls
} from '../utils/webpackDevServerUtils';
import openBrowser from '../utils/openBrowser';
import paths from '../config/paths';
import config from '../config/webpack.config.dev';

