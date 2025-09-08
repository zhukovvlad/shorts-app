import OpenAI from "openai";

export const generateScript = async (part: string) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
    Write a script to generate a 30 seconds video on the topic: "${part}"
    along with AI image prompt in realistic format for each scene and give me the
    result in JSON format with imagePrompt and Content Text as fields.
    Just give me imagePrompt and contentText in array.
    PLEASE DON'T GIVE ANY OTHER RESPONSE like "scene1, etc".
    JUST GIVE WHAT I ASKED ONLY.
    Keep the name of the response array as "content" - which would be containing the objects.
  `.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    response_format: {
      type: "json_object",
    },
  });

  return response.choices[0]?.message?.content;
};
