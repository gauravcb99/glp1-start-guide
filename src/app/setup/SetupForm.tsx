"use client";

// Member inputs, saved only to this browser's localStorage (never WHOOP data, never the server).
import { useEffect, useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { Notice } from "@/components/Notice";
import { useDemoPersona } from "@/components/useMemberData";
import { strings } from "@/copy/strings";
import { weekdayOf } from "@/lib/analysis/dates";
import type { Drug, InjectionTime, MemberInputs, Weekday } from "@/lib/analysis/types";
import { clearInputs, loadInputs, saveInputs, validateInputs } from "@/lib/memberInputs";

const t = strings.setup;

const EMPTY: MemberInputs = {
  drug: "semaglutide",
  firstDoseDate: "",
  injectionWeekdays: [],
  missedInjectionDates: [],
  movedInjections: [],
  injectionTime: "morning",
  doseSteps: [],
};

// Same height for selects and date inputs; color-scheme (globals.css) styles the native pickers.
const field = "h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground placeholder:text-muted";
const label = "text-sm font-medium";
const small = "text-sm text-muted underline hover:text-foreground";

export function SetupForm() {
  const persona = useDemoPersona();
  const [form, setForm] = useState<MemberInputs | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // The first "From" date follows the first-dose date until it is changed by hand.
  const [fromEdited, setFromEdited] = useState(false);

  useEffect(() => {
    // localStorage is read after mount (CLAUDE.md); deferred for react-hooks/set-state-in-effect.
    const saved = loadInputs();
    queueMicrotask(() => {
      setForm(saved ?? EMPTY);
      setFromEdited(!!saved && saved.injectionWeekdays[0]?.from !== saved.firstDoseDate);
    });
  }, []);

  if (persona) return <Notice title={t.demoMode.title} body={t.demoMode.body} />;
  if (!form) return <p className="text-sm text-muted">{strings.notices.loading}</p>;

  const update = (patch: Partial<MemberInputs>) => {
    setForm({ ...form, ...patch });
    setMessage(null);
  };

  // The first schedule entry takes the first dose's weekday, and its "From" date unless edited.
  const setFirstDose = (date: string) => {
    const [first, ...rest] = form.injectionWeekdays;
    const weekday = /^\d{4}-\d{2}-\d{2}$/.test(date) ? weekdayOf(date) : (first?.weekday ?? 0);
    const from = fromEdited && first ? first.from : date;
    update({ firstDoseDate: date, injectionWeekdays: date || first ? [{ from, weekday }, ...rest] : rest });
  };

  const setFirstFrom = (from: string) => {
    setFromEdited(true);
    update({ injectionWeekdays: form.injectionWeekdays.map((w, j) => (j === 0 ? { ...w, from } : w)) });
  };

  const addDoseStep = () =>
    update({ doseSteps: [...form.doseSteps, { date: form.doseSteps.length === 0 ? form.firstDoseDate : "", mg: 0 }] });

  const save = () => {
    if (form.firstDoseDate && form.doseSteps.length === 0) {
      setForm({ ...form, doseSteps: [{ date: form.firstDoseDate, mg: 0 }] });
      return setMessage(t.errors.startingDose);
    }
    const error = validateInputs(form);
    if (error) return setMessage(t.errors[error]);
    setMessage(saveInputs(form) ? t.saved : t.storageUnavailable);
  };

  const clear = () => {
    setForm(EMPTY);
    setMessage(clearInputs() ? t.cleared : t.storageUnavailable);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Outside the setup form: ConnectionStatus holds the logout <form>, and forms can't nest. */}
      <ConnectionStatus />
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={label}>{t.drug}</span>
            <select className={field} value={form.drug} onChange={(e) => update({ drug: e.target.value as Drug })}>
              {(Object.keys(strings.drugs) as Drug[]).map((d) => (
                <option key={d} value={d}>
                  {strings.drugs[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>{t.firstDose}</span>
            <input type="date" className={field} value={form.firstDoseDate} onChange={(e) => setFirstDose(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>{t.injectionTime}</span>
            <select
              className={field}
              value={form.injectionTime}
              onChange={(e) => update({ injectionTime: e.target.value as InjectionTime })}
            >
              {(Object.keys(strings.injectionTimes) as InjectionTime[]).map((time) => (
                <option key={time} value={time}>
                  {strings.injectionTimes[time]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ListSection
          title={t.weekdaySchedule}
          addLabel={t.addWeekdayChange}
          onAdd={() => update({ injectionWeekdays: [...form.injectionWeekdays, { from: "", weekday: 0 }] })}
        >
          {form.injectionWeekdays.map((entry, i) => (
            <Row key={i} onRemove={i === 0 ? undefined : () => update({ injectionWeekdays: form.injectionWeekdays.filter((_, j) => j !== i) })}>
              <label className="flex items-center gap-2 text-sm">
                {t.weekdayFrom}
                <input
                  type="date"
                  className={field}
                  value={entry.from}
                  onChange={(e) =>
                    i === 0
                      ? setFirstFrom(e.target.value)
                      : update({ injectionWeekdays: form.injectionWeekdays.map((w, j) => (j === i ? { ...w, from: e.target.value } : w)) })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                {t.weekdayDay}
                <select
                  className={field}
                  value={entry.weekday}
                  disabled={i === 0}
                  onChange={(e) =>
                    update({
                      injectionWeekdays: form.injectionWeekdays.map((w, j) =>
                        j === i ? { ...w, weekday: Number(e.target.value) as Weekday } : w,
                      ),
                    })
                  }
                >
                  {strings.weekdays.map((name, d) => (
                    <option key={name} value={d}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </Row>
          ))}
        </ListSection>

        <ListSection
          title={t.missed}
          addLabel={t.addMissed}
          onAdd={() => update({ missedInjectionDates: [...form.missedInjectionDates, ""] })}
        >
          {form.missedInjectionDates.map((date, i) => (
            <Row key={i} onRemove={() => update({ missedInjectionDates: form.missedInjectionDates.filter((_, j) => j !== i) })}>
              <input
                type="date"
                className={field}
                value={date}
                onChange={(e) => update({ missedInjectionDates: form.missedInjectionDates.map((d, j) => (j === i ? e.target.value : d)) })}
              />
            </Row>
          ))}
        </ListSection>

        <ListSection
          title={t.moved}
          addLabel={t.addMoved}
          onAdd={() => update({ movedInjections: [...form.movedInjections, { scheduled: "", actual: "" }] })}
        >
          {form.movedInjections.map((m, i) => (
            <Row key={i} onRemove={() => update({ movedInjections: form.movedInjections.filter((_, j) => j !== i) })}>
              {(["scheduled", "actual"] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  {key === "scheduled" ? t.movedScheduled : t.movedActual}
                  <input
                    type="date"
                    className={field}
                    value={m[key]}
                    onChange={(e) =>
                      update({ movedInjections: form.movedInjections.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)) })
                    }
                  />
                </label>
              ))}
            </Row>
          ))}
        </ListSection>

        <ListSection
          title={t.doseSteps}
          addLabel={t.addDoseStep}
          onAdd={addDoseStep}
        >
          {form.doseSteps.map((step, i) => (
            <Row key={i} onRemove={() => update({ doseSteps: form.doseSteps.filter((_, j) => j !== i) })}>
              <label className="flex items-center gap-2 text-sm">
                {t.doseDate}
                <input
                  type="date"
                  className={field}
                  value={step.date}
                  onChange={(e) => update({ doseSteps: form.doseSteps.map((s, j) => (j === i ? { ...s, date: e.target.value } : s)) })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={`${field} w-24`}
                  value={step.mg || ""}
                  onChange={(e) => update({ doseSteps: form.doseSteps.map((s, j) => (j === i ? { ...s, mg: Number(e.target.value) } : s)) })}
                />
                {t.doseMg}
              </label>
            </Row>
          ))}
        </ListSection>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="rounded-full bg-foreground px-5 py-2 font-medium text-background hover:opacity-90">
            {t.save}
          </button>
          <button type="button" onClick={clear} className={small}>
            {t.clear}
          </button>
          {message && (
            <p role="status" className="text-sm text-secondary">
              {message}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function ListSection({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${label} mb-1`}>{title}</legend>
      {children}
      <button type="button" onClick={onAdd} className={`${small} w-fit`}>
        {addLabel}
      </button>
    </fieldset>
  );
}

function Row({ onRemove, children }: { onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className={small}>
          {t.remove}
        </button>
      )}
    </div>
  );
}
