#!/usr/bin/env node

import { parseArgs } from "node:util";
import {
  updateMotifs,
  updateMotifsAll,
} from "../src/scripts/tei.mjs";
import { argOptions, INPUT_PATH } from "../src/scripts/constants.mjs";

const main = async (options) => {
  if (options.file) {
    await updateMotifs(options.file, options.outputPath);
  } else {
    await updateMotifsAll(options.inputPath || INPUT_PATH, options.file);
  }
};

const options = parseArgs(argOptions).values;

main(options);
