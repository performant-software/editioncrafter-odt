#!/usr/bin/env node

import { parseArgs } from "node:util";
import { createFilenameFromTitle, pullData } from "../src/scripts/tei.mjs";
import {
  argOptions,
  INPUT_PATH,
  OUTPUT_PATH,
} from "../src/scripts/constants.mjs";
import fs from "fs";

const main = async (options) => {
  if (options.mode === "all") {
    await pullData();
  } else if (options.series) {
    const filename = createFilenameFromTitle(options.series);
    await pullData(OUTPUT_PATH, [filename]);
  } else {
    const inputFiles = fs
      .readdirSync(INPUT_PATH)
      .filter((f) => f.toLowerCase().endsWith(".xml"))
      .map((f) => f.slice(0, -4));
    console.log(inputFiles);
    await pullData(OUTPUT_PATH, inputFiles);
  }
};

const options = parseArgs(argOptions).values;

main(options);
