import replicateClient from "@/core/clients/replicate";
import db from "@/core/db";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { getPlaiceholder } from "plaiceholder";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import preSignedUrls from "@/core/clients/s3_presign";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectId = req.query.id as string;
  const predictionId = req.query.predictionId as string;

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const project = await db.project.findFirstOrThrow({
    where: { id: projectId, userId: session.userId },
  });

  let shot = await db.shot.findFirstOrThrow({
    where: { projectId: project.id, id: predictionId },
  });

  if (req.method === "GET") {
    const { data: prediction } = await replicateClient.get(
      `https://runpod-management-go-production.up.railway.app/handle-images` + "?predictionId=" + shot.replicateId
    );

    let outputUrl = prediction[0]?.outputUrl;
    outputUrl = preSignedUrls([outputUrl])
    let blurhash = null;

    if (outputUrl) {
      const { base64 } = await getPlaiceholder(outputUrl, { size: 16 });
      blurhash = base64;
    }


    const seedNumber = prediction[0].seed;

    shot = await db.shot.update({
      where: { id: shot.id },
      data: {
        status: prediction[0].status,
        outputUrl: outputUrl || null,
        blurhash,
        seed: seedNumber || null,
      },
    });

    return res.json({ shot });
  } else if (req.method === "PATCH") {
    const { bookmarked } = req.body;

    shot = await db.shot.update({
      where: { id: shot.id },
      data: {
        bookmarked: bookmarked || false,
      },
    });

    return res.json({ shot });
  }

  return res.status(405).json({ message: "Method not allowed" });
};

export default handler;
