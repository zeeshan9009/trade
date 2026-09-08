import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  BarData,
  CandlestickData,
  Coordinate,
  DataChangedScope,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  MouseEventParams,
  SeriesAttachedParameter,
  SeriesDataItemTypeMap,
  SeriesPrimitivePaneViewZOrder,
  SeriesType,
  Time,
} from "lightweight-charts";
import { PluginBase } from "../plugin-base.ts";
import {
  detectAllPatterns,
  detectCurrentTrend,
  type DetectedPattern,
  type TrendDirection,
} from "../../candle-patterns.ts";
import type { CandleData } from "../../indicators.ts";
import { PatternTooltipElement } from "./pattern-tooltip.ts";

interface PatternRenderItem {
  pattern: DetectedPattern;
  x: Coordinate | number;
  y: Coordinate | number;
  time: Time;
}

class PatternDetectorPaneRenderer implements ISeriesPrimitivePaneRenderer {
  private _items: PatternRenderItem[];
  private _isDark: boolean;

  constructor(items: PatternRenderItem[], isDark: boolean) {
    this._items = items;
    this._isDark = isDark;
  }

  draw(target: CanvasRenderingTarget2D) {
    if (this._items.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hpr = scope.horizontalPixelRatio;
      const vpr = scope.verticalPixelRatio;

      ctx.save();
      ctx.scale(hpr, vpr);

      for (const item of this._items) {
        const x = item.x;
        const y = item.y;
        if (x < -50 || x > scope.mediaSize.width + 50 || y < -50 || y > scope.mediaSize.height + 50) {
          continue;
        }

        const isAbove = item.pattern.position === "aboveBar";
        const color = item.pattern.color;
        const label = item.pattern.shortLabel;

        // Draw pill marker
        ctx.font = "bold 9px 'JetBrains Mono', -apple-system, sans-serif";
        const textWidth = ctx.measureText(label).width;
        const pillWidth = textWidth + 10;
        const pillHeight = 16;
        const pillX = x - pillWidth / 2;
        const pillY = isAbove ? y - pillHeight - 8 : y + 8;
        const radius = 4;

        // Draw background pill
        ctx.fillStyle = this._isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.95)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, radius);
        ctx.fill();
        ctx.stroke();

        // Draw arrow/pointer pointing to candle
        ctx.fillStyle = color;
        ctx.beginPath();
        if (isAbove) {
          ctx.moveTo(x, y - 2);
          ctx.lineTo(x - 4, y - 7);
          ctx.lineTo(x + 4, y - 7);
        } else {
          ctx.moveTo(x, y + 2);
          ctx.lineTo(x - 4, y + 7);
          ctx.lineTo(x + 4, y + 7);
        }
        ctx.closePath();
        ctx.fill();

        // Draw text label
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, pillY + pillHeight / 2);
      }

      ctx.restore();
    });
  }
}

class PatternDetectorPaneView implements ISeriesPrimitivePaneView {
  private _source: PatternDetectorPrimitive;
  private _items: PatternRenderItem[] = [];

  constructor(source: PatternDetectorPrimitive) {
    this._source = source;
  }

  update(): void {
    const series = this._source.series;
    const timeScale = this._source.chart.timeScale();
    const patterns = this._source.getPatterns();

    this._items = patterns
      .map((p) => {
        const x = timeScale.timeToCoordinate(p.time as Time);
        const y = series.priceToCoordinate(p.price);
        if (x === null || y === null) return null;
        return {
          pattern: p,
          x,
          y,
          time: p.time as Time,
        };
      })
      .filter((item): item is PatternRenderItem => item !== null);
  }

  renderer(): ISeriesPrimitivePaneRenderer {
    return new PatternDetectorPaneRenderer(this._items, this._source.isDark);
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return "top";
  }
}

export interface PatternDetectorOptions {
  smaPeriod?: number;
  isDark?: boolean;
}

export class PatternDetectorPrimitive extends PluginBase implements ISeriesPrimitive<Time> {
  private _options: Required<PatternDetectorOptions>;
  private _paneViews: PatternDetectorPaneView[];
  private _patterns: DetectedPattern[] = [];
  private _currentTrend: TrendDirection = "NEUTRAL";
  private _trendStrength = 0;
  private _trendSlope = 0;
  private _tooltipElement: PatternTooltipElement | undefined = undefined;
  private _hoveredPattern: DetectedPattern | null = null;

  constructor(options: PatternDetectorOptions = {}) {
    super();
    this._options = {
      smaPeriod: options.smaPeriod ?? 20,
      isDark: options.isDark ?? true,
    };
    this._paneViews = [new PatternDetectorPaneView(this)];
  }

  public get isDark(): boolean {
    return this._options.isDark;
  }

  public getPatterns(): DetectedPattern[] {
    return this._patterns;
  }

  public getCurrentTrend(): TrendDirection {
    return this._currentTrend;
  }

  public paneViews() {
    return this._paneViews;
  }

  public attached(param: SeriesAttachedParameter<Time>): void {
    super.attached(param);
    this._tooltipElement = new PatternTooltipElement(param.chart, this._options.isDark);
    param.chart.subscribeCrosshairMove(this._onCrosshairMove);
    this.dataUpdated("full");
  }

  public detached(): void {
    if (this._tooltipElement) {
      this._tooltipElement.destroy();
      this._tooltipElement = undefined;
    }
    try {
      this.chart.unsubscribeCrosshairMove(this._onCrosshairMove);
    } catch {
      /* safe ignore */
    }
    super.detached();
  }

  public dataUpdated(_scope: DataChangedScope): void {
    const rawData = this.series.data();
    if (!rawData || rawData.length === 0) return;

    const candles: CandleData[] = [];
    for (const d of rawData) {
      const bar = d as BarData;
      if (bar.open !== undefined && bar.high !== undefined && bar.low !== undefined && bar.close !== undefined) {
        candles.push({
          time: Number(bar.time),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        });
      }
    }

    if (candles.length === 0) return;

    const { patterns, currentTrend } = detectAllPatterns(candles, { smaPeriod: this._options.smaPeriod });
    const { strength, slope } = detectCurrentTrend(candles, this._options.smaPeriod);

    this._patterns = patterns;
    this._currentTrend = currentTrend;
    this._trendStrength = strength;
    this._trendSlope = slope;

    this._paneViews.forEach((pw) => pw.update());
    this._tooltipElement?.updateTrend(this._currentTrend, this._trendStrength, this._trendSlope);
    this.requestUpdate();
  }

  public setDark(isDark: boolean) {
    this._options.isDark = isDark;
    this._tooltipElement?.setDark(isDark);
    this.requestUpdate();
  }

  private _onCrosshairMove = (param: MouseEventParams) => {
    if (!this._tooltipElement) return;

    if (!param.point || !param.time) {
      this._tooltipElement.hidePatternTooltip();
      this._hoveredPattern = null;
      return;
    }

    const hoveredTime = Number(param.time);
    const pattern = this._patterns.find((p) => Math.abs(p.time - hoveredTime) <= 60);

    if (pattern) {
      this._hoveredPattern = pattern;
      const x = param.point.x;
      const y = this.series.priceToCoordinate(pattern.price) ?? param.point.y;
      this._tooltipElement.showPatternTooltip(pattern, x, y);
    } else {
      this._tooltipElement.hidePatternTooltip();
      this._hoveredPattern = null;
    }
  };
}
