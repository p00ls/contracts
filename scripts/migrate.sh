echo "========== INSTALL DEPENDENCIES =========="
npm i

echo "========== COMPILE CONTRACTS =========="
npx hardhat compile

echo "========== STARTING BLOCKCHAIN =========="
nohup node /app/ganache-core.docker.cli.js -m "test test test test test test test test test test test test" -l 12500000 -i 65535 --hardfork istanbul --db "/ganachedb" &
sleep 5

echo "========== DEPLOY CONTRACTS =========="
npx hardhat run scripts/migrate.js --network localhost
