import env from "@next/env";
import OpenAI from "openai";
env.loadEnvConfig(process.cwd());
const client = new OpenAI({ timeout: 15000, maxRetries: 0 });
try {
  const model = await client.models.retrieve(
    process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
  );
  console.log(JSON.stringify({ accessible: true, model: model.id }));
} catch (error) {
  console.log(
    JSON.stringify({
      accessible: false,
      status: error.status,
      code: error.code,
      name: error.name,
    }),
  );
  process.exitCode = 1;
}
