// AI PROVIDER: Currently using Gemini (free tier).
// TO SWITCH TO ANTHROPIC: 
//   1. npm install @anthropic-ai/sdk
//   2. Replace the import and generateWithProvider function below
//   3. Change ANTHROPIC_API_KEY in .env.local

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export type CampaignTone = "friendly" | "professional" | "urgent";
export type CampaignType = "welcome" | "nurture" | "promotional";

export type GeneratedCampaign = {
  subject: string;
  body: string;
  tokensUsed: number;
};

async function generateWithProvider(prompt: string): Promise<{ text: string; tokensUsed: number }> {
  // ── GEMINI (current) ──────────────────────────────────────────────
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;
  return { text, tokensUsed };

  // ── ANTHROPIC (swap to this when ready) ──────────────────────────
  // import Anthropic from "@anthropic-ai/sdk";
  // const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // const message = await client.messages.create({
  //   model: "claude-opus-4-6",
  //   max_tokens: 400,
  //   messages: [{ role: "user", content: prompt }],
  // });
  // const text = message.content[0].type === "text" ? message.content[0].text : "";
  // const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;
  // return { text, tokensUsed };
}

export async function generateCampaign(
  businessDescription: string,
  tone: CampaignTone,
  campaignType: CampaignType
): Promise<GeneratedCampaign> {
  const prompt = `You are an email marketing expert. Write a ${tone} ${campaignType} email for this business: "${businessDescription}".

Rules:
- Subject line: max 60 characters, no clickbait
- Body: max 150 words, plain text only
- Include one clear call to action
- Use {name} when personalizing the recipient in the body
- No spam trigger words (free, winner, urgent, guaranteed)
- No HTML tags

Respond in this exact format with no extra text:
SUBJECT: [subject line here]
BODY:
[email body here]`;

  const { text, tokensUsed } = await generateWithProvider(prompt);

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);

  if (!subjectMatch || !bodyMatch) {
    throw new Error("AI returned unexpected format. Please try again.");
  }

  return {
    subject: subjectMatch[1].trim(),
    body: bodyMatch[1].trim(),
    tokensUsed,
  };
}
