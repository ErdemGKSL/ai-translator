import OpenAI from "openai";

export const openAi = new OpenAI({
  apiKey: process.env.OPENAI_KEY!
});

export async function translate(key: string, text: string, otherTranslations: { from: string, to: string }[], otherKeywords: { from: string, to: string }[]): Promise<{ translation: string; keywords: { from: string; to: string; }[]; }> {
  
  console.log({
    text,
    relatedTranslations: otherTranslations.map(t => t.from),
    relatedKeywords: otherKeywords.map(t => t.from)
  });

  const variables = text.match(/%[^%]+%|{[^}]+}/g) || [];

  for (const variable of variables) {
    otherKeywords.push({
      from: variable,
      to: variable
    });
  }

  const colorCodes = [
    "&0", "&1", "&2", "&3", "&4", "&5", "&6", "&7", "&8", "&9", "&a", "&b", "&c", "&d", "&e", "&f",
    "&k", "&l", "&m", "&n", "&o", "&r"
  ];

  for (const colorCode of colorCodes) {
    otherKeywords.push({
      from: colorCode,
      to: colorCode
    });
  }
  
  const response = await openAi.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a translator from ${process.env.SOURCE_LANGUAGE || "English"} to ${process.env.TARGET_LANGUAGE || "German"}. Extract keywords from the text that user provides. You will have other translations to keep in mind to use the same keywords for your translation.`
        + "\n" + `Other translations: ${otherTranslations.map(t => `"${t.from}" -> "${t.to}"`).join(", ")}`
        + "\n" + `Other keywords: ${otherKeywords.map(t => `"${t.from}" -> "${t.to}"`).join(", ")}`
        + "\n" + process.env.PREPROMPT
        + "\n" + `TextId: "${key}", Translate the following users requested text.`
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "translation_schema",
        schema: {
          type: "object",
          properties: {
            translation: {
              description: "The translated text",
              type: "string"
            },
            keywords: {
              description: "The keywords used in the translation",
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: {
                    type: "string",
                    description: "The keyword in the source language"
                  },
                  to: {
                    type: "string",
                    description: "The keyword in the target language"
                  }
                }
              }
            }
          },
          additionalProperties: false
        }
      }
    }
  });

  try {
    const result = JSON.parse(response.choices[0].message.content as string) as any;

    if (typeof result.translation === "object") {
      if (Array.isArray(result.translation)) {
        result.translation = result.translation[0];
      } else {
        result.translation = Object.values(result.translation).find((t) => typeof t === "string")
      }
    }

    if (typeof result.translation !== "string" || result.translation == "undefined") throw Error("Zortingenstrasse")

    console.log({
      result: result.translation,
    })
    
    return result;
  } catch {
    await new Promise(resolve => setTimeout(resolve, 1000 * 60));
    return await translate(key, text, otherTranslations, otherKeywords);
  }
}