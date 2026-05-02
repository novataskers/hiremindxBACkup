import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server";

const mistral = new Mistral({ 
  apiKey: process.env.MISTRAL_COMMUNITY_API_KEY || process.env.MISTRAL_API_KEY || "" 
});

const SYSTEM_PROMPT = `You are the HireMindX Community Assistant. Your goal is to help users post high-quality job requests.
You need to extract or clarify four key pieces of information:
1. Job Description (detailed explanation of what needs to be done)
2. Category (tech, engineering, design, writing, marketing, video, trades, business, or legal)
3. Location (a city name, "Remote", or "My Location")
4. Budget (e.g., "$500", "$100/hr", "Negotiable")

GUIDELINES:
- Be helpful, professional, and concise.
- If information is missing, ask for it naturally.
- If information is present, acknowledge it.
- When you have ALL information, summarize it and ask for final confirmation to post.
- You MUST return a JSON object containing your response and the structured job data.

EXAMPLE JSON RESPONSE:
{
  "message": "Great! I've noted that you need an engineer in London. What is your budget for this project?",
  "jobData": {
    "description": "Building a custom machinery part",
    "category": "engineering",
    "location": "London",
    "budget": ""
  },
  "nextState": "asking_budget"
}

CATEGORIES:
- tech: Software, web, apps, data, coding
- engineering: Mechanical, civil, electrical, architecture, engineering services
- design: UI/UX, graphics, branding, logos
- writing: Content, blogs, articles, translation
- marketing: SEO, ads, social media, growth
- video: Editing, filming, animation
- trades: Plumbing, electrical, construction, local services
- business: Consulting, admin, accounting
- legal: Legal advice, contracts

CURRENT STATE:
{{JOB_DATA}}
`;

export async function POST(req: Request) {
  try {
    const { message, jobData, conversationHistory } = await req.json();

    const response = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT.replace("{{JOB_DATA}}", JSON.stringify(jobData)) },
        ...conversationHistory,
        { role: "user", content: message }
      ],
      responseFormat: { type: "json_object" }
    });

    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
        throw new Error("Invalid response from Mistral");
    }
    const result = JSON.parse(content);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Community Chat Error:", error);
    return NextResponse.json({ error: "Failed to process chat" }, { status: 500 });
  }
}
