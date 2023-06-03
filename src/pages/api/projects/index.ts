import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import db from "@/core/db";
import { createZipFolder } from "@/core/utils/assets";
import s3Client from "@/core/clients/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import replicateClient from "@/core/clients/replicate";
import { authOptions } from "../auth/[...nextauth]";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
     res.status(401).json({ message: "Not authenticated" });
     return;
  }

  if (req.method === "POST") {
    const urls = req.body.urls as string[];
    const studioName = req.body.studioName as string;
    const instanceClass = req.body.instanceClass as string;

    const project = await db.project.create({
      data: {
        imageUrls: urls,
        name: studioName,
        userId: session.userId,
        modelStatus: "not_created",
        instanceClass: instanceClass || "person",
        instanceName: process.env.NEXT_PUBLIC_REPLICATE_INSTANCE_TOKEN!,
        credits: Number(process.env.NEXT_PUBLIC_STUDIO_SHOT_AMOUNT) || 50,
      },
    });

    const buffer = await createZipFolder(urls, project);
    try {
      const uploadStatus = await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_UPLOAD_BUCKET!,
          Key: `${project.id}.zip`,
          Body: buffer,
        })
      );
      console.log("Images uploaded succesfully:", uploadStatus);
    } catch (err) {
      console.error("Error uploading images:", err);
    }
    
    return res.json({ project });
  }

  if (req.method === "GET") {
    const projects = await db.project.findMany({
      where: { userId: session.userId },
      include: { shots: { take: 10, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });

    for (const project of projects) {
      if (project?.replicateModelId && project?.modelStatus !== "succeeded") {
        const { data } = await replicateClient.get(
          `/${project.replicateModelId}`
        );

        await db.project.update({
          where: { id: project.id },
          data: { modelVersionId: data.version, modelStatus: data?.status },
        });

        // await replicateClient.post(
        //   `https://runpod-management-go-production.up.railway.app/handle-loras`,
        //   {
        //     projectId: project.id
        //   }
        // );
      }
    }

    return res.json(projects);
  }
};

export default handler;
