import {
	Address,
} from '@graphprotocol/graph-ts'


import {
	ERC721Contract,
} from '@openzeppelin/subgraphs/generated/schema'

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
	Transfer as TransferEvent,
} from '../../generated/p00lscreatorregistry/P00lsCreatorRegistry'

import {
	P00lsTokenCreator,
} from '../../generated/p00lscreatorregistry/P00lsTokenCreator'

import {
	P00lsTokenXCreator,
} from '../../generated/p00lscreatorregistry/P00lsTokenXCreator'

import {
	erc20          as erc20Template,
	erc1967upgrade as erc1967upgradeTemplate,
	voting         as votingTemplate,
} from '../../generated/templates'


export function handleTransfer(event: TransferEvent): void {
	let address: Address = Address.fromString('0x'.concat(event.params.tokenId.toHex().slice(2).padStart(40, '0')));

	if (event.params.from == Address.zero()) {
		let registry    = fetchERC721(event.address) as ERC721Contract
		let erc721token = fetchERC721Token(registry, event.params.tokenId)
		registry.save()
		erc721token.save()

		if (address == event.address) {
			const creatorRegistry = new P00lsCreatorRegistry(address.toHex())
			creatorRegistry.ownershipToken = erc721token.id
			creatorRegistry.save()
		} else {
			let creatorAddress:  Address = address
			let xCreatorAddress: Address = P00lsTokenCreator.bind(creatorAddress).xCreatorToken()

			// fetch tokens
			fetchERC20(creatorAddress).save()
			fetchERC20(xCreatorAddress).save()

			// register ownership token
			const tokenCreator  = new P00lsTokenBase(creatorAddress.toHex())
			const tokenXCreator = new P00lsTokenBase(xCreatorAddress.toHex())
			tokenCreator.ownershipToken  = erc721token.id
			tokenXCreator.ownershipToken = erc721token.id
			tokenCreator.xCreatorToken   = tokenXCreator.id
			tokenXCreator.creatorToken   = tokenCreator.id
			tokenCreator.save()
			tokenXCreator.save()

			erc20Template.create(creatorAddress)
			votingTemplate.create(creatorAddress)
			erc1967upgradeTemplate.create(creatorAddress)

			erc20Template.create(xCreatorAddress)
			votingTemplate.create(xCreatorAddress)
			erc1967upgradeTemplate.create(xCreatorAddress)
		}
	}
}