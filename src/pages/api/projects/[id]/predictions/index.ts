import replicateClient from "@/core/clients/replicate";
import db from "@/core/db";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const prompt = req.body.prompt as string;
  const image = req.body.image as string;

  const projectId = req.query.id as string;
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const project = await db.project.findFirstOrThrow({
    where: { id: projectId, userId: session.userId },
  });

  if (project.credits < 1) {
    return res.status(400).json({ message: "No credit" });
  }

  const { data } = await replicateClient.post(
    `https://runpod-management-go-production.up.railway.app/handle-prompts`,
    {
      input: {
        prompt: prompt,
        negative_prompt: process.env.REPLICATE_NEGATIVE_PROMPT,
        ...(image && { image }),
      },
      projectId: projectId,
    }
  );

  const shot = await db.shot.create({
    data: {
      prompt,
      replicateId: data.id,
      status: "starting",
      projectId: project.id,
    },
  });

  await db.project.update({
    where: { id: project.id },
    data: {
      credits: project.credits - 1,
    },
  });

  return res.json({ shot });
};

export default handler;
