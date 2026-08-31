const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Redeploying ZKP contracts with account:", deployer.address);

  // Load existing deployment (keep ProcurementSystem + ProcToken unchanged)
  const outDir = path.join(__dirname, "..", "src", "utils");
  const existing = JSON.parse(fs.readFileSync(path.join(outDir, "deployments.json"), "utf8"));
  console.log("Keeping ProcurementSystem at:", existing.contracts.ProcurementSystem);
  console.log("Keeping ProcToken at:", existing.contracts.ProcToken);

  // Deploy new Groth16Verifier
  const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16Address = await groth16Verifier.getAddress();
  console.log("Groth16Verifier deployed to:", groth16Address);

  // Deploy new WhistleblowerVerifier (anyone can register + submit)
  const WhistleblowerVerifier = await hre.ethers.getContractFactory("WhistleblowerVerifier");
  const whistleblowerVerifier = await WhistleblowerVerifier.deploy(groth16Address);
  await whistleblowerVerifier.waitForDeployment();
  const whistleblowerAddress = await whistleblowerVerifier.getAddress();
  console.log("WhistleblowerVerifier deployed to:", whistleblowerAddress);

  // Update deployments.json with new ZKP addresses
  existing.contracts.Groth16Verifier = groth16Address;
  existing.contracts.WhistleblowerVerifier = whistleblowerAddress;
  existing.timestamp = new Date().toISOString();

  fs.writeFileSync(
    path.join(outDir, "deployments.json"),
    JSON.stringify(existing, null, 2)
  );
  console.log("deployments.json updated");

  // Update WhistleblowerVerifier ABI
  const abisDir = path.join(outDir, "abis");
  const wbArtifact = await hre.artifacts.readArtifact("WhistleblowerVerifier");
  fs.writeFileSync(
    path.join(abisDir, "WhistleblowerVerifier.json"),
    JSON.stringify(wbArtifact.abi, null, 2)
  );
  console.log("WhistleblowerVerifier ABI updated");

  console.log("\nDone! ZKP contracts redeployed. ProcurementSystem + ProcToken unchanged.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
