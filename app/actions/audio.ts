import { prisma } from "../lib/db";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const generateAudio = async (videoId: string) => {
  try {
    const video = await prisma.video.findUnique({
      where: { videoId },
    });
    if (!video || !video.content) {
      return undefined;
    }

    console.log(" in audio now");

    const webStream = await client.textToSpeech.stream(
      "JBFqnCBsd6RMkjVDRZzb",
      {
        text: video.content,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128", // output_format
      }
    );

    const audioStream = Readable.fromWeb(
      webStream as any
    );

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);
    const fileName = `${randomUUID()}.mp3`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileName,
      Body: audioBuffer,
      ContentType: "audio/mpeg",
    });

    await s3Client.send(command);

    const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    console.log("s3Url", s3Url);

    await prisma.video.update({
      where: { videoId },
      data: { audio: s3Url },
    });

  } catch (error) {
    console.error("Error generating audio:", error);
    throw error;
  }
};
