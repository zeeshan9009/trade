import type { IChartApi } from "lightweight-charts";
import type { DetectedPattern, TrendDirection } from "../../candle-patterns.ts";

export interface PatternTooltipOptions {
  isDark: boolean;
}

export class PatternTooltipElement {
  private _chart: IChartApi;
  private _element: HTMLDivElement;
  private _badgeElement: HTMLDivElement;
  private _titleElement: HTMLDivElement;
  private _tagElement: HTMLSpanElement;
  private _trendContextElement: HTMLDivElement;
  private _meaningElement: HTMLDivElement;
  private _reliabilityElement: HTMLDivElement;

  private _trendBadge: HTMLDivElement;
  private _isDark: boolean;

  constructor(chart: IChartApi, isDark = true) {
    this._chart = chart;
    this._isDark = isDark;

    // ── Pattern Explanation Popup Tooltip ──
    const element = document.createElement("div");
    element.className = "opencharts-pattern-tooltip";
    applyStyles(element, {
      position: "absolute",
      display: "flex",
      "flex-direction": "column",
      gap: "6px",
      padding: "10px 14px",
      "border-radius": "8px",
      "font-family": "'JetBrains Mono', 'SF Mono', -apple-system, BlinkMacSystemFont, sans-serif",
      "font-size": "11px",
      "line-height": "1.4",
      "max-width": "280px",
      "z-index": "80",
      "pointer-events": "none",
      opacity: "0",
      transition: "opacity 0.15s ease, transform 0.15s ease",
      transform: "translate(-50%, -100%)",
      "box-shadow": "0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      "backdrop-filter": "blur(8px)",
      "-webkit-backdrop-filter": "blur(8px)",
      "background-color": this._isDark ? "rgba(18, 22, 34, 0.95)" : "rgba(255, 255, 255, 0.98)",
      color: this._isDark ? "#f1f5f9" : "#0f172a",
    });

    const header = document.createElement("div");
    applyStyles(header, {
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "8px",
      "border-bottom": this._isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
      "padding-bottom": "6px",
    });

    const titleElement = document.createElement("div");
    applyStyles(titleElement, {
      "font-weight": "700",
      "font-size": "12px",
      "letter-spacing": "-0.01em",
    });
    header.appendChild(titleElement);

    const tagElement = document.createElement("span");
    applyStyles(tagElement, {
      "font-size": "9px",
      "font-weight": "700",
      "text-transform": "uppercase",
      padding: "2px 6px",
      "border-radius": "4px",
      "letter-spacing": "0.05em",
    });
    header.appendChild(tagElement);
    element.appendChild(header);

    const trendContextElement = document.createElement("div");
    applyStyles(trendContextElement, {
      "font-size": "10px",
      "font-weight": "600",
      color: this._isDark ? "#94a3b8" : "#64748b",
      display: "flex",
      "align-items": "center",
      gap: "4px",
    });
    element.appendChild(trendContextElement);

    const meaningElement = document.createElement("div");
    applyStyles(meaningElement, {
      "font-size": "11px",
      color: this._isDark ? "#e2e8f0" : "#334155",
    });
    element.appendChild(meaningElement);

    const reliabilityElement = document.createElement("div");
    applyStyles(reliabilityElement, {
      "font-size": "10px",
      padding: "4px 8px",
      "border-radius": "4px",
      "background-color": this._isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
      color: this._isDark ? "#cbd5e1" : "#475569",
      "border-left": "2px solid #3b82f6",
    });
    element.appendChild(reliabilityElement);

    this._element = element;
    this._titleElement = titleElement;
    this._tagElement = tagElement;
    this._trendContextElement = trendContextElement;
    this._meaningElement = meaningElement;
    this._reliabilityElement = reliabilityElement;
    this._badgeElement = header;

    // ── Persistent On-Chart Real-Time Trend Badge ──
    const trendBadge = document.createElement("div");
    trendBadge.className = "opencharts-trend-badge";
    applyStyles(trendBadge, {
      position: "absolute",
      top: "10px",
      right: "95px",
      display: "flex",
      "align-items": "center",
      gap: "6px",
      padding: "4px 10px",
      "border-radius": "6px",
      "font-family": "'JetBrains Mono', 'SF Mono', monospace",
      "font-size": "11px",
      "font-weight": "700",
      "z-index": "30",
      "pointer-events": "none",
      "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.12)",
      "backdrop-filter": "blur(6px)",
      "-webkit-backdrop-filter": "blur(6px)",
      "background-color": this._isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.9)",
      color: "#0ecb81",
    });
    this._trendBadge = trendBadge;

