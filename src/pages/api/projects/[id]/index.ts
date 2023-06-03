import replicateClient from "@/core/clients/replicate";
import s3Client from "@/core/clients/s3";
import db from "@/core/db";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectId = req.query.id as string;
  const session = await getServerSession(req, res, authOptions);
  let modelStatus = "not_created";

  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
 }

  const project = await db.project.findFirstOrThrow({
    where: { id: projectId, userId: session.userId },
  });

  if (req.method === "GET") {
    if (project?.replicateModelId) {
      const response = await replicateClient.get(
        `/${project.replicateModelId}`
      );

      modelStatus = response?.data?.status || modelStatus;
    }

    return res.json({ project, modelStatus });
  } else if (req.method === "DELETE") {
    const { imageUrls, id } = project;

    // Delete training image
    try {
    for (const imageUrl of imageUrls) {
      const key = imageUrl.split(
        `https://${process.env.S3_UPLOAD_BUCKET}.s3.${process.env.S3_UPLOAD_REGION}.amazonaws.com/`
      )[1];

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_UPLOAD_BUCKET,
          Key: key,
        })
      );
    }
  } catch (error) {
    console.error("error deleting images", error)
  }

    // Delete zip
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_UPLOAD_BUCKET,
        Key: `${project.id}.zip`,
      })
    );

    // Delete shots and project
    await db.shot.deleteMany({ where: { projectId: id } });
    await db.project.delete({ where: { id } });

    return res.json({ success: true });
  }

  return res.status(405).json({ message: "Method not allowed" });
};

export default handler;
