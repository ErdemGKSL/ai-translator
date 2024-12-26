import OpenAI from "openai";

export const openAi = new OpenAI({
  apiKey: process.env.OPENAI_KEY!
});

export async function translate(key: string,text: string, otherTranslations: { from: string, to: string }[], otherKeywords: { from: string, to: string }[]): Promise<{ translation: string; keywords: { from: string; to: string; }[]; }> {
  console.log(otherTranslations, otherKeywords);
  
  const response = await openAi.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a translator from ${process.env.SOURCE_LANGUAGE || "English"} to ${process.env.TARGET_LANGUAGE || "German"}. You will have other translations to keep in mind to use the same keywords for your translation.`
      },
      {
        role: "system",
        content: `Other translations: ${otherTranslations.map(t => `${t.from} -> ${t.to}`).join(", ")}`
      },
      {
        role: "system",
        content: `Other keywords: ${otherKeywords.map(t => `${t.from} -> ${t.to}`).join(", ")}`
      },
      {
        role: "system",
        content: process.env.PREPROMPT || "Translate the following users requested text."
      },
      {
        role: "user",
        content: `TextId: "${key}", Text to translate: "${text}"`
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
  
  return JSON.parse(response.choices[0].message.content as string) as any ;
}