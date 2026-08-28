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

  // Save deployment addresses
  const deployment = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contracts: {
      ProcurementSystem: procurementAddress,
      ProcToken: tokenAddress,
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

  fs.writeFileSync(
    path.join(abisDir, "ProcurementSystem.json"),
    JSON.stringify(procArtifact.abi, null, 2)
  );
  fs.writeFileSync(
    path.join(abisDir, "ProcToken.json"),
    JSON.stringify(tokenArtifact.abi, null, 2)
  );
  console.log("ABIs saved to src/utils/abis/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
