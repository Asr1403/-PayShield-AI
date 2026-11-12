import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  Store,
  Package,
  ChevronDown,
  ChevronUp,
  Activity,
  Lightbulb,
} from "lucide-react";
import "./SecurityAlerts.css";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;
const FILTERS = ["All", "High", "Medium", "Low"];

function formatAmount(amount, currency = "USD") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Amount unavailable";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(date) {
  if (!date) return "Date unavailable";
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? "Date unavailable"
    : parsedDate.toLocaleString();
}

function getSeverity(severity) {
  const value = String(severity || "Low").toLowerCase();
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function SummaryCard({ title, count, icon: Icon, tone }) {
  return (
    <article className={`sa-summary-card sa-summary-${tone}`}>
      <div className="sa-summary-top">
        <span>{title}</span>
        <span className="sa-summary-icon"><Icon size={19} /></span>
      </div>
      <strong>{count ?? 0}</strong>
      <span className="sa-summary-caption">Based on your saved assessments</span>
    </article>
  );
}

function SecurityAlertCard({ alert }) {
  const [expanded, setExpanded] = useState(false);
  const severity = getSeverity(alert.severity);
  const warningSigns = Array.isArray(alert.warningSigns) ? alert.warningSigns : [];
  const recommendations = Array.isArray(alert.recommendations) ? alert.recommendations : [];
  const fraudSignals = Array.isArray(alert.fraudSignals) ? alert.fraudSignals : [];

  return (
    <article className={`sa-alert-card sa-alert-${severity}`}>
      <div className="sa-alert-main">
        <div className={`sa-alert-symbol sa-symbol-${severity}`}>
          {severity === "high" ? <ShieldAlert size={22} /> :
            severity === "medium" ? <AlertTriangle size={22} /> :
              <ShieldCheck size={22} />}
        </div>

        <div className="sa-alert-copy">
          <div className="sa-alert-title-row">
            <h3>{alert.title || "Purchase Risk Alert"}</h3>
            <span className={`sa-risk-badge sa-badge-${severity}`}>
              <span className="sa-badge-dot" />
              {alert.severity || "Low"} Risk
            </span>
          </div>
          <p className="sa-alert-summary">
            {alert.summary || "Review this transaction's risk assessment."}
          </p>
          <div className="sa-alert-meta">
            <span><Clock size={14} />{formatDate(alert.createdAt)}</span>
            {alert.merchant && <span><Store size={14} />{alert.merchant}</span>}
          </div>
        </div>

        <div className="sa-score">
          <strong>{Number(alert.riskScore) || 0}<small>/100</small></strong>
          <span>Risk score</span>
        </div>
      </div>

      <div className="sa-alert-facts">
        <div className="sa-fact">
          <span className="sa-fact-icon"><Package size={17} /></span>
          <div><span>Product</span><strong>{alert.product || "Purchase"}</strong></div>
        </div>
        <div className="sa-fact">
          <span className="sa-fact-icon sa-amount-icon">₹</span>
          <div><span>Transaction amount</span><strong>{formatAmount(alert.amount, alert.currency)}</strong></div>
        </div>
      </div>

      <button
        type="button"
        className="sa-expand-button"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
      >
        {expanded ? "Hide alert details" : "View alert details"}
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="sa-details">
          {fraudSignals.length > 0 && (
            <section className="sa-detail-section">
              <h4><Activity size={17} />Fraud Detection Signals</h4>
              <ul className="sa-signal-list">
                {fraudSignals.map((signal, index) => (
                  <li key={index}>
                    {typeof signal === "string" ? signal :
                      signal.description || signal.message || signal.name || "Risk signal detected"}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {warningSigns.length > 0 && (
            <section className="sa-detail-section">
              <h4><AlertTriangle size={17} />Warning Signs</h4>
              <ul className="sa-bullet-list sa-warning-list">
                {warningSigns.map((warning, index) => (
                  <li key={index}>{typeof warning === "string" ? warning : warning.message || warning.description || "Potential warning sign"}</li>
                ))}
              </ul>
            </section>
          )}

          {recommendations.length > 0 && (
            <section className="sa-detail-section">
              <h4><Lightbulb size={17} />Recommended Actions</h4>
              <ul className="sa-bullet-list sa-recommendation-list">
                {recommendations.map((recommendation, index) => (
                  <li key={index}>{typeof recommendation === "string" ? recommendation : recommendation.message || recommendation.description || "Review this transaction carefully"}</li>
                ))}
              </ul>
            </section>
          )}

          {fraudSignals.length === 0 && warningSigns.length === 0 && recommendations.length === 0 && (
            <p className="sa-no-details">No additional details are available for this alert.</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/alerts`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to retrieve security alerts.");
      }

      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setSummary({
        total: data.summary?.total ?? 0,
        high: data.summary?.high ?? 0,
        medium: data.summary?.medium ?? 0,
        low: data.summary?.low ?? 0,
      });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = activeFilter === "All"
    ? alerts
    : alerts.filter((alert) => getSeverity(alert.severity) === activeFilter.toLowerCase());

  if (loading) {
    return (
      <div className="sa-loading">
        <RefreshCw className="sa-spin" size={30} />
        <p>Loading security alerts...</p>
      </div>
    );
  }

  return (
    <div className="security-alerts">
      <div className="sa-heading">
        <div className="sa-heading-copy">
          <div className="sa-heading-icon"><Bell size={23} /></div>
          <div>
            <h2>Security Alert Center</h2>
            <p>Review potential risks identified by your AI purchase assessments.</p>
          </div>
        </div>
        <button
          type="button"
          className="sa-refresh-button"
          onClick={() => fetchAlerts(true)}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "sa-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="sa-error" role="alert">
          <strong>Unable to load alerts</strong>
          <p>{error}</p>
          <button type="button" onClick={() => fetchAlerts()}>Try again</button>
        </div>
      )}

      <div className="sa-summary-grid">
        <SummaryCard title="Total Alerts" count={summary.total} icon={Bell} tone="blue" />
        <SummaryCard title="High Risk" count={summary.high} icon={ShieldAlert} tone="red" />
        <SummaryCard title="Medium Risk" count={summary.medium} icon={AlertTriangle} tone="amber" />
        <SummaryCard title="Low Risk" count={summary.low} icon={ShieldCheck} tone="green" />
      </div>

      <section className="sa-alerts-panel">
        <div className="sa-panel-heading">
          <div>
            <h3>Recent Security Alerts</h3>
            <p>Filter alerts by their assessed risk level.</p>
          </div>
          <div className="sa-filters" aria-label="Filter alerts by risk">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={activeFilter === filter ? "active" : ""}
                onClick={() => setActiveFilter(filter)}
                aria-pressed={activeFilter === filter}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="sa-empty-state">
            <div className="sa-empty-icon"><ShieldCheck size={32} /></div>
            <h3>{alerts.length === 0 ? "No security alerts yet" : `No ${activeFilter.toLowerCase()} risk alerts`}</h3>
            <p>
              {alerts.length === 0
                ? "Your purchase analysis alerts will appear here when an assessment identifies a risk signal or an elevated risk score."
                : "Try selecting another risk filter to see your available alerts."}
            </p>
          </div>
        ) : (
          <div className="sa-alert-list">
            {filteredAlerts.map((alert) => (
              <SecurityAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </section>

      <div className="sa-security-note">
        <ShieldCheck size={19} />
        <p><strong>Security note:</strong> These alerts are AI-generated advisory assessments based on purchase analysis and available transaction history. They do not prove fraud, verify merchant identity, or automatically block payments. Always verify suspicious transactions independently.</p>
      </div>
    </div>
  );
}
