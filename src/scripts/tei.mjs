import fs from "fs";
import {
  URI_PREFIX,
  OUTPUT_PATH,
  INPUT_PATH,
  BASE_API_URL,
  BASE_IIIF_URL,
} from "./constants.mjs";

const getData = async (dataType) => {
  let lastPage = false;
  let data = [];
  let page = 1;
  while (!lastPage) {
    const pageData = await fetch(
      `${BASE_API_URL}/${dataType}?page=${page}`
    ).then((res) => res.json());
    data = [...data, ...pageData.records];
    lastPage = !pageData.meta.has_next_page;
    page += 1;
  }
  return data;
};

const getMotifs = (motifs) => {
  let children = {};
  let xmlIds = {} //we'll keep a running list of XML IDs so we make sure to avoid duplicates
  for (const tag of motifs) {
    const tagChildren = motifs.filter(
      (t) => t.parent && t.parent.uri === tag.uri
    );
    children[tag.id] = tagChildren;
  }

  const parents = motifs.filter((t) => !t.parent);

  const getChildrenString = (tag, xmlIds) => {
    let xmlId = tag.label;
    //we're only going to give it an xml:id if it's a leaf
    if (!children[tag.id]?.length) {
      if (xmlIds[tag.label]) {
        xmlId += `_${xmlIds[tag.label].toString().padStart(2, '0')}`
        console.warn(`Motif ${tag.label} already exists; assigning xml:id ${xmlId} to ${URI_PREFIX}${tag.uri}`)
      }
      xmlIds[tag.label] ||= 0;
      xmlIds[tag.label] += 1;
    }
    let str = `<category ${!children[tag.id]?.length ? `n="${tag.label}" xml:id="${xmlId}" ` : ""
      }sameAs="${URI_PREFIX}${tag.uri}">\n<catDesc>${tag.name}</catDesc>\n`;
    if (!children[tag.id]?.length) {
      return str + "</category>";
    }
    for (const child of children[tag.id]) {
      str += getChildrenString(child, xmlIds);
    }
    return str + "</category>";
  };

  let encodingDesc =
    '<encodingDesc>\n<classDecl>\n<taxonomy xml:id="motifs">\n<bibl>Ornamental Motifs</bibl>\n';
  parents.forEach((tag) => {
    encodingDesc += getChildrenString(tag, xmlIds);
  });

  encodingDesc += "\n</taxonomy>\n</classDecl>\n</encodingDesc>";
  return encodingDesc;
};

