
import React, { useMemo } from "react";

function SpendingAnalytics({ transactions = [] }) {
  const analytics = useMemo(() => {
    const completed = transactions.filter(
      (transaction) =>
        String(transaction.status).toUpperCase() === "COMPLETED"
    );

    const currencyTotals = {};
    const monthlyTotals = {};
    const merchantTotals = {};

    const now = new Date();

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - (5 - index),
        1
      );

      return {
        key: `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`,
        label: date.toLocaleString("en", { month: "short" }),
      };
    });

    completed.forEach((transaction) => {
      const amount = Number(transaction.price);
      const currency = transaction.currency || "USD";

      if (!Number.isFinite(amount) || amount < 0) return;

      // Spending totals by currency
      currencyTotals[currency] =
        (currencyTotals[currency] || 0) + amount;

      // Monthly spending by currency
      const date = new Date(transaction.date);

      if (!Number.isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthlyTotals[currency]) {
          monthlyTotals[currency] = {};
        }

        monthlyTotals[currency][monthKey] =
          (monthlyTotals[currency][monthKey] || 0) + amount;
      }

      // Merchant transaction counts
      const merchant =
        transaction.merchant?.trim() || "Unknown merchant";

      const merchantKey = merchant.toLowerCase();

      if (!merchantTotals[merchantKey]) {
        merchantTotals[merchantKey] = {
          name: merchant,
          count: 0,
          currencies: {},
        };
      }

      merchantTotals[merchantKey].count += 1;

      merchantTotals[merchantKey].currencies[currency] =
        (merchantTotals[merchantKey].currencies[currency] || 0) +
        amount;
    });

    const topMerchants = Object.values(merchantTotals)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      completed,
      currencyTotals,
      monthlyTotals,
      months,
      topMerchants,
    };
  }, [transactions]);

  const formatAmount = (amount, currency) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const currencies = Object.keys(analytics.currencyTotals);

  const maxMonthlyAmount = (currency) => {
    const values = analytics.months.map(
      (month) =>
        analytics.monthlyTotals[currency]?.[month.key] || 0
    );

    return Math.max(...values, 1);
  };

  return (
    <section className="standalone-page">
      <div className="eyebrow">FINANCIAL INSIGHTS</div>

      <h1>
        Smart Spending <span>Analytics.</span>
      </h1>

      <p className="page-description">
        Understand your completed payment activity and monthly spending
        patterns.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Completed transactions</span>
            <span className="stat-icon purple">↔</span>
          </div>

          <h2>{analytics.completed.length}</h2>

          <p>Successfully completed payments</p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Tracked currencies</span>
            <span className="stat-icon blue">¤</span>
          </div>

          <h2>{currencies.length}</h2>

          <p>Separate currency spending records</p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Unique merchants</span>
            <span className="stat-icon green">⌕</span>
          </div>

          <h2>{analytics.topMerchants.length > 0
            ? Object.keys(
                analytics.completed.reduce((result, transaction) => {
                  const merchant =
                    transaction.merchant?.trim().toLowerCase() ||
                    "unknown merchant";

                  result[merchant] = true;
                  return result;
                }, {})
              ).length
            : 0}</h2>

          <p>Merchants in your completed history</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24, padding: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Total spending</h2>
            <p>Your completed spending, grouped by currency.</p>
          </div>
        </div>

        {currencies.length === 0 ? (
          <p>No completed payment data is available yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginTop: 18,
            }}
          >
            {currencies.map((currency) => (
              <div
                key={currency}
                className="stat-card"
              >
                <p>{currency} spending</p>

                <h2 style={{ marginTop: 10, overflowWrap: "anywhere" }}>
                  {formatAmount(
                    analytics.currencyTotals[currency],
                    currency
                  )}
                </h2>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 24, padding: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Monthly spending trends</h2>
            <p>Completed payments during the last six months.</p>
          </div>
        </div>

        {currencies.length === 0 ? (
          <p>No spending trends to display yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 28, marginTop: 24 }}>
            {currencies.map((currency) => {
              const maximum = maxMonthlyAmount(currency);

              return (
                <div key={currency}>
                  <h3 style={{ marginBottom: 16 }}>
                    {currency}
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                      gap: 10,
                      alignItems: "end",
                      minHeight: 180,
                    }}
                  >
                    {analytics.months.map((month) => {
                      const amount =
                        analytics.monthlyTotals[currency]?.[
                          month.key
                        ] || 0;

                      const height =
                        amount > 0
                          ? Math.max((amount / maximum) * 125, 5)
                          : 3;

                      return (
                        <div
                          key={month.key}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "end",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              opacity: 0.7,
                              textAlign: "center",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {amount > 0
                              ? formatAmount(amount, currency)
                              : "—"}
                          </span>

                          <div
                            title={`${month.label}: ${formatAmount(
                              amount,
                              currency
                            )}`}
                            style={{
                              width: "100%",
                              maxWidth: 46,
                              height,
                              minHeight: 3,
                              borderRadius: "7px 7px 2px 2px",
                              background:
                                "linear-gradient(180deg, #8b78ff, #4d45c7)",
                            }}
                          />

                          <span style={{ fontSize: 12, opacity: 0.7 }}>
                            {month.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 24, padding: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Top merchants</h2>
            <p>Merchants ranked by number of completed transactions.</p>
          </div>
        </div>

        {analytics.topMerchants.length === 0 ? (
          <p>No merchant activity available yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {analytics.topMerchants.map((merchant, index) => (
              <div
                key={merchant.name}
                className="stat-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <strong>
                    {index + 1}. {merchant.name}
                  </strong>

                  <p style={{ marginTop: 5 }}>
                    {merchant.count} completed transaction
                    {merchant.count === 1 ? "" : "s"}
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  {Object.entries(merchant.currencies).map(
                    ([currency, amount]) => (
                      <p key={currency} style={{ fontSize: 13 }}>
                        {formatAmount(amount, currency)}
                      </p>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="risk-disclaimer" style={{ marginTop: 20 }}>
        Analytics are calculated from completed transactions available
        in your account. They do not include pending or failed payments.
      </p>
    </section>
  );
}

export default SpendingAnalytics;
