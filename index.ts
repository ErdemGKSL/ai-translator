import "./env";
import fs from "fs";
import { addKeyword, addTranslation, find, resetCollection } from "./collection";
import { translate } from "./api";
import yaml from "yaml";

let output = {};

const onlyKeys = process.env.ONLY_KEYS?.split(",").map(e => e.trim()) || [];

async function main() {
  if (fs.existsSync("./input.yaml")) {
    const input = yaml.parse(await fs.promises.readFile("./input.yaml", "utf-8"));
    await fs.promises.writeFile("./input.json", JSON.stringify(input, null, 2));
  }

  await resetCollection();

  if (fs.existsSync("./prekeywords.json")) {
    const prekeywords = JSON.parse(await fs.promises.readFile("./prekeywords.json", "utf-8"));

    for (let value of prekeywords) {
      await addKeyword(value);
    }
  }

  const input = JSON.parse(await fs.promises.readFile("./input.json", "utf-8"));

  output = await translateRecursive(input, undefined, []);

  await fs.promises.writeFile("./output.json", JSON.stringify(output, null, 2));
  if (fs.existsSync("./input.yaml")) {
    await fs.promises.writeFile("./output.yaml", yaml.stringify(output));
  }
}

async function translateRecursive(input: any, key?: string, recursiveKeys: string[] = []) {
  if (typeof input === "string") {
    if ((process.env.ONLY_KEYS?.length || 0) > 0) {
      if (!key) return input;
      if (!onlyKeys.includes(key)) return input;
    }
    return await translateString(input, key!);
  } else if (Array.isArray(input)) {
    if (input.every(e => typeof e === "string")) {
      if ((process.env.ONLY_KEYS?.length || 0) > 0) {
        if (!key) return input;
        if (!onlyKeys.includes(key)) return input;
      }
      const fullText = input.join("\\n");
      const resultText = (await translateString(fullText, key!));
      return ((resultText as any)?.[key as any] || resultText).split(/\n|\\n/);
    }
    return input;
  } else if (typeof input === "object") {
    let cOutput: any = {};
    for (const [key, value] of Object.entries(input)) {
      cOutput[key] = await translateRecursive(value, key, [...recursiveKeys, key]);

      if (typeof value === "string" || (Array.isArray(value) && value.every(e => typeof e === "string"))) {
        // set output's target key based on recursive keys
        recursiveKeys.reduce((acc, key, index) => {
          if (index === recursiveKeys.length - 1) {
            acc[key] = cOutput;
          } else {
            acc[key] = acc[key] || {};
          }
          return acc[key];
        }, output);

        await fs.promises.writeFile("./output.json", JSON.stringify(output, null, 2));
      }
    }
    return cOutput;
  } else {
    return input;
  }
}

async function translateString(input: string, key: string) {
  const { translations, keywords } = await find(input);
  const translated = await translate(key, input, translations, keywords);

  if (translated.keywords?.length > 0) {
    for (let value of translated.keywords) {
      let raw = { ...value };
      if (typeof value.from != "string") continue;


      if (value.from.startsWith("&") && value.from.length >= 2) {
        value.from = value.from.slice(2);
        value.to = value.to.slice(2);
      }

      if (
        (
          value.from.startsWith("%") && value.from.endsWith("%")
        ) || (
          value.from.startsWith("{") && value.from.endsWith("}")
        ) || (
          value.from.startsWith("$") && value.from.endsWith("$")
        ) || (
          value.from.startsWith("&") && value.from.length === 2
        ) ||
        !value.from.trim().length
      ) {
        console.log("Skipped", [raw.from, raw.to]);
        continue;
      }

      await addKeyword(value);
    }
  }

  

  await addTranslation({
    from: input,
    to: translated.translation
  });

  return translated.translation;
}

main();