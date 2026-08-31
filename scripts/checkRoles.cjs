const hre = require("hardhat");

async function main() {
  const contractAddress = "0x5D8ca4B7B3929624951c3AD321f3f09DF185b30E";
  const ProcurementSystem = await hre.ethers.getContractAt("ProcurementSystem", contractAddress);

  const addresses = [
    { address: "0xf25DA310af24B6C28237c173e81b19665766E875", name: "Procuring Entity" },
    { address: "0x15bFf92fe34e25633dc2F91834EE6d921002f55F", name: "Public" },
    { address: "0x67D65fE7eB9e4d7baC5CA4f9ff8111e908aa42D7", name: "Bidder" },
    { address: "0xE5f0eE39C3984f8fb45AA615A2ABabd2Ebc5C6a5", name: "Auditor" },
    { address: "0x6BcbAE89De5BE26469803E28C2374C78aeA222e8", name: "Oversight" },
  ];

  const roleNames = { 0: "None", 1: "Citizen", 2: "Supplier", 3: "Government", 4: "Auditor", 5: "Oversight" };

  for (const { address, name } of addresses) {
    const role = await ProcurementSystem.getRole(address);
    console.log(`${name} (${address}): Role ${role} = ${roleNames[Number(role)] || "Unknown"}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
