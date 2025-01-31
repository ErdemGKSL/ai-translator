import { ChromaClient } from "chromadb";
import { openAi } from "./api";

const BASE_DB_NAME = process.env.DB_NAME || "translation";

const chroma = new ChromaClient({
  path: "http://localhost:8000"
});


export async function getCollection() {
  return [
    await chroma.getOrCreateCollection({
      name: BASE_DB_NAME + "_translations"
    }),
    await chroma.getOrCreateCollection({
      name: BASE_DB_NAME + "_keywords"
    })
  ]
}

export async function addTranslation(translation: {
  from: string,
  to: string
}) {
  const prompt = `Translate from "${translation.from}" to "${translation.to}"`

  const chatGptResponse = 
    await tryEmbeddings(prompt) ||
    await openAi.embeddings.create({
      input: prompt,
      model: "text-embedding-3-large",
    });

  const [translationCollections, keywordsCollection] = await getCollection();

  await translationCollections.add({
    embeddings: chatGptResponse.data.map(r => r.embedding),
    documents: [prompt],
    metadatas: [translation],
    ids: [translation.from]
  });
}

export async function addKeyword(keyword: {
  from: string,
  to: string
}) {
  const prompt = `Translate from "${keyword.from}" to "${keyword.to}"`

  const chatGptResponse = 
    await tryEmbeddings(prompt) ||
    await openAi.embeddings.create({
      input: prompt,
      model: "text-embedding-3-large",
    });

  const [translationCollections, keywordsCollection] = await getCollection();

  await keywordsCollection.add({
    embeddings: chatGptResponse.data.map(r => r.embedding),
    documents: [prompt],
    metadatas: [keyword],
    ids: [keyword.from.toLowerCase()]
  });
}

export async function find(prompt: string, size: number = 5): Promise<{ translations: { from: string; to: string; }[]; keywords: { from: string; to: string; }[]; }> {
  const chatGptResponse =
    await tryEmbeddings(prompt) ||
    await openAi.embeddings.create({
      input: prompt,
      model: "text-embedding-3-large",
    });

  const [translationCollections, keywordsCollection] = await getCollection();

  const translations = await translationCollections.query({
    queryEmbeddings: chatGptResponse.data.map(r => r.embedding),
    nResults: size
  }).then((r) => r.metadatas[0]).then(r => r.filter(e => e) as any);

  const keywords = await keywordsCollection.query({
    queryEmbeddings: chatGptResponse.data.map(r => r.embedding),
    nResults: size * 2
  }).then((r) => r.metadatas[0]).then(r => r.filter(e => e) as any);

  return {
    translations,
    keywords
  }
}

export async function resetCollection() {
  await chroma.deleteCollection({
    name: BASE_DB_NAME + "_translations"
  }).catch(console.log);

  await chroma.deleteCollection({
    name: BASE_DB_NAME + "_keywords"
  }).catch(console.log);

  return await getCollection();
}

export async function tryEmbeddings(content: string, tried = 0) {
  try {
    return await openAi.embeddings.create({
      input: content,
      model: "text-embedding-3-large",
    });
  } catch (e) {
    if (tried < 3) {
      await new Promise(r => setTimeout(r, 3000 * tried));
      return await tryEmbeddings(content, tried + 1);
    } else {
      throw e;
    }
  }
}