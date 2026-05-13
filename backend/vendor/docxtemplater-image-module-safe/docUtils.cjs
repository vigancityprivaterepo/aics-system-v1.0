"use strict";

const DocUtils = require("docxtemplater").DocUtils;

DocUtils.convertPixelsToEmus = function convertPixelsToEmus(pixel) {
  return Math.round(pixel * 9525);
};

module.exports = DocUtils;
