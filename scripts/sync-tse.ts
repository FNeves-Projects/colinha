import "./load-env";
import { syncTse } from "../lib/tse-sync";

syncTse({ onProgress: (message) => console.log(message) })
  .then((result) => {
    console.log("Sync completed", result);
  })
  .catch((error) => {
    console.error("Sync failed", error);
    process.exitCode = 1;
  });
