import {
	BigInt,
} from '@graphprotocol/graph-ts'

import {
	events,
	constants,
	decimals,
	transactions,
} from '@amxx/graphprotocol-utils'

import { fetchERC20   } from '@openzeppelin/subgraphs/src/fetch/erc20'
import { fetchAccount } from '@openzeppelin/subgraphs/src/fetch/account'

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
	let token         = fetchERC20(event.params.token)
	let payment       = fetchERC20(event.params.payment)
	let auction_token = fetchERC20(event.params.auction)

	let auction                  = new Auction(auction_token.id)
	auction.asToken              = auction_token.id
	auction.status               = "STARTED"
	auction.token                = token.id
	auction.token                = payment.id
	auction.start                = event.params.start
	auction.deadline             = event.params.deadline
	auction.auctionedAmountExact = event.params.tokensAuctioned
	auction.auctionedAmount      = decimals.toDecimals(event.params.tokensAuctioned, token.decimals)
	auction.raisedValueExact     = constants.BIGINT_ZERO
	auction.raisedValue          = constants.BIGDECIMAL_ZERO

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
	let token         = fetchERC20(event.params.token)
	let auction_token = fetchERC20(event.params.auction)

	let auction              = Auction.load(auction_token.id) as Auction
	auction.status           = "FINALIZED"
	auction.raisedValueExact = auction.raisedValueExact.plus(event.params.amountPayment)
	auction.raisedValue      = decimals.toDecimals(auction.raisedValueExact)
	auction.save()

	let ev         = new AuctionFinalized(events.id(event))
	ev.emitter     = fetchAccount(event.address).id
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.token       = token.id
	ev.auction     = auction.id
	ev.save()
}
