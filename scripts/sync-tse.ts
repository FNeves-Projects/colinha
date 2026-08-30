import "dotenv/config";
import { syncTse } from "../lib/tse-sync";

syncTse()
  .then((result) => {
    console.log("Sincronizacao concluida", result);
  })
  .catch((error) => {
    console.error("Falha na sincronizacao", error);
    process.exitCode = 1;
  });