    const chartEl = this._chart.chartElement();
    chartEl.appendChild(this._element);
    chartEl.appendChild(this._trendBadge);
  }

  public updateTrend(trend: TrendDirection, strength?: number, slope?: number) {
    if (!this._trendBadge) return;
    const isUp = trend === "UP";
    const isDown = trend === "DOWN";

    const color = isUp ? "#0ecb81" : isDown ? "#f6465d" : "#f0b90b";
    const bgColor = isUp
      ? "rgba(14, 203, 129, 0.15)"
      : isDown
        ? "rgba(246, 70, 93, 0.15)"
        : "rgba(240, 185, 11, 0.15)";
    const borderColor = isUp
      ? "rgba(14, 203, 129, 0.4)"
      : isDown
        ? "rgba(246, 70, 93, 0.4)"
        : "rgba(240, 185, 11, 0.4)";
    const arrow = isUp ? "▲" : isDown ? "▼" : "■";

    this._trendBadge.style.color = color;
    this._trendBadge.style.backgroundColor = this._isDark
      ? "rgba(15, 23, 42, 0.85)"
      : "rgba(255, 255, 255, 0.95)";
    this._trendBadge.style.borderColor = borderColor;

    const slopeText = slope !== undefined ? ` (${slope >= 0 ? "+" : ""}${slope.toFixed(2)}%)` : "";
    this._trendBadge.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:${bgColor};color:${color};font-size:9px;">${arrow}</span>
      <span>Trend: <strong style="color:${color};">${trend}</strong>${slopeText}</span>
    `;
  }

  public showPatternTooltip(pattern: DetectedPattern, x: number, y: number) {
    if (!this._element) return;

    this._titleElement.innerText = pattern.name;

    const isBull = pattern.sentiment === "bullish";
    const isBear = pattern.sentiment === "bearish";
    const tagBg = isBull ? "rgba(14, 203, 129, 0.2)" : isBear ? "rgba(246, 70, 93, 0.2)" : "rgba(240, 185, 11, 0.2)";
    const tagColor = isBull ? "#0ecb81" : isBear ? "#f6465d" : "#f0b90b";

    this._tagElement.innerText = pattern.sentiment;
    this._tagElement.style.backgroundColor = tagBg;
    this._tagElement.style.color = tagColor;

    this._trendContextElement.innerHTML = `📍 <span>${pattern.trendContext}</span>`;
    this._meaningElement.innerText = pattern.meaning;
    this._reliabilityElement.innerHTML = `<strong>Reliability:</strong> ${pattern.reliability}`;
    this._reliabilityElement.style.borderLeftColor = pattern.color;

    // Adjust position so it doesn't overflow chart edges
    const chartWidth = this._chart.timeScale().width();
    const deadzone = 140;
    const clampedX = Math.min(Math.max(deadzone, x), Math.max(deadzone, chartWidth - deadzone));
    const clampedY = Math.max(60, y - 16);

    this._element.style.left = `${clampedX}px`;
    this._element.style.top = `${clampedY}px`;
    this._element.style.opacity = "1";
    this._element.style.transform = "translate(-50%, -100%) scale(1)";
  }

  public hidePatternTooltip() {
    if (!this._element) return;
    this._element.style.opacity = "0";
    this._element.style.transform = "translate(-50%, -95%) scale(0.97)";
  }

  public setDark(isDark: boolean) {
    this._isDark = isDark;
    if (this._element) {
      this._element.style.backgroundColor = isDark ? "rgba(18, 22, 34, 0.95)" : "rgba(255, 255, 255, 0.98)";
      this._element.style.color = isDark ? "#f1f5f9" : "#0f172a";
    }
  }

  public destroy() {
    if (this._element && this._element.parentElement) {
      this._element.parentElement.removeChild(this._element);
    }
    if (this._trendBadge && this._trendBadge.parentElement) {
      this._trendBadge.parentElement.removeChild(this._trendBadge);
    }
  }
}

function applyStyles(element: HTMLElement, styles: Record<string, string>) {
  for (const [key, value] of Object.entries(styles)) {
    element.style.setProperty(key, value);
  }
}
