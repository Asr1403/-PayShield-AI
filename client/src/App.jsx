
import { useCallback, useEffect, useRef, useState } from "react";
import SecurityAlerts from "./components/SecurityAlerts";
import "./App.css";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

function normalizeTransaction(transaction) {
  return {
    id: transaction.orderID || transaction.id || transaction._id,
    product: transaction.product || "Purchase",
    merchant: transaction.merchant || "",
    price: transaction.amount ?? transaction.price ?? "",
    currency: transaction.currency || "USD",
    status: transaction.status || "COMPLETED",
    provider: transaction.provider || "Payment Gateway",
    date: transaction.createdAt || transaction.date || new Date().toISOString(),
  };
}

// SMART SPENDING ANALYTICS
function getSpendingAnalytics(transactions) {
  const completedTransactions = transactions.filter(
    (transaction) =>
      String(transaction.status).toUpperCase() === "COMPLETED"
  );

  const currencyTotals = {};
  const merchantTotals = {};
  const currencyCounts = {};

  let validTransactionCount = 0;

  completedTransactions.forEach((transaction) => {
    const amount = Number(transaction.price);

    if (!Number.isFinite(amount) || amount <= 0) return;

    const currency = transaction.currency || "USD";
    const merchant = transaction.merchant?.trim() || "Unknown merchant";

    currencyTotals[currency] = (currencyTotals[currency] || 0) + amount;
    currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;

    const merchantKey = `${currency}::${merchant}`;

    if (!merchantTotals[merchantKey]) {
      merchantTotals[merchantKey] = {
        merchant,
        currency,
        total: 0,
        count: 0,
      };
    }

    merchantTotals[merchantKey].total += amount;
    merchantTotals[merchantKey].count += 1;

    validTransactionCount += 1;
  });

  const merchants = Object.values(merchantTotals).sort(
    (a, b) => b.total - a.total
  );

  const currencies = Object.keys(currencyTotals).map((currency) => ({
    currency,
    total: currencyTotals[currency],
    count: currencyCounts[currency],
    average: currencyTotals[currency] / currencyCounts[currency],
  }));

  currencies.sort((a, b) => b.total - a.total);

  return {
    completedCount: completedTransactions.length,
    validTransactionCount,
    currencyTotals: currencies,
    merchants,
    topMerchant: merchants[0] || null,
  };
}

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

// Load Razorpay Checkout only when needed.
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load Razorpay Checkout.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () =>
      reject(new Error("Unable to load Razorpay Checkout. Check your internet connection."));

    document.body.appendChild(script);
  });
}

