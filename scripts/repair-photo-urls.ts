import "./load-env";
import { repairCandidatePhotoUrls } from "../lib/candidate-photo-sync";

repairCandidatePhotoUrls()
  .then((updated) => {
    console.log(JSON.stringify({ updated }, null, 2));
  })
  .catch((error) => {
    console.error("Photo URL repair failed", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
