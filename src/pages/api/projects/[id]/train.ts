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

  let pic_qty = project.imageUrls.length
  let data_reso = 768
  let steps_qty = 700
  let epochs = 8
  let train_batch_size = 10
  let repeat_number = Math.round((steps_qty*train_batch_size)/(pic_qty*epochs))

  const responseReplicate = await replicateClient.post(
    "",
    {
      version: "33f5fcde0fd156417421b296e9e8524bdec56b213d9cc669c6c6a149c9d0fb8f",
      input: {
        instance_data: `${instance_data_url}`,
        dataset_resolution: data_reso,
        dataset_repeats: repeat_number,
        save_every_n_epochs: epochs/4,
        max_epochs: epochs,
        train_batch_size: train_batch_size,
        unet_lr: 0.0001,
        clip_skip: 2,
        network_alpha: 128,
        text_encoder_lr: 0.00005,
        network_dimension: 160,
        gradient_accu_steps: 1,
        optimizer_lr_scheduler: "cosine_with_restarts",
        optimizer_learning_rate: 0.001,
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
