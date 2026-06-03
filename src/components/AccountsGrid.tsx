import { useMemo, useState } from "react";
import type { AccountPoolKind, AccountSummary } from "../types/app";
import { useI18n } from "../i18n/I18nProvider";
import { AccountCard } from "./AccountCard";
import { compareAccountsByRemaining } from "../utils/accountRanking";

type AccountPoolFilter = "all" | AccountPoolKind;

type AccountGroup = {
  id: string;
  variants: AccountSummary[];
};

type AccountPoolSection = {
  id: AccountPoolKind;
  label: string;
  count: number;
  groups: AccountGroup[];
};

type AccountPoolCounts = Record<AccountPoolFilter, number>;

const ACCOUNT_POOL_FILTERS: AccountPoolKind[] = [
  "free",
  "plus",
  "pro",
  "otherPlan",
  "relay",
  "accessOnly",
  "unavailable",
];

const PLAN_PRIORITY: Record<string, number> = {
  api: 0,
  team: 0,
  enterprise: 1,
  business: 2,
  pro: 3,
  plus: 4,
  free: 5,
  unknown: 6,
};

function planPriority(planType: string | null | undefined): number {
  const normalized = planType?.trim().toLowerCase() ?? "";
  return PLAN_PRIORITY[normalized] ?? PLAN_PRIORITY.unknown;
}

function sortVariantsForGroup(left: AccountSummary, right: AccountSummary): number {
  const priorityDiff = planPriority(left.planType ?? left.usage?.planType) - planPriority(right.planType ?? right.usage?.planType);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  if (left.isCurrent !== right.isCurrent) {
    return left.isCurrent ? -1 : 1;
  }

  return compareAccountsByRemaining(left, right);
}

type AccountsGridProps = {
  accounts: AccountSummary[];
  loading: boolean;
  exportingAccounts: boolean;
  refreshingAuthAccountId: string | null;
  switchingId: string | null;
  renamingAccountId: string | null;
  pendingDeleteId: string | null;
  onExport: (account: AccountSummary) => void;
  onRefreshAuth: (account: AccountSummary) => void;
  onReauthorize: (account: AccountSummary) => void;
  onRename: (account: AccountSummary, label: string) => Promise<boolean>;
  onToggleApiProxy: (account: AccountSummary, enabled: boolean) => Promise<boolean>;
  onSwitch: (account: AccountSummary) => void;
  onDelete: (account: AccountSummary) => void;
};