const getHeaderData = (data, context) => {
  const { agents, people, holdings, languages, images, motifStr } = context;

  let fileDesc = `<fileDesc sameAs="${URI_PREFIX}${data.uri}"><titleStmt><title>${data.title}</title>`;
  let publicationStmt = "<publicationStmt>";
  let profileDesc = "<profileDesc><textClass><keywords>";
  let sourceDesc = "<sourceDesc>";
  const encodingDesc = motifStr;

  //for each agent associated to the series, find the person and role IDs

  data.agents?.forEach((agent) => {
    const agentData = agents.find((a) => a.uri === agent.uri);
    const person = agentData.person;
    const personFull = people.find((p) => p.uri === person.uri);
    const role = agentData.role;
    if (role.label === "Author") {
      fileDesc += `<author sameAs="${URI_PREFIX}${person.uri}"${personFull.authoritative_uri &&
        !personFull.authoritative_uri.includes("role=")
        ? ` ref="${personFull.authoritative_uri}"`
        : ""
        }>${person.label}</author>`;
    } else if (role.label === "Publisher") {
      publicationStmt += `<publisher sameAs="${URI_PREFIX}${person.uri}"${personFull.authoritative_uri &&
        !personFull.authoritative_uri.includes("role=")
        ? ` ref="${personFull.authoritative_uri}"`
        : ""
        }>${person.label}</publisher>`;
    } else if (role.label === "Designer" || role.label === "Printmaker") {
      fileDesc += `<respStmt sameAs="${URI_PREFIX}${agent.uri
        }"><resp sameAs="${URI_PREFIX}${role.uri}">${role.label
        }</resp><name sameAs="${URI_PREFIX}${person.uri}"${personFull.authoritative_uri &&
          !personFull.authoritative_uri.includes("role=")
          ? ` ref="${personFull.authoritative_uri}"`
          : ""
        }>${person.label}</name></respStmt>`;
    } else {
      profileDesc += `<term type="${role.label}" sameAs="${URI_PREFIX}${agent.uri}">${person.label}</term>`;
    }
  });

  if (data.city_of_production) {
    publicationStmt += `<pubPlace sameAs="${URI_PREFIX}${data.city_of_production.uri}">${data.city_of_production.label}</pubPlace>`;
  }

  if (data.date_label) {
    publicationStmt += `<date>${data.date_label}</date>`;
  }

  publicationStmt += "</publicationStmt>";
  fileDesc += "</titleStmt>" + publicationStmt;

  const classifications = ["media", "school", "themes"];

  for (const classType of classifications) {
    if (data[classType] && data[classType].length) {
      data[classType].forEach((item) => {
        profileDesc += `<term type="${classType}" sameAs="${URI_PREFIX}${item.uri}">${item.label}</term>`;
      });
    }
  }

  profileDesc += "</keywords></textClass><langUsage>";

  //deal with languages and holdings

  const seriesImages = images.filter((img) => img.series?.uri === data.uri);

  const seriesHoldings = [];
  const seriesLangs = [];

  for (const img of seriesImages) {
    if (img.holdings && img.holdings.length) {
      for (const holding of img.holdings) {
        if (!seriesHoldings.find((h) => h.uri === holding.uri)) {
          const holdingFull = holdings.find((h) => h.uri === holding.uri);
          if (holdingFull) {
            seriesHoldings.push(holdingFull);
            sourceDesc += `<msDesc sameAs="${URI_PREFIX}${holdingFull.uri}">
                    <msIdentifier>
                        <institution sameAs="${URI_PREFIX}${holdingFull.institution?.uri}">${holdingFull.institution?.label}</institution>
                        <idno type="URI">${holdingFull.url}</idno>
                        <idno>${holdingFull.identifier}</idno>
                    </msIdentifier>
                    <p>${holdingFull.label}</p>
                </msDesc>`;
          }
        }
      }
    }
    if (img.languages && img.languages.length) {
      for (const lang of img.languages) {
        if (!seriesLangs.find((l) => l.uri === lang.uri)) {
          const langFull = languages.find((l) => l.uri === lang.uri);
          seriesLangs.push(langFull);
          profileDesc += `<language ident="${langFull.iso_code}">${langFull.label}</language>`;
        }
      }
    }
  }

  sourceDesc += "</sourceDesc>";
  fileDesc += sourceDesc + "</fileDesc>";
  profileDesc += "</langUsage></profileDesc>";

  return (
    '<teiHeader xml:id="header">' +
    fileDesc +
    profileDesc +
    encodingDesc +
    "</teiHeader>"
  );
};

const getSurfaceData = async (series, allImages) => {
  let transcription = '<text xml:id="transcription"><body>';
  let translation = '<text xml:id="translation"><body>';
  let facs = '<facsimile xml:id="prints">';

  const seriesImages = allImages
    .filter((i) => i.series?.uri === series)
    .sort((a, b) => a.seq_no - b.seq_no);
  for (const img of seriesImages) {
    const fullImg = await fetch(`${BASE_API_URL}/Image/${img.id}`).then((res) =>
      res.json()
    );
    const xmlId = "f" + String(img.seq_no).padStart(4, "0");
    const iiif = fullImg.external_iiif_url
      ? fullImg.external_iiif_url
      : fullImg.image
        ? `${BASE_IIIF_URL}${fullImg.image?.path}`
        : undefined;
    facs += `<surface xml:id="${xmlId}" ulx="0" uly="0" lrx="1000" lry="800" sameAs="${img.uri
      }"><label>${img.label}</label><graphic mimeType="application/json" url="${iiif || ""
      }" /></surface>`;
    if (img.transcription) {
      transcription += `<pb facs="#${xmlId}" /><div facs="#${xmlId}"><p>${img.transcription.replaceAll(
        "&",
        "&amp;"
      )}</p></div>`;
    }
    if (img.translation) {
      translation += `<pb facs="#${xmlId}" /><div facs="#${xmlId}"><p>${img.translation.replaceAll(
        "&",
        "&amp;"
      )}</p></div>`;
    }
  }

  facs += "</facsimile>";
  if (!transcription.includes("<div")) {
    transcription += "<div></div>";
  }
  translation += "</body></text>";
  if (!translation.includes("<div")) {
    translation += "<div></div>";
  }
  transcription += "</body></text>";

  return transcription + translation + facs;
};

