import { convertId, IdConvertType as IdType, convertAccount, convertConversation, convertList, convertStatus } from '../converters.js';
import { ParsedUrlQuery } from "querystring";

export function limitToInt(q: ParsedUrlQuery) {
	let object: any = q;
	if (q.limit)
		if (typeof q.limit === "string") object.limit = parseInt(q.limit, 10);
	if (q.offset)
		if (typeof q.offset === "string") object.offset = parseInt(q.offset, 10);
	return object;
}

export function argsToBools(q: ParsedUrlQuery) {
	// Values taken from https://docs.joinmastodon.org/client/intro/#boolean
	const toBoolean = (value: string) =>
		!["0", "f", "F", "false", "FALSE", "off", "OFF"].includes(value);

	// Keys taken from:
	// - https://docs.joinmastodon.org/methods/accounts/#statuses
	// - https://docs.joinmastodon.org/methods/timelines/#public
	// - https://docs.joinmastodon.org/methods/timelines/#tag
	let object: any = q;
	if (q.only_media)
		if (typeof q.only_media === "string")
			object.only_media = toBoolean(q.only_media);
	if (q.exclude_replies)
		if (typeof q.exclude_replies === "string")
			object.exclude_replies = toBoolean(q.exclude_replies);
	if (q.exclude_reblogs)
		if (typeof q.exclude_reblogs === "string")
			object.exclude_reblogs = toBoolean(q.exclude_reblogs);
	if (q.pinned)
		if (typeof q.pinned === "string") object.pinned = toBoolean(q.pinned);
	if (q.local)
		if (typeof q.local === "string") object.local = toBoolean(q.local);
	return q;
}

export function convertTimelinesArgsId(q: ParsedUrlQuery) {
	if (typeof q.min_id === "string")
		q.min_id = convertId(q.min_id, IdType.SharkeyId);
	if (typeof q.max_id === "string")
		q.max_id = convertId(q.max_id, IdType.SharkeyId);
	if (typeof q.since_id === "string")
		q.since_id = convertId(q.since_id, IdType.SharkeyId);
	return q;
}