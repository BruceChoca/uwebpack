'use strict';

const escapeStringRegexp = require('escape-string-regexp');

/**
 * 新建插件替换自定义配置字段
 * PUBLIC_URL REACT_APP_XXX等
 * .env
 */
module.exports = class InterpolateHtmlPlugin {
  constructor(replacements) {
    this.replacements = replacements;
  }

  apply(complier) {
    complier.hooks.compilation.tap('InterpolateHtmlPlugin', compilation => {
      compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tap(
        'InterpolateHtmlPlugin',
        data => {
          // 替换html中的%相关文件%
          Object.keys(this.replacements).forEach(key => {
            const value = this.replacements[key];
            data.html = data.html.replace(
              new RegExp('%' + escapeStringRegexp(key) + '%', 'g'),
              value
            );
          });
        }
      )
    });
  }
}