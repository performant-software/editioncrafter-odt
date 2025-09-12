#!/usr/bin/env node

import { parseArgs } from "node:util";
import { pullData } from "../src/scripts/tei.mjs";
import { argOptions, INPUT_PATH } from "../src/scripts/constants.mjs";
import fs from "fs";

const main = async (options) => {
  await pullData();
};

const options = parseArgs(argOptions).values;

main(options);
