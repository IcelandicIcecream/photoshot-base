import db from "@/core/db";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import replicateClient from "@/core/clients/replicate";
import { authOptions } from "../../auth/[...nextauth]";
import preSignedUrls from "@/core/clients/s3_presign";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectId = req.query.id as string;
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
 }

  let project = await db.project.findFirstOrThrow({
    where: {
      id: projectId,
      userId: session.userId,
      modelStatus: "not_created",
      NOT: { stripePaymentId: null },
    },
  });

  let instance_data_url = preSignedUrls([`http://${process.env.S3_UPLOAD_BUCKET}.s3-${process.env.S3_UPLOAD_REGION}.amazonaws.com/${project.id}.zip`])

  const responseReplicate = await replicateClient.post(
    "",
    {
      version: "175508e583b9e6cd3ba5eb251c26f67df2904832e276f11919cc4ab259f23172",
      input: {
        instance_data: `${instance_data_url}`,
      },
      model: `${process.env.REPLICATE_USERNAME}/${project.id}`,
      webhook_completed: `${process.env.NEXTAUTH_URL}/api/webhooks/completed`,
    },
    {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  const replicateModelId = responseReplicate.data.id as string;

  project = await db.project.update({
    where: { id: project.id },
    data: { replicateModelId: replicateModelId, modelStatus: "processing" },
  });

  return res.json({ project });
};

export default handler;
