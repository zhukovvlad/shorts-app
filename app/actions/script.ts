import OpenAI from "openai";

interface ScriptContent {
  imagePrompt: string;
  contentText: string;
}

interface ScriptResponse {
  content: ScriptContent[];
}

// Константы для конфигурации
const OPENAI_CONFIG = {
  model: "gpt-4o" as const,
  maxTokens: 2000,
  temperature: 0.7,
  videoDuration: 30, // секунд
} as const;

/**
 * Валидирует и парсит ответ от OpenAI
 * @param content - JSON строка от OpenAI
 * @returns Распарсенный контент
 * @throws Error при невалидном формате
 */
const validateAndParseResponse = (content: string): ScriptResponse => {
  try {
    const parsedContent: ScriptResponse = JSON.parse(content);

    if (!parsedContent.content || !Array.isArray(parsedContent.content)) {
      throw new Error("Invalid response format: 'content' array is required");
    }

    if (parsedContent.content.length === 0) {
      throw new Error("Response content array is empty");
    }

    // Проверяем, что каждый элемент содержит необходимые поля
    parsedContent.content.forEach((item, index) => {
      if (!item.imagePrompt?.trim() || !item.contentText?.trim()) {
        throw new Error(`Invalid item at index ${index}: imagePrompt and contentText are required and cannot be empty`);
      }
    });

    return parsedContent;
  } catch (parseError) {
    if (parseError instanceof SyntaxError) {
      throw new Error(`Invalid JSON format in OpenAI response: ${parseError.message}`);
    }
    throw parseError;
  }
};

/**
 * Генерирует скрипт для 30-секундного видео на заданную тему
 * @param topic - Тема для генерации скрипта
 * @returns Строка JSON с массивом объектов содержащих imagePrompt и contentText
 * @throws Error при отсутствии API ключа, пустой теме или ошибках API
 */
export const generateScript = async (topic: string): Promise<string> => {
  if (!topic?.trim()) {
    throw new Error("Topic parameter is required and cannot be empty");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
    Write a script to generate a ${OPENAI_CONFIG.videoDuration} seconds video on the topic: "${topic.trim()}"
    along with AI image prompt in realistic format for each scene and give me the
    result in JSON format with imagePrompt and contentText as fields.
    
    Requirements:
    - Create 3-5 scenes for a ${OPENAI_CONFIG.videoDuration}-second video
    - Each scene should be 6-10 seconds long
    - imagePrompt should be detailed and describe realistic visuals
    - contentText should be engaging and suitable for narration
    - Use professional, clear language
    - Make content engaging and informative
    
    Response format:
    {
      "content": [
        {
          "imagePrompt": "detailed visual description",
          "contentText": "narration text for this scene"
        }
      ]
    }
    
    IMPORTANT: Return ONLY the JSON object, no additional text or formatting.
  `.trim();

    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      response_format: {
        type: "json_object",
      },
      max_tokens: OPENAI_CONFIG.maxTokens,
      temperature: OPENAI_CONFIG.temperature,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    // Валидация JSON ответа
    validateAndParseResponse(content);

    return content;
  } catch (error) {
    console.error("Error generating script:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("An unexpected error occurred while generating the script");
  }
};

/**
 * Типизированная версия функции для получения распарсенного объекта
 * @param topic - Тема для генерации скрипта
 * @returns Распарсенный объект со скриптом
 */
export const generateScriptParsed = async (topic: string): Promise<ScriptResponse> => {
  const jsonString = await generateScript(topic);
  return validateAndParseResponse(jsonString);
};

/**
 * Подсчитывает приблизительную длительность контента
 * @param content - Массив контента скрипта
 * @returns Приблизительная длительность в секундах
 */
export const estimateContentDuration = (content: ScriptContent[]): number => {
  // Приблизительно 150-180 слов в минуту для речи
  const wordsPerSecond = 2.5;

  const totalWords = content.reduce((total, item) => {
    return total + item.contentText.split(/\s+/).length;
  }, 0);

  return Math.ceil(totalWords / wordsPerSecond);
};
