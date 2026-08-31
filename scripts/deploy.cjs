const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy ProcurementSystem
  const ProcurementSystem = await hre.ethers.getContractFactory("ProcurementSystem");
  const procurement = await ProcurementSystem.deploy();
  await procurement.waitForDeployment();
  const procurementAddress = await procurement.getAddress();
  console.log("ProcurementSystem deployed to:", procurementAddress);

  // Deploy ProcToken
  const ProcToken = await hre.ethers.getContractFactory("ProcToken");
  const token = await ProcToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("ProcToken deployed to:", tokenAddress);

  // Deploy Groth16Verifier (ZKP verifier)
  const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16Address = await groth16Verifier.getAddress();
  console.log("Groth16Verifier deployed to:", groth16Address);

  // Deploy WhistleblowerVerifier (uses Groth16Verifier)
  const WhistleblowerVerifier = await hre.ethers.getContractFactory("WhistleblowerVerifier");
  const whistleblowerVerifier = await WhistleblowerVerifier.deploy(groth16Address);
  await whistleblowerVerifier.waitForDeployment();
  const whistleblowerAddress = await whistleblowerVerifier.getAddress();
  console.log("WhistleblowerVerifier deployed to:", whistleblowerAddress);

  // Save deployment addresses
  const deployment = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contracts: {
      ProcurementSystem: procurementAddress,
      ProcToken: tokenAddress,
      Groth16Verifier: groth16Address,
      WhistleblowerVerifier: whistleblowerAddress,
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "src", "utils");
  fs.writeFileSync(
    path.join(outDir, "deployments.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("Deployment info saved to src/utils/deployments.json");

  // Save ABIs for the frontend
  const abisDir = path.join(outDir, "abis");
  if (!fs.existsSync(abisDir)) fs.mkdirSync(abisDir, { recursive: true });

  const procArtifact = await hre.artifacts.readArtifact("ProcurementSystem");
  const tokenArtifact = await hre.artifacts.readArtifact("ProcToken");
  const wbVerifierArtifact = await hre.artifacts.readArtifact("WhistleblowerVerifier");

  fs.writeFileSync(
    path.join(abisDir, "ProcurementSystem.json"),
    JSON.stringify(procArtifact.abi, null, 2)
  );
  fs.writeFileSync(
    path.join(abisDir, "ProcToken.json"),
    JSON.stringify(tokenArtifact.abi, null, 2)
  );
  fs.writeFileSync(
    path.join(abisDir, "WhistleblowerVerifier.json"),
    JSON.stringify(wbVerifierArtifact.abi, null, 2)
  );
  console.log("ABIs saved to src/utils/abis/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
