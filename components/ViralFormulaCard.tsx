type Formula = {
  title: string;
  competitor: string;
  format: string;
  sourceUrl: string;
  formula: string;
  timeline?: Array<{ time: string; title: string; script: string; role: string }>;
  vietnamized: string;
};

export function ViralFormulaCard({ formula, label }: { formula: Formula; label?: string }) {
  return (
    <article className="rounded border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      {label ? <p className="text-xs font-bold uppercase tracking-[0.12em] text-kolia-gold">{label}</p> : null}
      <a href={formula.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block font-semibold text-kolia-ink dark:text-slate-100 hover:text-kolia-green">
        {formula.title}
      </a>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formula.competitor} · {formula.format}</p>
      <div className="mt-4 rounded bg-kolia-mint p-3 text-sm font-bold leading-6 text-kolia-green">{formula.formula}</div>
      {formula.timeline && formula.timeline.length > 0 && (
        <div className="mt-4 space-y-3">
          {formula.timeline.map((step, i) => (
            <div key={i} className="rounded border border-kolia-line dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {step.time && <span className="rounded bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-kolia-gold">{step.time}</span>}
                <h4 className="text-sm font-bold text-kolia-ink dark:text-slate-100">{step.title}</h4>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{step.script}</p>
              {step.role && <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">Vai trò: {step.role}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 rounded bg-kolia-amber p-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{formula.vietnamized}</p>
    </article>
  );
}