// AI FRAUD DETECTION RESULTS
function RiskAssessment({ analysis, loading, error }) {
  if (loading) {
    return (
      <div className="analysis-result">
        <div className="pending-icon">◷</div>
        <h3>Analysing your purchase...</h3>
        <p>Groq AI is reviewing the purchase details and transaction history. Please wait.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis-result">
        <div className="pending-icon">!</div>
        <h3>Analysis failed</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="empty-analysis">
        <div className="shield-illustration">
          <span>◇</span>
        </div>
        <h3>Ready to review</h3>
        <p>
          Submit purchase details to prepare an AI-powered risk assessment.
        </p>
        <div className="risk-legend">
          <span><i className="low"></i> Low</span>
          <span><i className="medium"></i> Medium</span>
          <span><i className="high"></i> High</span>
        </div>
      </div>
    );
  }

  const riskLevel = analysis.riskLevel || "Low";
  const riskClass = riskLevel.toLowerCase();

  const riskScore = Math.max(
    0,
    Math.min(100, Number(analysis.riskScore) || 0)
  );

  const aiRiskScore = Number(analysis.aiRiskScore ?? riskScore);
  const ruleRiskScore = Number(analysis.ruleRiskScore ?? 0);

  const history = analysis.historyContext || {};

  const fraudSignals = Array.isArray(analysis.fraudSignals)
    ? analysis.fraudSignals
    : [];

  const warningSigns = Array.isArray(analysis.warningSigns)
    ? analysis.warningSigns
    : [];

  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
    : [];

  const getSignalText = (signal) => {
    if (typeof signal === "string") return signal;

    return (
      signal?.message ||
      signal?.description ||
      signal?.signal ||
      signal?.reason ||
      JSON.stringify(signal)
    );
  };

  return (
    <div className="analysis-result">
      {/* OVERALL RISK */}
      <div className={`risk-result-icon ${riskClass}`}>
        {riskLevel === "Low" ? "✓" : riskLevel === "Medium" ? "!" : "⚠"}
      </div>

      <h3 className={`risk-heading ${riskClass}`}>
        {riskLevel} Risk
      </h3>

      <div className="risk-score">
        <strong>{riskScore}</strong>
        <span>/ 100 Risk Score</span>
      </div>

      <div className="risk-progress">
        <div
          className={`risk-progress-fill ${riskClass}`}
          style={{
            width: `${riskScore}%`,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      <p className="risk-summary">{analysis.summary}</p>

      {/* SCORE BREAKDOWN */}
      <div
        className="risk-details"
        style={{
          marginTop: 24,
          padding: 18,
          borderRadius: 14,
          background: "rgba(120, 100, 255, 0.07)",
          border: "1px solid rgba(150, 130, 255, 0.18)",
        }}
      >
        <h4>Risk Score Breakdown</h4>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "rgba(120, 100, 255, 0.10)",
            }}
          >
            <p style={{ fontSize: 12, opacity: 0.7 }}>Groq AI Score</p>
            <h2 style={{ marginTop: 8 }}>
              {aiRiskScore}
              <span style={{ fontSize: 13, opacity: 0.6 }}> / 100</span>
            </h2>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "rgba(40, 190, 140, 0.08)",
            }}
          >
            <p style={{ fontSize: 12, opacity: 0.7 }}>Rule-Based Score</p>
            <h2 style={{ marginTop: 8 }}>
              {ruleRiskScore}
              <span style={{ fontSize: 13, opacity: 0.6 }}> / 100</span>
            </h2>
          </div>
        </div>

        <p style={{ fontSize: 12, opacity: 0.65, marginTop: 14 }}>
          The final score uses the higher of the AI score and transaction-history rule score.
        </p>
      </div>

      {/* FRAUD SIGNALS */}
      <div
        className="risk-details"
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 14,
          background: "rgba(120, 100, 255, 0.05)",
        }}
      >
        <h4>Fraud Detection Signals</h4>

        {fraudSignals.length > 0 ? (
          <ul style={{ paddingLeft: 20, marginTop: 12 }}>
            {fraudSignals.map((signal, index) => (
              <li key={index} style={{ marginBottom: 10 }}>
                {getSignalText(signal)}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: "#35c995" }}>
              ✓ No rule-based fraud signals detected.
            </p>
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
              This does not guarantee that the transaction is safe.
            </p>
          </div>
        )}
      </div>

      {/* TRANSACTION HISTORY */}
      <div
        className="risk-details"
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 14,
          background: "rgba(120, 100, 255, 0.05)",
        }}
      >
        <h4>Transaction History Insights</h4>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          <div>
            <p style={{ fontSize: 12, opacity: 0.65 }}>Transactions reviewed</p>
            <h3 style={{ marginTop: 5 }}>
              {history.transactionsReviewed ?? "—"}
            </h3>
          </div>

          <div>
            <p style={{ fontSize: 12, opacity: 0.65 }}>Same-currency transactions</p>
            <h3 style={{ marginTop: 5 }}>
              {history.sameCurrencyTransactions ?? "—"}
            </h3>
          </div>

          <div>
            <p style={{ fontSize: 12, opacity: 0.65 }}>Transactions in last hour</p>
            <h3 style={{ marginTop: 5 }}>
              {history.recentTransactionsLastHour ?? "—"}
            </h3>
          </div>

          <div>
            <p style={{ fontSize: 12, opacity: 0.65 }}>Currency</p>
            <h3 style={{ marginTop: 5 }}>
              {history.currency || "—"}
            </h3>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 9,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <p style={{ fontSize: 12, opacity: 0.65 }}>
            Median purchase amount
          </p>
          <strong>
            {history.medianPurchaseAmount != null
              ? `${history.currency || ""} ${history.medianPurchaseAmount}`
              : "Not available"}
          </strong>
        </div>

        <div style={{ marginTop: 16 }}>
          {history.sufficientHistory ? (
            <p style={{ color: "#35c995", fontSize: 13 }}>
              ✓ Sufficient transaction history for personal comparisons.
            </p>
          ) : (
            <p style={{ color: "#f5b942", fontSize: 13 }}>
              ! Limited transaction history. More completed transactions in this currency are needed for a reliable personal spending baseline.
            </p>
          )}
        </div>
      </div>

      {/* WARNING SIGNS */}
      <div className="risk-details">
        <h4>Potential Warning Signs</h4>

        {warningSigns.length > 0 ? (
          <ul>
            {warningSigns.map((item, index) => (
              <li key={index}>{getSignalText(item)}</li>
            ))}
          </ul>
        ) : (
          <p>
            No specific warning signs were identified from the supplied details.
          </p>
        )}
      </div>

      {/* RECOMMENDATIONS */}
      <div className="risk-details">
        <h4>AI Safety Recommendations</h4>

        {recommendations.length > 0 ? (
          <ul>
            {recommendations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>
            Review the merchant's details independently before paying.
          </p>
        )}
      </div>

      {/* LIVE SECURITY RESEARCH - TAVILY */}
      <div
        className="risk-details"
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 14,
          background: "rgba(40, 150, 220, 0.07)",
          border: "1px solid rgba(70, 160, 230, 0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h4>Live Security Research</h4>
          <span
            style={{
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 20,
              background: analysis.liveResearchEnabled
                ? "rgba(53, 201, 149, 0.12)"
                : "rgba(245, 185, 66, 0.12)",
              color: analysis.liveResearchEnabled
                ? "#35c995"
                : "#f5b942",
            }}
          >
            {analysis.liveResearchEnabled
              ? "● LIVE RESEARCH"
              : "● RESEARCH UNAVAILABLE"}
          </span>
        </div>

        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 10 }}>
          {analysis.liveResearchMessage ||
            "Live security research status is unavailable."}
        </p>

        {Array.isArray(analysis.recommendationSources) &&
        analysis.recommendationSources.length > 0 ? (
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {analysis.recommendationSources.map((source, index) => {
              const validUrl = (() => {
                try {
                  const url = new URL(source.url);
                  return url.protocol === "https:" ? url.href : null;
                } catch {
                  return null;
                }
              })();

              return (
                <div
                  key={`${source.url || index}-${index}`}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(150,150,180,0.14)",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>
                    {source.title || "Security guidance"}
                  </strong>

                  {source.snippet && (
                    <p
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        lineHeight: 1.6,
                        marginTop: 8,
                      }}
                    >
                      {source.snippet}
                    </p>
                  )}

                  {source.publishedDate && (
                    <p
                      style={{
                        fontSize: 11,
                        opacity: 0.55,
                        marginTop: 8,
                      }}
                    >
                      Published: {source.publishedDate}
                    </p>
                  )}

                  {validUrl && (
                    <a
                      href={validUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        marginTop: 10,
                        color: "#70aaff",
                        fontSize: 12,
                        textDecoration: "none",
                      }}
                    >
                      View trusted source ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, opacity: 0.75 }}>
              No matching trusted-source articles were returned for this
              purchase. Use the AI recommendations above as general
              guidance and independently verify the seller.
            </p>
          </div>
        )}

        <p
          style={{
            fontSize: 11,
            opacity: 0.55,
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          Research snippets are informational references. They do not
          independently verify a merchant or prove that a transaction
          is fraudulent.
        </p>
      </div>

      {/* ASSESSMENT METHOD */}
      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 10,
          background: "rgba(120, 100, 255, 0.07)",
        }}
      >
        <p style={{ fontSize: 12, opacity: 0.65 }}>
          Assessment method
        </p>
        <strong style={{ fontSize: 13 }}>
          {analysis.riskMethod || "AI-powered risk assessment"}
        </strong>
      </div>

      {/* DISCLAIMER */}
      <p className="risk-disclaimer">
        {analysis.disclaimer ||
          "This is an AI-generated advisory assessment supported by transaction-history checks. It does not verify merchant identity, prove fraud, or guarantee transaction safety."}
      </p>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState("");

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const paymentReturnHandled = useRef(false);
  const razorpayVerificationInProgress = useRef(false);

  const [purchase, setPurchase] = useState({
    product: "",
    merchant: "",
    price: "",
    currency: "USD",
    description: "",
  });

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [analysisCount, setAnalysisCount] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);

  const selectedCurrency = purchase.currency;
  const isINR = selectedCurrency === "INR";

  const userInitial =
    authUser?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  const navigation = [
    { name: "Overview", icon: "◫" },
    { name: "New Analysis", icon: "⌕" },
    { name: "Transactions", icon: "↔" },
    { name: "Analytics", icon: "▥" },
    { name: "Security Alerts", icon: "🔔" },
  ];

  // Calculate spending analytics from saved transactions.
  const spendingAnalytics = getSpendingAnalytics(transactions);

  // Check the logged-in user.
  useEffect(() => {
    let active = true;

    fetch(`${API_URL}/auth/me`, {
      credentials: "include",
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Not signed in");
        }

        if (active) setAuthUser(data.user);
      })
      .catch(() => {
        if (active) setAuthUser(null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAuthChange = (e) => {
    setAuthForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");

    if (
      authMode === "register" &&
      authForm.password !== authForm.confirmPassword
    ) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/${authMode}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          authMode === "register"
            ? {
                name: authForm.name,
                email: authForm.email,
                password: authForm.password,
              }
            : {
                email: authForm.email,
                password: authForm.password,
              }
        ),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Authentication failed.");
      }

      setAuthUser(data.user);
      setAuthForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    } catch (err) {
      setAuthError(err.message || "Unable to authenticate.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setAuthUser(null);
      setTransactions([]);
      setAnalysis(null);
      setActivePage("Overview");
    }
  };

  // Load saved transactions.
  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsError("");

    try {
      const response = await fetch(`${API_URL}/transactions`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load transaction history.");
      }

      const savedTransactions = Array.isArray(data.transactions)
        ? data.transactions.map(normalizeTransaction)
        : [];

      setTransactions(savedTransactions);
    } catch (err) {
      console.error("Transaction history error:", err);
      setTransactionsError(
        err.message || "Unable to connect to transaction history."
      );
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser) {
      loadTransactions();
    } else {
      setTransactions([]);
      setTransactionsLoading(false);
    }
  }, [authUser, loadTransactions]);

  // Handle PayPal return and capture.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get("paypal");

    if (paypalStatus === "cancel") {
      setPaymentMessage(
        "PayPal checkout was cancelled. No payment was captured."
      );
      setActivePage("New Analysis");

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      localStorage.removeItem("payshield_pending_purchase");
      return;
    }

    const orderID = params.get("token");

    if (
      paypalStatus !== "success" ||
      !orderID ||
      paymentReturnHandled.current
    ) {
      return;
    }

    paymentReturnHandled.current = true;
    setPaymentLoading(true);
    setPaymentError("");
    setPaymentMessage("Confirming your PayPal payment...");
    setActivePage("Transactions");

    const capturePayment = async () => {
      try {
        const response = await fetch(
          `${API_URL}/paypal/capture-order`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderID }),
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          data.status !== "COMPLETED"
        ) {
          throw new Error(
            data.message || "PayPal could not confirm the payment."
          );
        }

        await loadTransactions();

        setPaymentMessage(
          "Payment completed successfully in PayPal Sandbox."
        );

        localStorage.removeItem("payshield_pending_purchase");
      } catch (err) {
        console.error("PayPal capture error:", err);
        setPaymentError(
          err.message || "Unable to confirm the PayPal payment."
        );
        setPaymentMessage("");
      } finally {
        setPaymentLoading(false);

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    };

    capturePayment();
  }, [loadTransactions]);

  // Shared purchase validation.
  const validateCheckout = () => {
    if (!analysis) {
      setPaymentError(
        "Please analyse the purchase before continuing to checkout."
      );
      return false;
    }

    if (
      !purchase.product.trim() ||
      !purchase.price ||
      !Number.isFinite(Number(purchase.price)) ||
      Number(purchase.price) <= 0
    ) {
      setPaymentError("Enter a valid product and price before checkout.");
      return false;
    }

    return true;
  };

  // PayPal checkout for USD, EUR and GBP.
  const handlePayPalCheckout = async () => {
    if (purchase.currency === "INR") {
      setPaymentError("INR payments must use Razorpay.");
      return;
    }

    if (!validateCheckout()) return;

    setPaymentLoading(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const response = await fetch(`${API_URL}/paypal/create-order`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: purchase.product,
          merchant: purchase.merchant,
          price: Number(purchase.price),
          currency: purchase.currency,
        }),
      });

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.approvalUrl ||
        !data.orderID
      ) {
        throw new Error(
          data.message || "Unable to create a PayPal Sandbox order."
        );
      }

      localStorage.setItem(
        "payshield_pending_purchase",
        JSON.stringify({
          product: purchase.product,
          merchant: purchase.merchant,
          price: Number(purchase.price).toFixed(2),
          currency: purchase.currency,
          orderID: data.orderID,
        })
      );

      window.location.assign(data.approvalUrl);
    } catch (err) {
      console.error("PayPal order creation error:", err);
      setPaymentError(
        err.message || "Unable to connect to PayPal Sandbox."
      );
      setPaymentLoading(false);
    }
  };

  // Razorpay checkout for INR.
  const handleRazorpayCheckout = async () => {
    if (!validateCheckout()) return;

    if (purchase.currency !== "INR") {
      setPaymentError("Razorpay checkout is currently configured for INR.");
      return;
    }

    if (razorpayVerificationInProgress.current) return;

    setPaymentLoading(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      await loadRazorpayScript();

      const response = await fetch(
        `${API_URL}/razorpay/create-order`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product: purchase.product,
            merchant: purchase.merchant,
            price: Number(purchase.price),
            currency: "INR",
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.orderID ||
        !data.keyId ||
        !data.amount
      ) {
        throw new Error(
          data.message || "Unable to create a Razorpay order."
        );
      }

      localStorage.setItem(
        "payshield_pending_purchase",
        JSON.stringify({
          product: purchase.product,
          merchant: purchase.merchant,
          price: Number(purchase.price).toFixed(2),
          currency: "INR",
          orderID: data.orderID,
          provider: "Razorpay",
        })
      );

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "PayShield AI",
        description: purchase.product,
        order_id: data.orderID,

        prefill: {
          name: authUser?.name || "",
          email: authUser?.email || "",
        },

        theme: {
          color: "#2563eb",
        },

        handler: async (paymentResponse) => {
          if (razorpayVerificationInProgress.current) return;

          razorpayVerificationInProgress.current = true;
          setPaymentLoading(true);
          setPaymentError("");
          setPaymentMessage(
            "Payment received. Verifying payment securely..."
          );

          try {
            const verifyResponse = await fetch(
              `${API_URL}/razorpay/verify-payment`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  orderID: paymentResponse.razorpay_order_id,
                  paymentID: paymentResponse.razorpay_payment_id,
                  signature: paymentResponse.razorpay_signature,

                  razorpay_order_id: paymentResponse.razorpay_order_id,
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_signature: paymentResponse.razorpay_signature,
                }),
              }
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData.message ||
                  "Razorpay payment verification failed."
              );
            }

            await loadTransactions();

            setPaymentMessage(
              "Razorpay payment verified successfully!"
            );
            setPaymentError("");
            setActivePage("Transactions");

            localStorage.removeItem("payshield_pending_purchase");
          } catch (err) {
            console.error("Razorpay verification error:", err);

            setPaymentError(
              err.message ||
                "Unable to verify the Razorpay payment. Contact support before retrying."
            );

            setPaymentMessage("");
          } finally {
            razorpayVerificationInProgress.current = false;
            setPaymentLoading(false);
          }
        },

        modal: {
          ondismiss: () => {
            if (!razorpayVerificationInProgress.current) {
              setPaymentLoading(false);
              setPaymentMessage(
                "Razorpay checkout was closed. No successful payment has been confirmed."
              );
            }
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (failure) => {
        console.error("Razorpay payment failed:", failure);

        setPaymentLoading(false);
        setPaymentError(
          failure?.error?.description ||
            "Razorpay payment failed. Please try again."
        );
        setPaymentMessage("");
      });

      razorpay.open();
    } catch (err) {
      console.error("Razorpay checkout error:", err);

      setPaymentError(
        err.message || "Unable to start Razorpay Checkout."
      );

      setPaymentLoading(false);
    }
  };

  // Automatically select the correct gateway.
  const handleCheckout = () => {
    setPaymentError("");
    setPaymentMessage("");

    if (purchase.currency === "INR") {
      handleRazorpayCheckout();
    } else {
      handlePayPalCheckout();
    }
  };

  const handleChange = (e) => {
    setPurchase((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));

    setPaymentError("");
    setPaymentMessage("");
  };

  // AI PURCHASE ANALYSIS
  const handleAnalysis = async (e) => {
    e.preventDefault();

    if (
      !purchase.product.trim() ||
      !purchase.merchant.trim() ||
      !purchase.price
    ) {
      alert("Please fill in the product, merchant and price.");
      return;
    }

    if (
      !Number.isFinite(Number(purchase.price)) ||
      Number(purchase.price) <= 0
    ) {
      alert("Please enter a valid purchase price.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis(null);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const response = await fetch(`${API_URL}/ai/analyze`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(purchase),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to analyse this purchase."
        );
      }

      setAnalysis(data.analysis);
      setAnalysisCount((count) => count + 1);

      if (data.analysis.riskLevel === "High") {
        setHighRiskCount((count) => count + 1);
      }
    } catch (err) {
      console.error("Purchase analysis error:", err);
      setError(
        err.message ||
          "Unable to connect to PayShield AI. Check your backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const changePage = (page) => {
    setActivePage(page);
  };

  // Reusable payment button.
  const checkoutButton = (
    <div style={{ marginTop: "20px" }}>
      <button
        type="button"
        className="primary-button full-button"
        onClick={handleCheckout}
        disabled={paymentLoading || loading}
      >
        {paymentLoading
          ? "Processing payment..."
          : isINR
          ? "Continue to Razorpay →"
          : "Continue to PayPal Sandbox →"}
      </button>

      <p
        style={{
          fontSize: "12px",
          opacity: 0.75,
          marginTop: "10px",
        }}
      >
        Test checkout only. No real money will be charged.
        {isINR
          ? " INR payments use Razorpay Test Mode."
          : " Payments use PayPal Sandbox."}
      </p>

      {paymentError && (
        <p role="alert" style={{ color: "#ff7777" }}>
          {paymentError}
        </p>
      )}

      {paymentMessage && (
        <p role="status">{paymentMessage}</p>
      )}
    </div>
  );

  // AUTH LOADING
  if (authLoading) {
    return (
      <div className="app-shell">
        <main className="main-content">
          <div className="page-content">
            <div
              className="panel"
              style={{
                maxWidth: 460,
                margin: "12vh auto",
                padding: 32,
                textAlign: "center",
              }}
            >
              Checking your PayShield AI session...
            </div>
          </div>
        </main>
      </div>
    );
  }

  // LOGIN / REGISTER
  if (!authUser) {
    return (
      <div
        className="app-shell"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <section
          className="panel"
          style={{
            width: "100%",
            maxWidth: 460,
            padding: 32,
          }}
        >
          <div className="brand" style={{ marginBottom: 28 }}>
            <div className="brand-icon">P</div>
            <div>
              <h2>
                PayShield<span>AI</span>
              </h2>
              <p>SECURE PAYMENT WORKSPACE</p>
            </div>
          </div>

          <h1 style={{ marginBottom: 8 }}>
            {authMode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p style={{ marginBottom: 24 }}>
            {authMode === "login"
              ? "Sign in to access your private purchase reviews and transactions."
              : "Register to securely manage your purchase reviews and payments."}
          </p>

          <form onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <div className="form-group">
                <label>FULL NAME</label>
                <input
                  name="name"
                  value={authForm.name}
                  onChange={handleAuthChange}
                  autoComplete="name"
                  maxLength="80"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>EMAIL ADDRESS</label>
              <input
                type="email"
                name="email"
                value={authForm.email}
                onChange={handleAuthChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label>PASSWORD</label>
              <input
                type="password"
                name="password"
                value={authForm.password}
                onChange={handleAuthChange}
                autoComplete={
                  authMode === "login"
                    ? "current-password"
                    : "new-password"
                }
                minLength="8"
                required
              />
            </div>

            {authMode === "register" && (
              <div className="form-group">
                <label>CONFIRM PASSWORD</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={authForm.confirmPassword}
                  onChange={handleAuthChange}
                  autoComplete="new-password"
                  minLength="8"
                  required
                />
              </div>
            )}

            {authError && (
              <p
                role="alert"
                style={{
                  color: "#ff7777",
                  marginBottom: 14,
                }}
              >
                {authError}
              </p>
            )}

            <button
              className="primary-button full-button"
              type="submit"
              disabled={authSubmitting}
            >
              {authSubmitting
                ? "Please wait..."
                : authMode === "login"
                ? "Sign in →"
                : "Create account →"}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: "center" }}>
            {authMode === "login"
              ? "New to PayShield AI? "
              : "Already have an account? "}

            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode(
                  authMode === "login" ? "register" : "login"
                );
                setAuthError("");
              }}
            >
              {authMode === "login"
                ? "Create an account"
                : "Sign in"}
            </button>
          </p>

          <p
            className="risk-disclaimer"
            style={{ marginTop: 20 }}
          >
            Your session uses an HttpOnly authentication cookie.
            Never share your password.
          </p>
        </section>
      </div>
    );
  }

  // MAIN DASHBOARD
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <h2>
              PayShield<span>AI</span>
            </h2>
            <p>SMART PAYMENT SECURITY</p>
          </div>
        </div>

        <div className="sidebar-label">MENU</div>

        <nav className="navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activePage === item.name ? "active" : ""
              }`}
              onClick={() => changePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}

              {item.name === "New Analysis" && (
                <span className="nav-new">NEW</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon">✦</div>
            <h3>Stay protected</h3>
            <p>
              Review purchase details before proceeding to checkout.
            </p>
          </div>

          <div className="profile">
            <div className="avatar">{userInitial}</div>

            <div>
              <h4>{authUser.name}</h4>
              <p>{authUser.email}</p>
            </div>

            <button
              type="button"
              className="profile-menu"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              ↪
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <div className="system-status">
              <span className="status-dot"></span>
              System online
            </div>

            <div className="top-avatar">{userInitial}</div>
          </div>
        </header>

        <div className="page-content">
          {/* OVERVIEW */}
          {activePage === "Overview" && (
            <>
              <section className="welcome-section">
                <div>
                  <div className="eyebrow">
                    PAYMENT SECURITY CENTER
                  </div>

                  <h1>
                    Your payments, <span>protected.</span>
                  </h1>

                  <p>
                    Review purchase details and identify potential warning signs before making a payment.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => changePage("New Analysis")}
                >
                  <span>＋</span> Analyse a purchase
                </button>
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Purchases analysed</span>
                    <span className="stat-icon purple">⌕</span>
                  </div>
                  <h2>{analysisCount}</h2>
                  <p>Analyses during this session</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Payments completed</span>
                    <span className="stat-icon green">↗</span>
                  </div>
                  <h2>{transactions.length}</h2>
                  <p>Completed payments across gateways</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>High-risk alerts</span>
                    <span className="stat-icon red">!</span>
                  </div>
                  <h2>{highRiskCount}</h2>
                  <p>High-risk assessments this session</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Protection status</span>
                    <span className="stat-icon blue">◇</span>
                  </div>
                  <h2 className="stat-ready">AI Active</h2>
                  <p>Groq AI advisory connected</p>
                </div>
              </section>

              <section className="content-grid">
                <div className="panel purchase-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Start a purchase review</h2>
                      <p>Check the details before checkout.</p>
                    </div>
                    <span className="heading-icon">✦</span>
                  </div>

                  <form onSubmit={handleAnalysis}>
                    <div className="form-group">
                      <label>PRODUCT NAME</label>
                      <input
                        name="product"
                        value={purchase.product}
                        onChange={handleChange}
                        placeholder="e.g. Wireless headphones"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>MERCHANT / WEBSITE</label>
                      <input
                        name="merchant"
                        value={purchase.merchant}
                        onChange={handleChange}
                        placeholder="e.g. example-store.com"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>PRICE</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          name="price"
                          value={purchase.price}
                          onChange={handleChange}
                          placeholder="99.99"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>CURRENCY</label>
                        <select
                          name="currency"
                          value={purchase.currency}
                          onChange={handleChange}
                        >
                          <option value="USD">USD ($)</option>
                          <option value="INR">INR (₹)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>
                        ADDITIONAL DETAILS <span>OPTIONAL</span>
                      </label>
                      <textarea
                        name="description"
                        value={purchase.description}
                        onChange={handleChange}
                        placeholder="Add product or seller details..."
                        rows="3"
                      />
                    </div>

                    <button
                      type="submit"
                      className="primary-button full-button"
                      disabled={loading}
                    >
                      {loading ? "Analysing..." : "Analyse purchase →"}
                    </button>
                  </form>
                </div>

                <div className="right-column">
                  <div className="panel analysis-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>AI risk assessment</h2>
                        <p>Purchase safety insights</p>
                      </div>
                      <div className="ai-badge">✦ AI</div>
                    </div>

                    <RiskAssessment
                      analysis={analysis}
                      loading={loading}
                      error={error}
                    />

                    {analysis && checkoutButton}
                  </div>

                  <div className="info-banner">
                    <div className="info-icon">i</div>
                    <div>
                      <h3>Make informed decisions</h3>
                      <p>
                        Risk assessments are advisory and should not be treated as a guarantee that a merchant or transaction is safe.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel transactions-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent transactions</h2>
                    <p>Your latest payment activity will appear here.</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => changePage("Transactions")}
                  >
                    View all →
                  </button>
                </div>

                {transactions.length === 0 ? (
                  <div className="empty-transactions">
                    <div className="transaction-icon">↔</div>
                    <h3>No transactions yet</h3>
                    <p>Completed payments will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {transactions.slice(0, 3).map((transaction) => (
                      <div key={transaction.id} className="stat-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong>{transaction.product}</strong>
                          <strong>
                            {transaction.currency} {transaction.price}
                          </strong>
                        </div>

                        <p style={{ marginTop: "6px" }}>
                          {transaction.provider} · {transaction.status}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* NEW ANALYSIS */}
          {activePage === "New Analysis" && (
            <section className="standalone-page">
              <div className="eyebrow">PURCHASE REVIEW</div>
              <h1>
                Analyse a <span>purchase.</span>
              </h1>

              <p className="page-description">
                Enter the purchase and merchant details to prepare a security review.
              </p>

              <div className="panel standalone-form">
                <div className="panel-heading">
                  <div>
                    <h2>Purchase details</h2>
                    <p>All fields marked below are required.</p>
                  </div>
                  <span className="heading-icon">✦</span>
                </div>

                <form onSubmit={handleAnalysis}>
                  <div className="form-group">
                    <label>PRODUCT NAME</label>
                    <input
                      name="product"
                      value={purchase.product}
                      onChange={handleChange}
                      placeholder="Enter product name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>MERCHANT / WEBSITE</label>
                    <input
                      name="merchant"
                      value={purchase.merchant}
                      onChange={handleChange}
                      placeholder="Enter merchant or website"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>PRICE</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        name="price"
                        value={purchase.price}
                        onChange={handleChange}
                        placeholder="Enter amount"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>CURRENCY</label>
                      <select
                        name="currency"
                        value={purchase.currency}
                        onChange={handleChange}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="INR">INR (₹)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      ADDITIONAL DETAILS <span>OPTIONAL</span>
                    </label>
                    <textarea
                      name="description"
                      value={purchase.description}
                      onChange={handleChange}
                      placeholder="Describe the purchase..."
                      rows="4"
                    />
                  </div>

                  <button
                    type="submit"
                    className="primary-button full-button"
                    disabled={loading}
                  >
                    {loading ? "Analysing..." : "Analyse purchase →"}
                  </button>
                </form>

                <div className="standalone-result">
                  <RiskAssessment
                    analysis={analysis}
                    loading={loading}
                    error={error}
                  />

                  {analysis && checkoutButton}
                </div>
              </div>
            </section>
          )}

          {/* TRANSACTIONS */}
          {activePage === "Transactions" && (
            <section className="standalone-page">
              <div className="eyebrow">PAYMENT ACTIVITY</div>
              <h1>
                Transaction <span>history.</span>
              </h1>

              <p className="page-description">
                View your PayPal and Razorpay payment records.
              </p>

              <div className="panel transactions-panel standalone-transactions">
                <div className="panel-heading">
                  <div>
                    <h2>Saved transactions</h2>
                    <p>Records loaded from your MongoDB-backed API.</p>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={loadTransactions}
                    disabled={transactionsLoading}
                  >
                    {transactionsLoading ? "Refreshing..." : "Refresh ↻"}
                  </button>
                </div>

                {paymentLoading && (
                  <p role="status">{paymentMessage}</p>
                )}

                {paymentMessage && !paymentLoading && (
                  <p role="status">{paymentMessage}</p>
                )}

                {paymentError && (
                  <p role="alert" style={{ color: "#ff7777" }}>
                    {paymentError}
                  </p>
                )}

                {transactionsError && (
                  <p role="alert" style={{ color: "#ff7777" }}>
                    {transactionsError}
                  </p>
                )}

                {transactionsLoading && transactions.length === 0 ? (
                  <p role="status">Loading transaction history...</p>
                ) : transactions.length === 0 ? (
                  <div className="empty-transactions">
                    <div className="transaction-icon">↔</div>
                    <h3>No transactions yet</h3>
                    <p>
                      Completed payments will appear here after checkout.
                    </p>

                    <button
                      className="primary-button"
                      onClick={() => changePage("New Analysis")}
                    >
                      Start a purchase review →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "14px" }}>
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="stat-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <h3>{transaction.product}</h3>
                            <p>
                              {transaction.merchant || transaction.provider}
                            </p>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <strong>
                              {transaction.currency} {transaction.price}
                            </strong>
                            <p style={{ color: "#65d6a5" }}>
                              {transaction.status}
                            </p>
                          </div>
                        </div>

                        <p style={{ marginTop: "10px" }}>
                          Gateway: {transaction.provider}
                        </p>

                        <p style={{ overflowWrap: "anywhere" }}>
                          Order ID: {transaction.id}
                        </p>

                        <p>
                          {new Date(transaction.date).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SMART SPENDING ANALYTICS */}
          {activePage === "Analytics" && (
            <section className="standalone-page">
              <div className="eyebrow">FINANCIAL INSIGHTS</div>

              <h1>
                Spending <span>analytics.</span>
              </h1>

              <p className="page-description">
                Understand your completed payment activity, spending by currency, and merchant-wise totals.
              </p>

              {transactionsError && (
                <div className="panel" style={{ marginBottom: 20 }}>
                  <p role="alert" style={{ color: "#ff7777" }}>
                    {transactionsError}
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={loadTransactions}
                  >
                    Try again ↻
                  </button>
                </div>
              )}

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Completed payments</span>
                    <span className="stat-icon green">↗</span>
                  </div>
                  <h2>{spendingAnalytics.completedCount}</h2>
                  <p>Successful transactions</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Merchants</span>
                    <span className="stat-icon purple">▤</span>
                  </div>
                  <h2>{spendingAnalytics.merchants.length}</h2>
                  <p>Unique merchant and currency combinations</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Currencies used</span>
                    <span className="stat-icon blue">◎</span>
                  </div>
                  <h2>{spendingAnalytics.currencyTotals.length}</h2>
                  <p>Separate currency totals</p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Top merchant</span>
                    <span className="stat-icon purple">★</span>
                  </div>
                  <h2
                    style={{
                      fontSize: 19,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {spendingAnalytics.topMerchant?.merchant || "—"}
                  </h2>
                  <p>By recorded spending amount</p>
                </div>
              </div>

              <div
                className="content-grid"
                style={{ marginTop: 24, alignItems: "start" }}
              >
                {/* CURRENCY BREAKDOWN */}
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Spending by currency</h2>
                      <p>Totals are kept separate to avoid mixing currencies.</p>
                    </div>
                    <span className="heading-icon">◉</span>
                  </div>

                  {transactionsLoading ? (
                    <p>Loading spending data...</p>
                  ) : spendingAnalytics.currencyTotals.length === 0 ? (
                    <div className="empty-transactions">
                      <div className="transaction-icon">▥</div>
                      <h3>No spending data yet</h3>
                      <p>
                        Complete a test payment to see your spending breakdown here.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 20 }}>
                      {spendingAnalytics.currencyTotals.map((item) => (
                        <div key={item.currency}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              flexWrap: "wrap",
                              marginBottom: 8,
                            }}
                          >
                            <strong>{item.currency}</strong>
                            <strong>
                              {formatMoney(item.total, item.currency)}
                            </strong>
                          </div>

                          <div
                            style={{
                              height: 9,
                              background: "rgba(150,150,180,0.15)",
                              borderRadius: 20,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${
                                  (item.total /
                                    Math.max(
                                      ...spendingAnalytics.currencyTotals.map(
                                        (currency) => currency.total
                                      )
                                    )) *
                                  100
                                }%`,
                                background: "#7665ed",
                                borderRadius: 20,
                              }}
                            />
                          </div>

                          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 7 }}>
                            {item.count} payment(s) · Average{" "}
                            {formatMoney(item.average, item.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* MERCHANT BREAKDOWN */}
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Merchant breakdown</h2>
                      <p>Your recorded spending by merchant.</p>
                    </div>
                    <span className="heading-icon">▤</span>
                  </div>

                  {transactionsLoading ? (
                    <p>Loading merchant data...</p>
                  ) : spendingAnalytics.merchants.length === 0 ? (
                    <div className="empty-transactions">
                      <h3>No merchant data yet</h3>
                      <p>Merchant spending will appear after a completed payment.</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 14 }}>
                      {spendingAnalytics.merchants.slice(0, 8).map((item) => (
                        <div
                          key={`${item.currency}-${item.merchant}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            paddingBottom: 12,
                            borderBottom: "1px solid rgba(150,150,180,0.14)",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ overflowWrap: "anywhere" }}>
                              {item.merchant}
                            </strong>
                            <p style={{ fontSize: 12, opacity: 0.65, marginTop: 5 }}>
                              {item.count} payment(s) · {item.currency}
                            </p>
                          </div>

                          <strong style={{ whiteSpace: "nowrap" }}>
                            {formatMoney(item.total, item.currency)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RECENT PAYMENT ACTIVITY */}
              <div className="panel transactions-panel" style={{ marginTop: 24 }}>
                <div className="panel-heading">
                  <div>
                    <h2>Recent payment activity</h2>
                    <p>Latest completed transactions from your account.</p>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={loadTransactions}
                    disabled={transactionsLoading}
                  >
                    {transactionsLoading ? "Refreshing..." : "Refresh ↻"}
                  </button>
                </div>

                {transactionsLoading && transactions.length === 0 ? (
                  <p>Loading transactions...</p>
                ) : transactions.length === 0 ? (
                  <div className="empty-transactions">
                    <h3>No payment activity</h3>
                    <p>Your completed payments will appear here.</p>
                    <button
                      className="primary-button"
                      onClick={() => changePage("New Analysis")}
                    >
                      Review a purchase →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {transactions
                      .filter(
                        (transaction) =>
                          String(transaction.status).toUpperCase() === "COMPLETED"
                      )
                      .slice(0, 10)
                      .map((transaction) => (
                        <div
                          key={transaction.id}
                          className="stat-card"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <strong>{transaction.product}</strong>
                            <p style={{ marginTop: 5 }}>
                              {transaction.merchant || transaction.provider}
                            </p>
                            <p style={{ fontSize: 12, marginTop: 5 }}>
                              {new Date(transaction.date).toLocaleString()}
                            </p>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <strong>
                              {formatMoney(
                                Number(transaction.price) || 0,
                                transaction.currency
                              )}
                            </strong>
                            <p style={{ color: "#65d6a5", marginTop: 5 }}>
                              {transaction.status}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <p className="risk-disclaimer">
                Analytics are calculated from completed transactions returned by your account's transaction API. Totals are grouped by currency and are not converted into a common currency. They are informational and do not represent a bank balance.
              </p>
            </section>
          )}

          {/* SECURITY ALERT CENTER */}
          {activePage === "Security Alerts" && (
            <section className="standalone-page">
              <div className="eyebrow">ACCOUNT PROTECTION</div>
              <h1>
                Security <span>alerts.</span>
              </h1>
              <p className="page-description">
                Review suspicious purchase activity, risk levels, warning signs,
                and AI-generated safety recommendations.
              </p>
              <SecurityAlerts />
            </section>
          )}

          <footer className="footer">
            <span>© 2026 PayShield AI</span>
            <span>Built for safer digital payments</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
