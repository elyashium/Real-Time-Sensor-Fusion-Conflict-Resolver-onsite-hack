"use client";

import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics/posthog";
import { Settings, X, Check } from "lucide-react";

interface Rule {
  id: string;
  version: number;
  active: boolean;
  rules_json: any[];
  created_at: string;
}

export default function RuleEditor() {
  const [open, setOpen] = useState(false);
  const [activeRule, setActiveRule] = useState<Rule | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchRules = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/rules");
      const json = await res.json();
      setActiveRule(json.active);
      setEditorValue(JSON.stringify(json.active?.rules_json ?? [], null, 2));
    } catch {
      // ignore
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (open) fetchRules();
  }, [open]);

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
        setStatus({ ok: true, msg: `Rules updated to v${json.version}` });
        trackEvent("rules_updated", { version: json.version });
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
    <>
      <button
        id="open-rule-editor"
        onClick={() => setOpen(true)}
        className="py-1.5 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-zinc-300 font-semibold transition-all flex items-center justify-center gap-2"
      >
        <Settings size={14} /> Edit Rules
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="bg-[#111118] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div>
                <h3 className="font-serif text-xl text-white">Conflict Resolution Rules</h3>
                {activeRule && (
                  <p className="text-xs font-medium text-zinc-500 mt-0.5">Active: version {activeRule.version}</p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-xs text-zinc-500 mb-3">
                Modify the ordered rule set below. Changes are versioned — the prior version is preserved for audit purposes.
                Rules are evaluated top-to-bottom; the first match wins.
              </p>

              {fetching ? (
                <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
              ) : (
                <textarea
                  id="rule-editor-textarea"
                  value={editorValue}
                  onChange={(e) => setEditorValue(e.target.value)}
                  rows={16}
                  spellCheck={false}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500/50 resize-none leading-relaxed"
                />
              )}

              {status && (
                <p className={`mt-3 text-sm font-semibold flex items-center gap-2 ${status.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {status.ok ? <Check size={16} /> : <X size={16} />} {status.msg}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-white font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                id="apply-rules-btn"
                onClick={applyRules}
                disabled={loading || fetching}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all duration-150"
              >
                {loading ? "Applying…" : "Apply Rules"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
