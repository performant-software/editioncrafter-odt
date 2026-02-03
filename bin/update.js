#!/usr/bin/env node

import { parseArgs } from "node:util";
import {
  updateTEI
} from "../src/scripts/tei.mjs";

const main = async () => {
  await updateTEI();
};

main();