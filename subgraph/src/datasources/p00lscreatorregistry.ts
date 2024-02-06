import {
	Address,
} from '@graphprotocol/graph-ts'


import {
	ERC721Contract,
} from '@openzeppelin/subgraphs/generated/schema'

import {
	fetchAccount,
} from '@openzeppelin/subgraphs/src/fetch/account'

import {
	fetchERC20,
} from '@openzeppelin/subgraphs/src/fetch/erc20'

import {
	fetchERC721,
	fetchERC721Token,
} from '@openzeppelin/subgraphs/src/fetch/erc721'


import {
	ERC20Contract  as P00lsTokenBase,
	ERC721Contract as P00lsCreatorRegistry,
} from '../../generated/schema'

import {
	P00lsCreatorRegistry as P00lsCreatorRegistryContract,
	Transfer as TransferEvent,
} from '../../generated/p00lscreatorregistry/P00lsCreatorRegistry'

import {
	P00lsTokenCreator,
} from '../../generated/p00lscreatorregistry/P00lsTokenCreator'

import {
	P00lsTokenXCreator,
} from '../../generated/p00lscreatorregistry/P00lsTokenXCreator'

import {
	P00lsTokenCreator_Polygon_V2,
} from '../../generated/p00lscreatorregistry/P00lsTokenCreator_Polygon_V2'

import {
	erc20             as erc20Template,
	erc1967upgrade    as erc1967upgradeTemplate,
	ownable           as ownableTemplate,
	voting            as votingTemplate,
	p00lstokencreator as p00lstokencreatorTemplate,
} from '../../generated/templates'


export function handleTransfer(event: TransferEvent): void {
	let address: Address = Address.fromString('0x'.concat(event.params.tokenId.toHex().slice(2).padStart(40, '0')))

	if (event.params.from == Address.zero()) {
		let registry    = fetchERC721(event.address) as ERC721Contract
		let erc721token = fetchERC721Token(registry, event.params.tokenId)
		registry.save()
		erc721token.save()

		if (address == event.address) {
			const contract              = P00lsCreatorRegistryContract.bind(event.address)
			const beaconCreatorAddress  = contract.beaconCreator()
			const beaconXCreatorAddress = contract.beaconXCreator()

			const creatorRegistry = P00lsCreatorRegistry.load(address) as P00lsCreatorRegistry
			creatorRegistry.ownershipToken = erc721token.id
			creatorRegistry.creatorBeacon  = fetchAccount(beaconCreatorAddress).id
			creatorRegistry.creatorXBeacon = fetchAccount(beaconXCreatorAddress).id
			creatorRegistry.save()


			ownableTemplate.create(beaconCreatorAddress)
			ownableTemplate.create(beaconXCreatorAddress)
			erc1967upgradeTemplate.create(beaconCreatorAddress)
			erc1967upgradeTemplate.create(beaconXCreatorAddress)

		} else {
			let creatorAddress:  Address = address
			let xCreatorAddress: Address = P00lsTokenCreator.bind(creatorAddress).xCreatorToken()

			// fetch tokens
			fetchERC20(creatorAddress)
			fetchERC20(xCreatorAddress)

			// register ownership token
			const tokenCreator  = P00lsTokenBase.load(creatorAddress)  as P00lsTokenBase
			const tokenXCreator = P00lsTokenBase.load(xCreatorAddress) as P00lsTokenBase
			const tokenCreatorIsOpened = P00lsTokenCreator_Polygon_V2.bind(creatorAddress).try_isOpen()
			const tokenXCreatorIsOpened = P00lsTokenCreator_Polygon_V2.bind(xCreatorAddress).try_isOpen()
			tokenCreator.ownershipToken  = erc721token.id
			tokenXCreator.ownershipToken = erc721token.id
			tokenCreator.xCreatorToken   = tokenXCreator.id
			tokenXCreator.creatorToken   = tokenCreator.id
			if (!tokenCreatorIsOpened.reverted)  tokenCreator.isOpened  = tokenCreatorIsOpened.value
			if (!tokenXCreatorIsOpened.reverted) tokenXCreator.isOpened = tokenXCreatorIsOpened.value
			tokenCreator.save()
			tokenXCreator.save()

			erc20Template.create(creatorAddress)
			votingTemplate.create(creatorAddress)
			erc1967upgradeTemplate.create(creatorAddress)
			p00lstokencreatorTemplate.create(creatorAddress)

			erc20Template.create(xCreatorAddress)
			votingTemplate.create(xCreatorAddress)
			erc1967upgradeTemplate.create(xCreatorAddress)
			p00lstokencreatorTemplate.create(xCreatorAddress)
		}
	}
}
