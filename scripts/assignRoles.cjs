const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Assigning roles with deployer:", deployer.address);

  const contractAddress = "0x5D8ca4B7B3929624951c3AD321f3f09DF185b30E";
  const ProcurementSystem = await hre.ethers.getContractAt("ProcurementSystem", contractAddress);

  // Role numbers: 1=Public, 2=Bidder, 3=Government, 4=Auditor, 5=Oversight
  const assignments = [
    { address: "0xf25DA310af24B6C28237c173e81b19665766E875", role: 3, name: "Procuring Entity" },
    { address: "0x15bFf92fe34e25633dc2F91834EE6d921002f55F", role: 1, name: "Public" },
    { address: "0x67D65fE7eB9e4d7baC5CA4f9ff8111e908aa42D7", role: 2, name: "Bidder" },
    { address: "0xE5f0eE39C3984f8fb45AA615A2ABabd2Ebc5C6a5", role: 4, name: "Auditor" },
    { address: "0x6BcbAE89De5BE26469803E28C2374C78aeA222e8", role: 5, name: "Oversight" },
  ];

  for (const { address, role, name } of assignments) {
    try {
      console.log(`Assigning ${name} (role ${role}) to ${address}...`);
      const tx = await ProcurementSystem.assignRole(address, role);
      await tx.wait();
      console.log(`  ✓ ${name} assigned successfully`);
    } catch (err) {
      console.error(`  ✗ Failed to assign ${name}:`, err.reason || err.message);
    }
  }

  console.log("\nDone! All roles assigned.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
