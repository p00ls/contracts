import {
	Address,
	Bytes,
	BigInt,
} from '@graphprotocol/graph-ts'

import { constants, decimals, events, transactions } from '@amxx/graphprotocol-utils'
import { ERC20Contract } from '@openzeppelin/subgraphs/generated/schema'
import { fetchAccount  } from '@openzeppelin/subgraphs/src/fetch/account'
import { fetchERC20    } from '@openzeppelin/subgraphs/src/fetch/erc20'

import {
	VestingAirdrop,
	VestingSchedule,
	VestingAirdropEnabled,
	TokensReleased,
} from '../../generated/schema'

import {
	Airdrop        as AirdropEvent,
	TokensReleased as TokensReleasedEvent,
} from '../../generated/vesting/VestedAirdrops'



function fetchAirdrop(airdrop: Bytes): VestingAirdrop {
	return new VestingAirdrop(airdrop.toHex())
}

function fetchSchedule(
	airdrop:   VestingAirdrop,
	leaf:      Bytes,
	token:     ERC20Contract,
	recipient: Address,
	amount:    BigInt,
): VestingSchedule {
	let schedule = VestingSchedule.load(leaf.toHex())

	if (schedule == null) {
		schedule               = new VestingSchedule(leaf.toHex())
		schedule.airdrop       = airdrop.id
		schedule.token         = token.id
		schedule.recipient     = fetchAccount(recipient).id
		schedule.amountExact   = amount
		schedule.amount        = decimals.toDecimals(amount, token.decimals)
		schedule.releasedExact = constants.BIGINT_ZERO
		schedule.released      = constants.BIGDECIMAL_ZERO
		schedule.save()
	}

	return schedule as VestingSchedule
}

export function handleAirdrop(event: AirdropEvent): void {
	let airdrop     = fetchAirdrop(event.params.airdrop)
	airdrop.enabled = event.params.enabled
	airdrop.save()

	let ev         = new VestingAirdropEnabled(events.id(event))
	ev.emitter     = fetchAccount(event.address).id
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.airdrop     = airdrop.id
	ev.enabled     = event.params.enabled
	ev.save()
}

export function handleTokensReleased(event: TokensReleasedEvent): void {
	let token              = fetchERC20(event.params.token)
	let airdrop            = fetchAirdrop(event.params.airdrop)
	let schedule           = fetchSchedule(airdrop, event.params.leaf, token, event.params.recipient, event.params.scheduleAmount)
	schedule.releasedExact = schedule.releasedExact.plus(event.params.releasedAmount)
	schedule.released      = decimals.toDecimals(schedule.releasedExact, token.decimals)
	airdrop.save
	schedule.save()

	let ev         = new TokensReleased(events.id(event))
	ev.emitter     = fetchAccount(event.address).id
	ev.transaction = transactions.log(event).id
	ev.timestamp   = event.block.timestamp
	ev.schedule    = schedule.id
	ev.valueExact  = event.params.releasedAmount
	ev.value       = decimals.toDecimals(event.params.releasedAmount, token.decimals)
	ev.save()
}