import { apiAuthMastodon } from './endpoints/auth.js';
import { apiAccountMastodon } from './endpoints/account.js';
import { apiSearchMastodon } from './endpoints/search.js';
import { apiNotifyMastodon } from './endpoints/notifications.js';
import { apiFilterMastodon } from './endpoints/filter.js';
import { apiTimelineMastodon } from './endpoints/timeline.js';
import { apiStatusMastodon } from './endpoints/status.js';

export {
    apiAccountMastodon,
    apiAuthMastodon,
    apiSearchMastodon,
    apiNotifyMastodon,
    apiFilterMastodon,
    apiTimelineMastodon,
    apiStatusMastodon
}
