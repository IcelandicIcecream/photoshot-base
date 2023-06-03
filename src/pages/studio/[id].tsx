import PageContainer from "@/components/layout/PageContainer";
import PromptPanel from "@/components/projects/PromptPanel";
import ShotsList from "@/components/projects/shot/ShotsList";
import ProjectProvider, { PROJECTS_PER_PAGE } from "@/contexts/project-context";
// import replicateClient from "@/core/clients/replicate";
import db from "@/core/db";
import { Box, Button } from "@chakra-ui/react";
import { Project, Shot } from "@prisma/client";
import { GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi";
import superjson from "superjson";


export type ProjectWithShots = Project & {
  shots: Shot[];
};

export interface IStudioPageProps {
  project: ProjectWithShots & { _count: { shots: number } };
  hasImageInputAvailable: boolean;
}

const StudioPage = ({ project, hasImageInputAvailable }: IStudioPageProps) => (
  <ProjectProvider project={project}>
    <PageContainer>
      <Box mb={4}>
        <Button
          color="beige.500"
          leftIcon={<HiArrowLeft />}
          variant="link"
          href="/dashboard"
          as={Link}
        >
          Back to Dashboard
        </Button>
      </Box>
      <PromptPanel hasImageInputAvailable={hasImageInputAvailable} />
      <ShotsList />
    </PageContainer>
  </ProjectProvider>
);

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession({ req: context.req });
  const projectId = context.query.id as string;
  // const retryDelay = 4000; // Delay in milliseconds between retries
  // let retryCount = 0;
  // let retrying = false;
  // const maxRetries = 3; // Maximum number of retries

  if (!session) {
    return {
      redirect: {
        permanent: false,
        destination: "/login",
      },
    };
  }

  const project = await db.project.findFirstOrThrow({
    where: { id: projectId, userId: session.userId, modelStatus: "succeeded" },
    include: {
      _count: {
        select: { shots: true },
      },
      shots: {
        orderBy: { createdAt: "desc" },
        take: PROJECTS_PER_PAGE,
        skip: 0,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // try {
  //   const response = await replicateClient.post('https://runpod-management-go-production.up.railway.app/handle-loras', {
  //     // Request body data
  //     projectId: projectId,
  //   });
  //   // Handle the response
  //   console.log(response.data);

  // } catch (error) {

  //   retrying = true;
  //   console.error(error);

  // }

  // while (retrying == true && retryCount < maxRetries) {
  //   try {
  //     const response = await replicateClient.post('https://runpod-management-go-production.up.railway.app/handle-loras', {
  //       // Request body data
  //       projectId: projectId,
  //     });
    
  //     // Handle the response
  //     console.log(response.data);
      
  //     // Break the loop if the response is successful
  //     break;
  //   } catch (error) {
  //     // Increment the retry count
  //     retryCount++;
      
  //     // Handle any errors
  //     console.error(error);
      
  //     if (retryCount === maxRetries) {
  //       console.log('Maximum number of retries reached.');
  //     } else {
  //       console.log('Retrying...');
  //       await delay(retryDelay); // Introduce a delay before the next retry
  //     }
  //   }
  // }

  // // Delay function using setTimeout
  // function delay(ms: number) {
  //   return new Promise((resolve) => setTimeout(resolve, ms));
  // }


  if (!project) {
    return {  
      notFound: true,
    };
  }

  // const { data: model } = await replicateClient.get(
  //   `https://api.replicate.com/v1/models/${process.env.REPLICATE_USERNAME}/${project.id}/versions/${project.modelVersionId}`
  // );

  // const hasImageInputAvailable = Boolean(
  //   model.openapi_schema?.components?.schemas?.Input?.properties?.image?.title
  // );

  const { json: serializedProject } = superjson.serialize(project);

  return {
    props: {
      project: serializedProject,
      // hasImageInputAvailable,
    },
  };
}

export default StudioPage;
