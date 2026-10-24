export const toConnectionsVersion = (count: number, latestUpdate: Date | null | undefined): string =>
    `${count}:${latestUpdate ? latestUpdate.getTime() : 0}`;