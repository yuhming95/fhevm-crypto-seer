import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHECryptoSeer = await deploy("FHECryptoSeer", {
    from: deployer,
    log: true,
  });

  console.log(`FHECryptoSeer contract: `, deployedFHECryptoSeer.address);
};
export default func;
func.id = "deploy_FHECryptoSeer"; // id required to prevent reexecution
func.tags = ["FHECryptoSeer"];
