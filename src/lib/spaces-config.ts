import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  endpoint: "https://" + process.env.DO_SPACES_ENDPOINT,
  region: "us-east-1", // DigitalOcean Spaces default region
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!
  }
});

export const BUCKET_NAME = process.env.DO_SPACES_NAME!; 