const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No deployer found. Check private key in .env");
  
  console.log("Deploying contracts with the account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", balance.toString());

  if (balance === 0n || balance == 0) {
    throw new Error("INSUFFICIENT FUNDS ON BASE SEPOLIA");
  }

  const contractFactory = await hre.ethers.getContractFactory("CapsulMe");
  console.log("Factory loaded. Deploying...");
  const contract = await contractFactory.deploy();
  await contract.waitForDeployment();
  console.log("CapsulMe deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
