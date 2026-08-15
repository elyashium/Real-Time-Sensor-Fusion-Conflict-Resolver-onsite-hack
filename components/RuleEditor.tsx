"use client";

import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics/posthog";
import { Settings, X, Check, Save } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboard";

interface Rule {
  id: string;
  version: number;
  active: boolean;
  rules_json: any[];
  created_at: string;
}

export default function RuleEditor() {
  const { setView } = useDashboardStore();
  
  const [activeRule, setActiveRule] = useState<Rule | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const fetchRules = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/rules");
      const json = await res.json();
      setActiveRule(json.active);
      setEditorValue(JSON.stringify(json.active?.rules_json ?? [], null, 2));
      setHasUnsavedChanges(false);
    } catch {
      setStatus({ ok: false, msg: "Failed to fetch rules" });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorValue(e.target.value);
    setHasUnsavedChanges(true);
  };

  const applyRules = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const rules_json = JSON.parse(editorValue);
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules_json }),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus({ ok: true, msg: `Rules successfully updated to v${json.version}` });
        trackEvent("rules_updated", { version: json.version });
        setHasUnsavedChanges(false);
        fetchRules();
      } else {
        setStatus({ ok: false, msg: json.error ?? "Unknown error" });
      }
    } catch (e: any) {
      setStatus({ ok: false, msg: `JSON parse error: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-6 border-b border-border">
        <div>
          <h2 className="text-2xl font-serif text-foreground tracking-tight">Rule Editor</h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            {activeRule ? `Active Version: ${activeRule.version}` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("dashboard")}
            className="px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-semibold transition-colors flex items-center gap-2 border border-border/50 shadow-sm"
          >
            <X size={16} /> Close
          </button>
          <button
            onClick={applyRules}
            disabled={loading || fetching || !hasUnsavedChanges}
            className="px-4 py-2 rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-bold transition-all shadow-sm flex items-center gap-2"
          >
            {loading ? <Settings size={16} className="animate-spin" /> : <Save size={16} />}
            {loading ? "Applying…" : "Save Rules"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-6 min-h-0 bg-secondary/20">
        <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col min-h-0">
          <p className="text-sm font-medium text-muted-foreground mb-4">
            Modify the ordered JSON rule set below. Changes are versioned automatically. 
            The engine evaluates rules sequentially (top-to-bottom); the first matching rule dictates the source of truth.
          </p>

          {fetching ? (
            <div className="flex-1 rounded-md bg-muted animate-pulse border border-border" />
          ) : (
            <textarea
              value={editorValue}
              onChange={handleEditorChange}
              spellCheck={false}
              className="flex-1 w-full bg-card border border-border rounded-md p-4 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring resize-none shadow-sm"
            />
          )}

          {status && (
            <div className={`mt-4 p-3 rounded-md text-sm font-semibold flex items-center gap-2 border shadow-sm ${
              status.ok 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {status.ok ? <Check size={16} /> : <X size={16} />} {status.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
