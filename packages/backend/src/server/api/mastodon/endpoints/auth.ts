import type { MegalodonInterface } from "megalodon";
import type { FastifyRequest } from 'fastify';

const readScope = [
	"read:account",
	"read:drive",
	"read:blocks",
	"read:favorites",
	"read:following",
	"read:messaging",
	"read:mutes",
	"read:notifications",
	"read:reactions",
	"read:pages",
	"read:page-likes",
	"read:user-groups",
	"read:channels",
	"read:gallery",
	"read:gallery-likes",
];

const writeScope = [
	"write:account",
	"write:drive",
	"write:blocks",
	"write:favorites",
	"write:following",
	"write:messaging",
	"write:mutes",
	"write:notes",
	"write:notifications",
	"write:reactions",
	"write:votes",
	"write:pages",
	"write:page-likes",
	"write:user-groups",
	"write:channels",
	"write:gallery",
	"write:gallery-likes",
];

export async function apiAuthMastodon(request: FastifyRequest, client: MegalodonInterface) {
		const body: any = request.body || request.query;
		try {
			let scope = body.scopes;
			if (typeof scope === "string") scope = scope.split(" ");
			const pushScope = new Set<string>();
			for (const s of scope) {
				if (s.match(/^read/)) for (const r of readScope) pushScope.add(r);
				if (s.match(/^write/)) for (const r of writeScope) pushScope.add(r);
			}
			const scopeArr = Array.from(pushScope);

			const red = body.redirect_uris;
			const appData = await client.registerApp(body.client_name, {
				scopes: scopeArr,
				redirect_uris: red,
				website: body.website,
			});
			const returns = {
				id: Math.floor(Math.random() * 100).toString(),
				name: appData.name,
				website: body.website,
				redirect_uri: red,
				client_id: Buffer.from(appData.url || "").toString("base64"),
				client_secret: appData.clientSecret,
			};
            
			return returns;
		} catch (e: any) {
			console.error(e);
			return e.response.data;
		}
}
