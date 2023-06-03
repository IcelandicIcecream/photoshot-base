export const extractSeedFromLogs = (logsContent: string) => {
  try {
    const logLines = logsContent.split("\n");
    const seedLine = logLines[0];
    const seedValue = seedLine.split(":")[1].trim();

    return seedValue ? Number(seedValue) : undefined;
  } catch (e) {
    return undefined;
  }
};