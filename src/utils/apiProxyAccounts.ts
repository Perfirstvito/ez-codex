import type { AccountPoolKind, AccountSummary, ApiProxyAccountPoolFilter } from "../types/app";

/**
 * 反代无法使用的账号池。
 *
 * 与 Rust 侧 `account_to_proxy_candidate` 的丢弃条件一一对应：
 * relay 账号取不出 ChatGPT 登录态，unavailable 账号的 access_token 已过期。
 */
const UNPROXYABLE_POOL_KINDS: ReadonlySet<AccountPoolKind> = new Set<AccountPoolKind>([
  "relay",
  "unavailable",
]);

/** 判断账号在当前筛选下是否会被反代选中，口径与后端候选账号加载保持一致。 */
export function isApiProxyCandidate(
  account: AccountSummary,
  poolFilter: ApiProxyAccountPoolFilter,
): boolean {
  if (!account.apiProxyEnabled || UNPROXYABLE_POOL_KINDS.has(account.poolKind)) {
    return false;
  }
  return poolFilter === "all" || account.poolKind === poolFilter;
}

/** 统计当前筛选下反代实际可用的账号数。 */
export function countApiProxyCandidates(
  accounts: AccountSummary[],
  poolFilter: ApiProxyAccountPoolFilter,
): number {
  return accounts.filter((account) => isApiProxyCandidate(account, poolFilter)).length;
}
