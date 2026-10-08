// One-off migration: restores the two real on-chain role registrations
// that existed on the old ProcurementSystem contract, onto the new one
// deployed for the commit-reveal / on-chain-award work. Everything else
// tested throughout the session was Simulation Mode only and was never
// actually on-chain, so there's nothing else to migrate.
const hre = require("hardhat");

const ROLE_NAMES = ["None", "Citizen", "Supplier", "Government", "Auditor", "Oversight"];

const MIGRATIONS = [
  { label: "Old deployer / Procuring Entity wallet", address: "0xf25DA310af24B6C28237c173e81b19665766E875", role: 3 }, // Government
  { label: "Minister/Director wallet", address: "0x15bFf92fe34e25633dc2F91834EE6d921002f55F", role: 1 }, // Citizen
  { label: "Oversight wallet", address: "0x6BcbAE89De5BE26469803E28C2374C78aeA222e8", role: 5 }, // Oversight
  { label: "Auditor wallet", address: "0xE5f0eE39C3984f8fb45AA615A2ABabd2Ebc5C6a5", role: 4 }, // Auditor
];

async function main() {
  const deployments = require("../src/utils/deployments.json");
  const abi = require("../src/utils/abis/ProcurementSystem.json");
  const [signer] = await hre.ethers.getSigners();
  console.log("Running as:", signer.address);

  const contract = new hre.ethers.Contract(deployments.contracts.ProcurementSystem, abi, signer);

  for (const { label, address, role } of MIGRATIONS) {
    const current = await contract.getRole(address);
    if (Number(current) === role) {
      console.log(`${label} (${address}) already set to ${ROLE_NAMES[role]} — skipping`);
      continue;
    }
    console.log(`Assigning ${label} (${address}) -> ${ROLE_NAMES[role]}...`);
    const tx = await contract.assignRole(address, role);
    await tx.wait();
    console.log(`  done: ${tx.hash}`);
  }

  console.log("\nFinal state:");
  for (const { label, address } of MIGRATIONS) {
    const role = await contract.getRole(address);
    console.log(`  ${label} (${address}) -> ${ROLE_NAMES[Number(role)]}`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
