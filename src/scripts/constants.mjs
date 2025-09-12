export const URI_PREFIX = "https://corpora.dh.tamu.edu";

export const OUTPUT_PATH = "data/processing_output";

export const INPUT_PATH = "data/for_processing";

export const BASE_API_URL =
  "https://corpora.dh.tamu.edu/api/corpus/6285564874d5f7a229b60520";

export const BASE_IIIF_URL = "https://corpora.dh.tamu.edu/iiif/2";

export const argOptions = {
  options: {
    file: {
      type: "string",
      short: "f",
    },
    inputPath: {
      type: "string",
      short: "p",
    },
    outputPath: {
      type: "string",
      short: "o",
    },
  },
};
