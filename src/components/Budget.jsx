// src/components/Budget.jsx
import React, { useState, useEffect } from "react";

/**
 * Budget Component - QuickBooks Integration Scaffold
 * 
 * Features:
 * - Connect QuickBooks button that initiates OAuth flow
 * - Display QuickBooks accounts (Chart of Accounts)
 * - Form to create budget objects (TODO: implement POST to /api/budgets)
 * 
 * NOTE: QuickBooks OAuth requires serverless functions (Vercel/Netlify)
 * For static hosting, this component shows the UI scaffold
 */
export default function Budget() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    name: "",
    account: "",
    amount: "",
    period: "monthly",
  });

  // Check if QuickBooks is connected by trying to fetch accounts
  const checkConnection = async () => {
    try {
      const response = await fetch("/api/quickbooks/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
        setConnected(true);
        setError(null);
      } else {
        const errorData = await response.json();
        setConnected(false);
        // Don't set error for 401 (not connected) - this is expected
        if (response.status !== 401) {
          setError(errorData.message || "Failed to fetch accounts");
        }
      }
    } catch (err) {
      console.error("Connection check error:", err);
      // In static hosting, API endpoints won't work - this is expected
      setConnected(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnectQuickBooks = () => {
    // Redirect to QuickBooks OAuth connect endpoint
    // NOTE: This requires serverless function deployment
    window.location.href = "/api/quickbooks/connect";
  };

  const handleRefreshAccounts = async () => {
    setLoading(true);
    setError(null);
    await checkConnection();
    setLoading(false);
  };

  const handleBudgetFormChange = (field, value) => {
    setBudgetForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateBudget = async (e) => {
    e.preventDefault();

    // Validate form
    if (!budgetForm.name || !budgetForm.account || !budgetForm.amount) {
      alert("Please fill in all required fields");
      return;
    }

    // TODO: Implement POST to /api/budgets
    // For now, just show what would be submitted
    console.log("Budget to create:", budgetForm);
    alert(`Budget creation not yet implemented.\n\nWould create:\n${JSON.stringify(budgetForm, null, 2)}`);

    // Reset form
    setBudgetForm({
      name: "",
      account: "",
      amount: "",
      period: "monthly",
    });
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h2 style={{ marginTop: 0, marginBottom: 24 }}>Budget Manager</h2>

      {/* QuickBooks Connection Section */}
      <div
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>QuickBooks Integration</h3>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {connected && (
              <button
                onClick={handleRefreshAccounts}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  background: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                🔄 {loading ? "Refreshing..." : "Refresh Accounts"}
              </button>
            )}
            {!connected && (
              <button
                onClick={handleConnectQuickBooks}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #10B981",
                  background: "#10B981",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                🔗 Connect QuickBooks
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {!connected && !error && (
          <div
            style={{
              background: "#FEF3C7",
              border: "1px solid #FDE68A",
              color: "#92400E",
              padding: 12,
              borderRadius: 8,
            }}
          >
            <strong>QuickBooks Not Connected</strong>
            <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
              Click "Connect QuickBooks" to authorize this application to access your QuickBooks data.
              <br />
              <strong>Note:</strong> QuickBooks OAuth requires serverless function deployment (Vercel/Netlify).
              For static hosting, you'll need to set up a backend service.
            </p>
          </div>
        )}

        {connected && (
          <div
            style={{
              background: "#DCFCE7",
              border: "1px solid #BBF7D0",
              color: "#166534",
              padding: 12,
              borderRadius: 8,
            }}
          >
            ✅ QuickBooks Connected - {accounts.length} accounts available
          </div>
        )}
      </div>

      {/* Accounts List */}
      {connected && accounts.length > 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>
            Chart of Accounts
          </h3>
          <div style={{ overflow: "auto", maxHeight: 400 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderBottom: "1px solid #E5E7EB",
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    Account Name
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderBottom: "1px solid #E5E7EB",
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: 12,
                      borderBottom: "1px solid #E5E7EB",
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account, i) => (
                  <tr
                    key={account.Id || i}
                    style={{ background: i % 2 ? "#FAFAFA" : "white" }}
                  >
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6" }}>
                      {account.Name}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #F3F4F6" }}>
                      {account.AccountType}
                    </td>
                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #F3F4F6",
                        textAlign: "right",
                      }}
                    >
                      ${parseFloat(account.CurrentBalance || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget Creation Form */}
      <div
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>
          Create Budget
        </h3>
        <form onSubmit={handleCreateBudget}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label
                htmlFor="budget-name"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Budget Name *
              </label>
              <input
                id="budget-name"
                type="text"
                value={budgetForm.name}
                onChange={(e) => handleBudgetFormChange("name", e.target.value)}
                placeholder="e.g., Monthly Fuel Budget"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label
                htmlFor="budget-account"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Account *
              </label>
              <select
                id="budget-account"
                value={budgetForm.account}
                onChange={(e) => handleBudgetFormChange("account", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <option value="">Select an account...</option>
                {accounts.map((account) => (
                  <option key={account.Id} value={account.Id}>
                    {account.Name} ({account.AccountType})
                  </option>
                ))}
                {accounts.length === 0 && (
                  <option value="placeholder">Connect QuickBooks to see accounts</option>
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="budget-amount"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Budget Amount *
              </label>
              <input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                value={budgetForm.amount}
                onChange={(e) => handleBudgetFormChange("amount", e.target.value)}
                placeholder="0.00"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label
                htmlFor="budget-period"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Period
              </label>
              <select
                id="budget-period"
                value={budgetForm.period}
                onChange={(e) => handleBudgetFormChange("period", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>

            <div
              style={{
                background: "#F9FAFB",
                border: "1px dashed #E5E7EB",
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: "#6B7280",
              }}
            >
              <strong>TODO:</strong> Implement POST to /api/budgets endpoint to save budget
              object. This form currently shows a preview of what would be submitted.
            </div>

            <button
              type="submit"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              Create Budget (Preview)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
