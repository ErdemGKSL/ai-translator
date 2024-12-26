import "./env";
import fs from "fs";
import { addKeyword, addTranslation, find, resetCollection } from "./collection";
import { translate } from "./api";

let output = {};

async function main() {
  const input = JSON.parse(await fs.promises.readFile("./input.json", "utf-8"));

  await resetCollection();

  output = await translateRecursive(input, undefined, []);

  await fs.promises.writeFile("./output.json", JSON.stringify(output, null, 2));
}

async function translateRecursive(input: any, key?: string, recursiveKeys: string[] = []) {
  if (typeof input === "string") {
    return await translateString(input, key!);
  } else if (Array.isArray(input)) {
    if (input.every(e => typeof e === "string")) {
      const fullText = input.join("\n");
      return (await translateString(fullText, key!)).split("\n");
    }
    return input;
  } else if (typeof input === "object") {
    let cOutput: any = {};
    for (const [key, value] of Object.entries(input)) {
      cOutput[key] = await translateRecursive(value, key, [...recursiveKeys, key]);

      if (typeof value === "string" || (Array.isArray(value) && value.every(e => typeof e === "string"))) {
        // set output's target key based on recursive keys
        output = recursiveKeys.reduce((acc, key, index) => {
          if (index === 0) {
            acc[key] = cOutput;
          } else {
            acc[key] = acc[key] || {};
            acc[key] = acc[key];
          }
          return acc;
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
  console.log(translated);
  for (const value of translated.keywords) {
    await addKeyword(value);
  }

  await addTranslation({
    from: input,
    to: translated.translation
  });

  return translated.translation;
}

main();