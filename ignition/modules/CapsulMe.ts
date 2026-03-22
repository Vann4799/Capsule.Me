import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CapsulMeModule", (m) => {
  const capsulMe = m.contract("CapsulMe", []);

  return { capsulMe };
});
