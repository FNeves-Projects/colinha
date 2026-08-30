import "dotenv/config";
import { syncTse } from "../lib/tse-sync";

syncTse()
  .then((result) => {
    console.log("Sync completed", result);
  })
  .catch((error) => {
    console.error("Sync failed", error);
    process.exitCode = 1;
  });
