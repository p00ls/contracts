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
	ERC20Contract,
} from '../../generated/schema'

import {
	erc20 as erc20Template,
} from '../../generated/templates'

import {
	AuctionCreated   as AuctionCreatedEvent,
	AuctionFinalized as AuctionFinalizedEvent,
} from '../../generated/auctionfactory/AuctionFactory'


export function handleAuctionCreated(event: AuctionCreatedEvent): void {
	let token         = fetchERC20(event.params.token);
	let auction_token = fetchERC20(event.params.auction);

	let auction                  = new Auction(auction_token.id)
	auction.asToken              = auction_token.id
	auction.token                = token.id
	auction.start                = event.params.start
	auction.deadline             = event.params.deadline
	auction.auctionedAmountExact = event.params.tokensAuctioned
	auction.auctionedAmount      = decimals.toDecimals(event.params.tokensAuctioned, token.decimals)
	auction.save()

	let auction_token_full       = new ERC20Contract(auction_token.id)
	auction_token_full.asAuction = auction.id
	auction_token_full.save()

	let ev         = new AuctionCreated(events.id(event))
	ev.emitter     = fetchAccount(event.address).id
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.token       = token.id
	ev.auction     = auction.id
	ev.save()

	erc20Template.create(event.params.auction)
}

export function handleAuctionFinalized(event: AuctionFinalizedEvent): void {
	let token         = fetchERC20(event.params.token);
	let auction_token = fetchERC20(event.params.auction);

	let auction              = new Auction(auction_token.id)
	auction.raisedValueExact = event.params.valueRaised
	auction.raisedValue      = decimals.toDecimals(event.params.valueRaised)
	auction.save()

	let ev         = new AuctionFinalized(events.id(event))
	ev.emitter     = fetchAccount(event.address).id
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.token       = token.id
	ev.auction     = auction.id
	ev.save()
}
