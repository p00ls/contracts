import {
	ERC20Contract  as P00lsTokenBase,
} from '../../generated/schema'

import {
	Opened as OpenedEvent,
} from '../../generated/p00lscreatorregistry/P00lsTokenCreator_Polygon_V2'

export function handleOpened(event: OpenedEvent): void {
	const token  = P00lsTokenBase.load(event.address) as P00lsTokenBase
	token.isOpened = true
	token.save()
}
