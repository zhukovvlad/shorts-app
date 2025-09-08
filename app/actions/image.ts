import { prisma } from "../lib/db";
import Replicate from "replicate";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

interface ReplicateOutput {
  url: () => URL;
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const bucketName = process.env.AWS_S3_BUCKET_NAME!;

const processImage = async (img: string) => {
  try {
    const input = {
      prompt: img,
      resolution: "None",
      style_type: "Realistic",
      aspect_ratio: "9:16",
      magic_prompt_option: "On",
    };

    const output = (await replicate.run("ideogram-ai/ideogram-v3-turbo", {
      input,
    })) as ReplicateOutput;
    const image = output.url();
    const imageUrl = image.href;
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${randomUUID()}.png`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: "image/png",
    });

    await s3Client.send(command);
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    return s3Url;
  } catch (error) {
    console.log("Error processing image from replicate:", error);
	throw error;
  }
};

export const generateImages = async (videoId: string) => {
  try {
    // const video = await prisma.video.findUnique({
    //   where: { videoId },
    // });

    // if (!video) {
    //   return null;
    // }

    const response = await processImage('leo messi celebrating his 8th ballandor')
    console.log('response', response)

  } catch (error) {
    console.log("Error generating images:", error);
    throw error;
  }
};
