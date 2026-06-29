import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  const dir = process.argv[2] ?? "./knowledge";
  const vs = await client.vectorStores.create({ name: "cryptosense-kb" });
  const files = fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .map((f) => fs.createReadStream(path.join(dir, f)));
  if (files.length) {
    await client.vectorStores.fileBatches.uploadAndPoll(vs.id, { files });
  }
  console.log("OPENAI_VECTOR_STORE_ID=" + vs.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
