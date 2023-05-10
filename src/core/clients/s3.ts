import { S3Client } from "@aws-sdk/client-s3";
import AWS from "aws-sdk";

const s3Client = new S3Client({
  region: process.env.S3_UPLOAD_REGION!,
  credentials: {
    accessKeyId: process.env.S3_UPLOAD_KEY!,
    secretAccessKey: process.env.S3_UPLOAD_SECRET!,
  },
});

const s3 = new AWS.S3({
  accessKeyId: `${process.env.S3_UPLOAD_KEY!}`,
  secretAccessKey: `${process.env.S3_UPLOAD_SECRET!}`,
  region: `${process.env.S3_UPLOAD_REGION}`
})

const bucketName = `${process.env.S3_UPLOAD_BUCKET}`


export default s3Client;
