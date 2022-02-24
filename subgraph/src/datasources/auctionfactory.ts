import {
	events,
	decimals,
	transactions
} from '@amxx/graphprotocol-utils';

import { fetchERC20   } from '@openzeppelin/subgraphs/src/fetch/erc20'
import { fetchAccount } from '@openzeppelin/subgraphs/src/fetch/account';

import {
	Auction,
	AuctionCreated,
	AuctionFinalized,
	ERC20,
} from '../../generated/schema'

import {
	erc20 as erc20Template,
} from '../../generated/templates'

import {
	AuctionCreated   as AuctionCreatedEvent,
	AuctionFinalized as AuctionFinalizedEvent,
} from '../../generated/auctionfactory/AuctionFactory'


export function handleAuctionCreated(event: AuctionCreatedEvent): void {
	let creator_token = fetchERC20(event.params.token);
	let auction_token = fetchERC20(event.params.auction);

	let auction = new Auction(creator_token.id)
	auction.asToken              = auction_token.id
	auction.creator              = creator_token.id
	auction.start                = event.params.start
	auction.deadline             = event.params.deadline
	auction.auctionedAmountExact = event.params.tokensAuctionned
	auction.auctionedAmount      = decimals.toDecimals(event.params.tokensAuctionned, creator_token.decimals)
	auction.save()

	let creator_token_full = new ERC20(creator_token.id)
	let auction_token_full = new ERC20(auction_token.id)
	creator_token_full.auction   = auction.id
	auction_token_full.asAuction = auction.id
	creator_token_full.save()
	auction_token_full.save()

	let ev         = new AuctionCreated(events.id(event))
	ev.emitter     = fetchAccount(event.address).id
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.auction     = auction.id
	ev.save()

	erc20Template.create(event.params.auction)
}

export function handleAuctionFinalized(event: AuctionFinalizedEvent): void {
	let creator_token = fetchERC20(event.params.token);

	let auction = new Auction(creator_token.id)
	auction.raisedValueExact = event.params.valueRaised
	auction.raisedValue      = decimals.toDecimals(event.params.valueRaised)
	auction.save()

	let ev         = new AuctionFinalized(events.id(event))
	ev.emitter     = fetchAccount(event.address).id
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.auction     = auction.id
	ev.save()
}