export function AccountsGrid({
  accounts,
  loading,
  exportingAccounts,
  refreshingAuthAccountId,
  switchingId,
  renamingAccountId,
  pendingDeleteId,
  onExport,
  onRefreshAuth,
  onReauthorize,
  onRename,
  onToggleApiProxy,
  onSwitch,
  onDelete,
}: AccountsGridProps) {
  const { copy } = useI18n();
  const [activePool, setActivePool] = useState<AccountPoolFilter>("all");
  const groupedAccounts = useMemo<AccountGroup[]>(() => {
    const groups = new Map<string, AccountSummary[]>();

    for (const account of accounts) {
      const existing = groups.get(account.accountKey);
      if (existing) {
        existing.push(account);
      } else {
        groups.set(account.accountKey, [account]);
      }
    }

    return Array.from(groups.entries()).map(([id, variants]) => {
      const sortedVariants = [...variants].sort(sortVariantsForGroup);
      return {
        id,
        variants: sortedVariants,
      };
    });
  }, [accounts]);

  const accountPoolCounts = useMemo<AccountPoolCounts>(() => {
    const counts: AccountPoolCounts = {
      all: groupedAccounts.length,
      free: 0,
      plus: 0,
      pro: 0,
      otherPlan: 0,
      relay: 0,
      accessOnly: 0,
      unavailable: 0,
    };

    for (const group of groupedAccounts) {
      const groupPools = new Set(group.variants.map((variant) => variant.poolKind));
      for (const poolKind of groupPools) {
        counts[poolKind] += 1;
      }
    }

    return counts;
  }, [groupedAccounts]);

  const visibleGroups = useMemo(
    () => {
      if (activePool === "all") {
        return groupedAccounts;
      }

      return groupedAccounts
        .map((group) => ({
          ...group,
          variants: group.variants.filter((variant) => variant.poolKind === activePool),
        }))
        .filter((group) => group.variants.length > 0);
    },
    [activePool, groupedAccounts],
  );

  const accountPoolLabels = useMemo<Record<AccountPoolKind, string>>(
    () => ({
      free: copy.accountsGrid.poolFree,
      plus: copy.accountsGrid.poolPlus,
      pro: copy.accountsGrid.poolPro,
      otherPlan: copy.accountsGrid.poolOtherPlan,
      relay: copy.accountsGrid.poolRelay,
      accessOnly: copy.accountsGrid.poolAccessOnly,
      unavailable: copy.accountsGrid.poolUnavailable,
    }),
    [
      copy.accountsGrid.poolAccessOnly,
      copy.accountsGrid.poolFree,
      copy.accountsGrid.poolOtherPlan,
      copy.accountsGrid.poolPlus,
      copy.accountsGrid.poolPro,
      copy.accountsGrid.poolRelay,
      copy.accountsGrid.poolUnavailable,
    ],
  );

  const accountPoolSections = useMemo<AccountPoolSection[]>(
    () =>
      ACCOUNT_POOL_FILTERS.map((poolKind) => {
        const groups = groupedAccounts
          .map((group) => ({
            ...group,
            variants: group.variants.filter((variant) => variant.poolKind === poolKind),
          }))
          .filter((group) => group.variants.length > 0);

        return {
          id: poolKind,
          label: accountPoolLabels[poolKind],
          count: accountPoolCounts[poolKind],
          groups,
        };
      }).filter((section) => section.groups.length > 0),
    [accountPoolCounts, accountPoolLabels, groupedAccounts],
  );

  const accountPoolFilters: Array<{ id: AccountPoolFilter; label: string; count: number }> = [
    {
      id: "all",
      label: copy.accountsGrid.poolAll,
      count: accountPoolCounts.all,
    },
    ...ACCOUNT_POOL_FILTERS.map((poolKind) => ({
      id: poolKind,
      label: accountPoolLabels[poolKind],
      count: accountPoolCounts[poolKind],
    })),
  ];

  const emptyTitle =
    groupedAccounts.length === 0 ? copy.accountsGrid.emptyTitle : copy.accountsGrid.emptyFilteredTitle;
  const emptyDescription =
    groupedAccounts.length === 0
      ? copy.accountsGrid.emptyDescription
      : copy.accountsGrid.emptyFilteredDescription;

  const showPoolSections = activePool === "all" && accountPoolSections.length > 0;

  return (
    <section className="accountsGridShell" aria-busy={loading}>
      {groupedAccounts.length > 0 ? (
        <div className="accountTypeFilter" role="group" aria-label={copy.accountsGrid.poolFilterAriaLabel}>
          {accountPoolFilters.map((filter) => {
            const isActive = filter.id === activePool;
            return (
              <button
                key={filter.id}
                type="button"
                className={`accountTypeButton${isActive ? " isActive" : ""}`}
                aria-pressed={isActive}
                onClick={() => setActivePool(filter.id)}
              >
                <span>{filter.label}</span>
                <strong>{filter.count}</strong>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={showPoolSections ? "accountPoolSections" : "cards"}>
        {visibleGroups.length === 0 && !loading && (
          <div className="emptyState">
            <h3>{emptyTitle}</h3>
            <p>{emptyDescription}</p>
          </div>
        )}

        {showPoolSections
          ? accountPoolSections.map((section) => (
              <section className="accountPoolSection" data-pool={section.id} key={section.id}>
                <div className="accountPoolSectionHeader">
                  <h3>{section.label}</h3>
                  <strong>{section.count}</strong>
                </div>
                <div className="accountPoolSectionGrid">
                  {section.groups.map((group) => (
                    <AccountCard
                      key={`${section.id}:${group.id}`}
                      accounts={group.variants}
                      exportingAccounts={exportingAccounts}
                      refreshingAuthAccountId={refreshingAuthAccountId}
                      switchingId={switchingId}
                      renamingAccountId={renamingAccountId}
                      pendingDeleteId={pendingDeleteId}
                      onExport={onExport}
                      onRefreshAuth={onRefreshAuth}
                      onReauthorize={onReauthorize}
                      onRename={onRename}
                      onToggleApiProxy={onToggleApiProxy}
                      onSwitch={onSwitch}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </section>
            ))
          : visibleGroups.map((group) => (
              <AccountCard
                key={group.id}
                accounts={group.variants}
                exportingAccounts={exportingAccounts}
                refreshingAuthAccountId={refreshingAuthAccountId}
                switchingId={switchingId}
                renamingAccountId={renamingAccountId}
                pendingDeleteId={pendingDeleteId}
                onExport={onExport}
                onRefreshAuth={onRefreshAuth}
                onReauthorize={onReauthorize}
                onRename={onRename}
                onToggleApiProxy={onToggleApiProxy}
                onSwitch={onSwitch}
                onDelete={onDelete}
              />
            ))}
      </div>
    </section>
  );
}
