import {
	Address, log,
} from '@graphprotocol/graph-ts'

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
	if (event.params.from == Address.zero()) {
		let tokenCreator: Address = Address.fromString('0x'.concat(event.params.tokenId.toHex().slice(2).padStart(40, '0')));
		if (tokenCreator == event.address) return;
		let tokenXCreator: Address = P00lsTokenCreator.bind(tokenCreator).xCreatorToken();

		erc20Template.create(tokenCreator);
		votingTemplate.create(tokenCreator);
		erc1967upgradeTemplate.create(tokenCreator);

		erc20Template.create(tokenXCreator);
		votingTemplate.create(tokenXCreator);
		erc1967upgradeTemplate.create(tokenXCreator);
	}
}