import { Project } from "@prisma/client";
import axios, { AxiosResponse } from "axios";
import JSZip from "jszip";
import sharp from "sharp";
import smartcrop from "smartcrop-sharp";
import AWS from "aws-sdk";

const WIDTH = 512;
const HEIGHT = 512;

export const createZipFolder = async (urls: string[], project: Project) => {
  const s3 = new AWS.S3({
    accessKeyId: `${process.env.S3_UPLOAD_KEY!}`,
    secretAccessKey: `${process.env.S3_UPLOAD_SECRET!}`,
    region: `${process.env.S3_UPLOAD_REGION}`
  })

  const bucketName = `${process.env.S3_UPLOAD_BUCKET}`
  const zip = new JSZip();
  const requests = [];  

  for (let i = 0; i < urls.length; i++) {
    const preSignedUrls = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: urls[i].substring(urls[i].indexOf(`${process.env.S3_UPLOAD_REGION!}`) + process.env.S3_UPLOAD_REGION!.length + 15),
      Expires: 3600 // URL expires after one hour
    });
    requests.push(axios(preSignedUrls, {responseType: "arraybuffer"}));
  }

  const responses = await Promise.all<AxiosResponse<Buffer>>(requests);
  const buffersPromises = responses.map((response) => {
    const buffer = response.data;
    return smartcrop
      .crop(buffer, { width: WIDTH, height: HEIGHT })
      .then(function (result) {
        const crop = result.topCrop;
        return sharp(buffer)
          .extract({
            width: crop.width,
            height: crop.height,
            left: crop.x,
            top: crop.y,
          })
          .resize(WIDTH, HEIGHT)
          .toBuffer();
      });
  });

  const buffers = await Promise.all(buffersPromises);
  const folder = zip.folder(project.id);

  buffers.forEach((buffer, i) => {
    const filename = urls[i].split("/").pop();
    folder!.file(filename!, buffer, { binary: true });
  });

  const zipContent = await zip.generateAsync({ type: "nodebuffer" });

  return zipContent;
};
