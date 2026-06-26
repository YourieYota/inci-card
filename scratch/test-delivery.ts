import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const { getDeliveryBatches } = await import('../app/actions/batches');
  try {
    console.log("Fetching delivery batches...");
    const batches = await getDeliveryBatches();
    console.log("SUCCESS, retrieved batches count:", batches.length);
    console.log(JSON.stringify(batches, null, 2));
  } catch (error) {
    console.error("ERROR FETCHING BATCHES:", error);
  }
}

main();
