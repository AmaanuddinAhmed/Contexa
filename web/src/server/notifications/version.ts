/**
 * A short string that changes whenever any of a user's connections changes:
 * a new request (count goes up), an accept or decline (latest updatedAt
 * moves), or a removal (count goes down). Pages compare it to decide
 * whether to reload, instead of polling their own data.
 */
export const toConnectionsVersion = (count: number, latestUpdate: Date | null | undefined): string =>
    `${count}:${latestUpdate ? latestUpdate.getTime() : 0}`;