export const createFilenameFromTitle = (title) => {
  const fileNameRaw = title
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("\n", "")
    .replaceAll(".", "");
  const fileName = fileNameRaw[0] == "_" ? fileNameRaw.slice(1) : fileNameRaw;
  return fileName;
};

const writeFullTEI = async (data, context, outputPath = OUTPUT_PATH) => {
  const header = getHeaderData(data, context);
  const surfaces = await getSurfaceData(data.uri, context.images);
  const teiString =
    '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + header + surfaces + "</TEI>";
  const fileName = createFilenameFromTitle(data.title);
  fs.writeFileSync(`${outputPath}/${fileName}.xml`, teiString);
};

const writeHeader = (data, filePath) => {
  const path =
    filePath ||
    `${OUTPUT_PATH}/${data.title
      .toLowerCase()
      .replaceAll(" ", "_")
      .replaceAll("\n", "")
      .replaceAll(".", "")}.xml`;
  const teiString = fs.readFileSync(path, { encoding: "utf-8" });
  const newString =
    teiString.split("<teiHeader")[0] +
    getHeaderData(data) +
    teiString.split("</teiHeader>")[1];
  fs.writeFileSync(path, newString);
};

const writeMotifs = (motifString, inputPath, outputPath) => {
  const path =
    inputPath ||
    `${OUTPUT_PATH}/${data.title
      .toLowerCase()
      .replaceAll(" ", "_")
      .replaceAll("\n", "")
      .replaceAll(".", "")}.xml`;
  const output = outputPath || path;
  let teiString = fs.readFileSync(path, { encoding: "utf-8" });
  //if there's an existing encodingDesc, excise it
  if (teiString.includes('<encodingDesc')) {
    teiString = teiString.split('<encodingDesc')[0] + teiString.split('</encodingDesc>')[1]
  }
  const newString =
    teiString.split("</teiHeader>")[0] +
    motifString +
    "\n</teiHeader>" +
    teiString.split("</teiHeader>")[1];
  fs.writeFileSync(output, newString);
};

const main = async () => {
  const series = await getData("Series");
  const agents = await getData("Agent");
  const people = await getData("Person");
  const holdings = await getData("Holding");
  const languages = await getData("Language");
  const images = await getData("Image");
  const motifs = await getData("Motif");
  const motifStr = getMotifs(motifs)
  for (const ser of series) {
    console.log(ser.title);
    await writeFullTEI(ser, {
      agents,
      people,
      holdings,
      languages,
      images,
      motifStr,
    });
  }
};

export const pullData = async (outputPath = OUTPUT_PATH, inputSeries) => {
  let series = await getData("Series");
  const agents = await getData("Agent");
  const people = await getData("Person");
  const holdings = await getData("Holding");
  const languages = await getData("Language");
  const images = await getData("Image");
  const motifs = await getData("Motif");
  const motifStr = getMotifs(motifs)
  if (inputSeries) {
    series = series.filter((ser) =>
      inputSeries.includes(createFilenameFromTitle(ser.title))
    );
  }
  for (const ser of series) {
    console.log(`Processing ${ser.title}...`);
    await writeFullTEI(
      ser,
      {
        agents,
        people,
        holdings,
        languages,
        images,
        motifStr,
      },
      outputPath
    );
  }
};

export const updateMotifsAll = async (
  inputPath = INPUT_PATH,
  outputPath = OUTPUT_PATH
) => {
  if (!fs.existsSync(inputPath)) {
    console.log(inputPath);
    console.error("The specified folder does not exist.");
    process.exit(1);
  }
  const files = fs.readdirSync(inputPath);
  const motifs = await getData("Motif");
  const motifStr = getMotifs(motifs);
  for (const file of files.filter((f) => f !== ".keep")) {
    await updateMotifs(`${inputPath}/${file}`, outputPath, motifStr);
  }
};

export const updateMotifs = async (filePath, outputPath = OUTPUT_PATH, motifStr) => {
  if (!fs.existsSync(filePath)) {
    console.error(`File ${filePath} does not exist.`);
    process.exit(1);
  }
  if (!filePath.toLowerCase().endsWith(".xml")) {
    console.error(`File ${filePath} is not an XML file.`);
    process.exit(1);
  }
  const file = filePath.split("/").slice(-1)[0];
  console.log(`Processing file ${file}`);
  let str = motifStr
  if (!str) {
    const motifs = await getData("Motif");
    str = getMotifs(motifs);
  }
  writeMotifs(str, filePath, `${outputPath}/${file}`);
};
