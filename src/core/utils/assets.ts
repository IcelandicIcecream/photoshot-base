import { Project } from "@prisma/client";
import axios, { AxiosResponse } from "axios";
import JSZip from "jszip";
import sharp from "sharp";
import smartcrop from "smartcrop-sharp";
import AWS from "aws-sdk";
import preSignedUrls from "../clients/s3_presign";

const WIDTH = 512;
const HEIGHT = 512;

export const createZipFolder = async (urls: string[], project: Project) => {
  const s3 = new AWS.S3({
    accessKeyId: `${process.env.S3_UPLOAD_KEY!}`,
    secretAccessKey: `${process.env.S3_UPLOAD_SECRET!}`,
    region: `${process.env.S3_UPLOAD_REGION}`
  })

  const zip = new JSZip();
  const requests = [];  

  const signed_urls = preSignedUrls(urls)

  for (let i = 0; i < urls.length; i++) {
    requests.push(axios(signed_urls[i], {responseType: "arraybuffer"}));
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
