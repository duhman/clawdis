/**
 * Canvas Component Registry
 *
 * React implementations for all catalog components.
 */

import React, { useState, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";

import type { UIElement, Action } from "./types";
import { useDataValue, useDataBinding, useIsVisible } from "./context";
import { formatValue, formatCellValue } from "./data";

// ============================================================================
// TYPES
// ============================================================================

export interface ComponentRenderProps<P = unknown> {
  element: UIElement<string, P>;
  children?: ReactNode;
  onAction?: (action: Action) => void;
  loading?: boolean;
}

export type ComponentRenderer<P = unknown> = React.ComponentType<
  ComponentRenderProps<P>
>;

export type ComponentRegistry = Record<string, ComponentRenderer>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

function Card({ element, children }: ComponentRenderProps) {
  const { title, description, variant } = element.props as {
    title: string;
    description?: string;
    variant?: "default" | "outlined" | "elevated";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "canvas-card",
        variant === "elevated" && "canvas-card--elevated",
        variant === "outlined" && "canvas-card--outlined",
      )}
    >
      {title && <h3 className="canvas-card__title">{title}</h3>}
      {description && <p className="canvas-card__description">{description}</p>}
      <div className="canvas-card__content">{children}</div>
    </motion.div>
  );
}

function Grid({ element, children }: ComponentRenderProps) {
  const { columns = 2, gap = "md" } = element.props as {
    columns?: number;
    gap?: "sm" | "md" | "lg";
  };

  return (
    <div
      className={cn("canvas-grid", `canvas-grid--gap-${gap}`)}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {children}
    </div>
  );
}

function Stack({ element, children }: ComponentRenderProps) {
  const {
    direction = "vertical",
    gap = "md",
    align,
  } = element.props as {
    direction?: "vertical" | "horizontal";
    gap?: "sm" | "md" | "lg";
    align?: "start" | "center" | "end" | "stretch";
  };

  return (
    <div
      className={cn(
        "canvas-stack",
        `canvas-stack--${direction}`,
        `canvas-stack--gap-${gap}`,
        align && `canvas-stack--align-${align}`,
      )}
    >
      {children}
    </div>
  );
}

function Tabs({ element, children }: ComponentRenderProps) {
  const { tabs, defaultTab } = element.props as {
    tabs: { id: string; label: string }[];
    defaultTab?: string;
  };
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <div className="canvas-tabs">
      <div className="canvas-tabs__list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "canvas-tabs__tab",
              activeTab === tab.id && "canvas-tabs__tab--active",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="canvas-tabs__content">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return null;
          const childProps = child.props as { element?: UIElement };
          if (childProps.element?.props?.tabId === activeTab) {
            return child;
          }
          return null;
        })}
      </div>
    </div>
  );
}

function TabPanel({ children }: ComponentRenderProps) {
  return <div className="canvas-tab-panel">{children}</div>;
}

// ============================================================================
// DATA DISPLAY COMPONENTS
// ============================================================================

function Metric({ element }: ComponentRenderProps) {
  const {
    label,
    valuePath,
    format = "number",
    prefix,
    suffix,
    trend,
  } = element.props as {
    label: string;
    valuePath: string;
    format?: "currency" | "percent" | "number" | "compact";
    prefix?: string;
    suffix?: string;
    trend?: { valuePath: string; goodDirection: "up" | "down" };
  };

  const value = useDataValue(valuePath);
  const trendValue = trend ? useDataValue(trend.valuePath) : null;

  const formattedValue = formatValue(value, format, { prefix, suffix });
  const trendNum = Number(trendValue);
  const trendDirection =
    trendNum > 0 ? "up" : trendNum < 0 ? "down" : "neutral";
  const isGoodTrend = trend?.goodDirection === trendDirection;

  return (
    <div className="canvas-metric">
      <p className="canvas-metric__label">{label}</p>
      <div className="canvas-metric__value-row">
        <span className="canvas-metric__value">{formattedValue}</span>
        {trendValue !== null && (
          <span
            className={cn(
              "canvas-metric__trend",
              isGoodTrend
                ? "canvas-metric__trend--good"
                : "canvas-metric__trend--bad",
            )}
          >
            {trendDirection === "up"
              ? "↑"
              : trendDirection === "down"
                ? "↓"
                : "→"}
            {Math.abs(trendNum)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Chart({ element }: ComponentRenderProps) {
  const {
    type,
    dataPath,
    xKey,
    yKey,
    height = 300,
    color,
    showGrid = true,
    title,
  } = element.props as {
    type: "line" | "bar" | "area" | "pie" | "donut";
    dataPath: string;
    xKey: string;
    yKey: string;
    height?: number;
    color?: string;
    showGrid?: boolean;
    showLegend?: boolean;
    title?: string;
  };

  const data = (useDataValue(dataPath) as unknown[]) ?? [];
  const chartColor = color ?? CHART_COLORS[0];

  if (type === "pie" || type === "donut") {
    return (
      <div className="canvas-chart">
        {title && <h4 className="canvas-chart__title">{title}</h4>}
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              innerRadius={type === "donut" ? "60%" : 0}
              outerRadius="80%"
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const renderChartContent = () => {
    const commonProps = {
      type: "monotone" as const,
      dataKey: yKey,
      stroke: chartColor,
      fill: chartColor,
    };

    switch (type) {
      case "bar":
        return (
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar {...commonProps} />
          </BarChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area {...commonProps} fillOpacity={0.3} />
          </AreaChart>
        );
      default:
        return (
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line {...commonProps} />
          </LineChart>
        );
    }
  };

  return (
    <div className="canvas-chart">
      {title && <h4 className="canvas-chart__title">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        {renderChartContent()}
      </ResponsiveContainer>
    </div>
  );
}

function Table({ element }: ComponentRenderProps) {
  const {
    dataPath,
    columns,
    pageSize = 10,
    showPagination = true,
  } = element.props as {
    dataPath: string;
    columns: {
      key: string;
      label: string;
      format?: string;
      sortable?: boolean;
    }[];
    pageSize?: number;
    showPagination?: boolean;
  };

  const data = (useDataValue(dataPath) as Record<string, unknown>[]) ?? [];
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        (aVal as number) < (bVal as number)
          ? -1
          : (aVal as number) > (bVal as number)
            ? 1
            : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const pagedData = showPagination
    ? sortedData.slice(page * pageSize, (page + 1) * pageSize)
    : sortedData;

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="canvas-table">
      <div className="canvas-table__wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key, col.sortable)}
                  className={cn(col.sortable && "canvas-table__th--sortable")}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {formatCellValue(
                      row[col.key],
                      col.format as
                        | "text"
                        | "number"
                        | "currency"
                        | "date"
                        | "badge",
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && data.length > pageSize && (
        <div className="canvas-table__pagination">
          <span>
            Showing {page * pageSize + 1}-
            {Math.min((page + 1) * pageSize, data.length)} of {data.length}
          </span>
          <div className="canvas-table__pagination-buttons">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= data.length}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function List({ element }: ComponentRenderProps) {
  const {
    dataPath,
    itemTemplate,
    variant = "default",
  } = element.props as {
    dataPath: string;
    itemTemplate: { primary: string; secondary?: string; icon?: string };
    variant?: "default" | "compact" | "detailed";
  };

  const data = (useDataValue(dataPath) as Record<string, unknown>[]) ?? [];

  return (
    <ul className={cn("canvas-list", `canvas-list--${variant}`)}>
      {data.map((item, index) => (
        <li key={index} className="canvas-list__item">
          {itemTemplate.icon && (
            <span className="canvas-list__icon">
              {String(item[itemTemplate.icon] ?? "")}
            </span>
          )}
          <div className="canvas-list__content">
            <span className="canvas-list__primary">
              {String(item[itemTemplate.primary] ?? "")}
            </span>
            {itemTemplate.secondary && (
              <span className="canvas-list__secondary">
                {String(item[itemTemplate.secondary] ?? "")}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Stat({ element }: ComponentRenderProps) {
  const {
    label,
    valuePath,
    previousPath,
    format = "number",
  } = element.props as {
    label: string;
    valuePath: string;
    previousPath?: string;
    format?: "currency" | "percent" | "number";
  };

  const value = useDataValue(valuePath);
  const previous = previousPath ? useDataValue(previousPath) : null;

  const change =
    previous !== null && Number(previous) !== 0
      ? ((Number(value) - Number(previous)) / Number(previous)) * 100
      : null;

  return (
    <div className="canvas-stat">
      <span className="canvas-stat__label">{label}</span>
      <span className="canvas-stat__value">{formatValue(value, format)}</span>
      {change !== null && (
        <span
          className={cn(
            "canvas-stat__change",
            change >= 0
              ? "canvas-stat__change--positive"
              : "canvas-stat__change--negative",
          )}
        >
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// ============================================================================
// FORM COMPONENTS
// ============================================================================

function Form({ element, children, onAction }: ComponentRenderProps) {
  const { id, submitAction } = element.props as {
    id: string;
    submitAction: Action;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAction?.(submitAction);
  };

  return (
    <form id={id} onSubmit={handleSubmit} className="canvas-form">
      {children}
    </form>
  );
}

function TextField({ element }: ComponentRenderProps) {
  const {
    label,
    valuePath,
    placeholder,
    type = "text",
    validation,
  } = element.props as {
    label: string;
    valuePath: string;
    placeholder?: string;
    type?: "text" | "email" | "password" | "url" | "tel";
    validation?: { fn: string; value?: unknown; message: string }[];
  };

  const [value, setValue] = useDataBinding(valuePath);
  const [error, setError] = useState<string | null>(null);

  const validate = (val: string): string | null => {
    if (!validation) return null;
    for (const rule of validation) {
      if (rule.fn === "required" && !val) return rule.message;
      if (rule.fn === "email" && val && !/\S+@\S+\.\S+/.test(val))
        return rule.message;
      if (rule.fn === "minLength" && val.length < (rule.value as number))
        return rule.message;
      if (rule.fn === "maxLength" && val.length > (rule.value as number))
        return rule.message;
    }
    return null;
  };

  return (
    <div className="canvas-field">
      <label className="canvas-field__label">{label}</label>
      <input
        type={type}
        value={String(value ?? "")}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(validate(e.target.value));
        }}
        onBlur={() => setError(validate(String(value ?? "")))}
        placeholder={placeholder}
        className={cn(
          "canvas-field__input",
          error && "canvas-field__input--error",
        )}
      />
      {error && <p className="canvas-field__error">{error}</p>}
    </div>
  );
}

function TextArea({ element }: ComponentRenderProps) {
  const {
    label,
    valuePath,
    placeholder,
    rows = 4,
  } = element.props as {
    label: string;
    valuePath: string;
    placeholder?: string;
    rows?: number;
  };

  const [value, setValue] = useDataBinding(valuePath);

  return (
    <div className="canvas-field">
      <label className="canvas-field__label">{label}</label>
      <textarea
        value={String(value ?? "")}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="canvas-field__textarea"
      />
    </div>
  );
}

function Select({ element }: ComponentRenderProps) {
  const { label, valuePath, options, placeholder } = element.props as {
    label: string;
    valuePath: string;
    options: { value: string; label: string }[];
    placeholder?: string;
  };

  const [value, setValue] = useDataBinding(valuePath);

  return (
    <div className="canvas-field">
      <label className="canvas-field__label">{label}</label>
      <select
        value={String(value ?? "")}
        onChange={(e) => setValue(e.target.value)}
        className="canvas-field__select"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({ element }: ComponentRenderProps) {
  const { label, valuePath } = element.props as {
    label: string;
    valuePath: string;
  };

  const [value, setValue] = useDataBinding(valuePath);

  return (
    <label className="canvas-checkbox">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => setValue(e.target.checked)}
        className="canvas-checkbox__input"
      />
      <span className="canvas-checkbox__label">{label}</span>
    </label>
  );
}

function RadioGroup({ element }: ComponentRenderProps) {
  const {
    label,
    valuePath,
    options,
    direction = "vertical",
  } = element.props as {
    label: string;
    valuePath: string;
    options: { value: string; label: string }[];
    direction?: "horizontal" | "vertical";
  };

  const [value, setValue] = useDataBinding(valuePath);

  return (
    <div className="canvas-radio-group">
      <span className="canvas-radio-group__label">{label}</span>
      <div
        className={cn(
          "canvas-radio-group__options",
          `canvas-radio-group__options--${direction}`,
        )}
      >
        {options.map((opt) => (
          <label key={opt.value} className="canvas-radio-group__option">
            <input
              type="radio"
              name={valuePath}
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function DatePicker({ element }: ComponentRenderProps) {
  const { label, valuePath, minDate, maxDate, includeTime } = element.props as {
    label: string;
    valuePath: string;
    minDate?: string;
    maxDate?: string;
    includeTime?: boolean;
  };

  const [value, setValue] = useDataBinding(valuePath);

  return (
    <div className="canvas-field">
      <label className="canvas-field__label">{label}</label>
      <input
        type={includeTime ? "datetime-local" : "date"}
        value={String(value ?? "")}
        onChange={(e) => setValue(e.target.value)}
        min={minDate}
        max={maxDate}
        className="canvas-field__input"
      />
    </div>
  );
}

function Slider({ element }: ComponentRenderProps) {
  const {
    label,
    valuePath,
    min,
    max,
    step = 1,
    showValue = true,
  } = element.props as {
    label: string;
    valuePath: string;
    min: number;
    max: number;
    step?: number;
    showValue?: boolean;
  };

  const [value, setValue] = useDataBinding(valuePath);
  const numValue = Number(value ?? min);

  return (
    <div className="canvas-slider">
      <div className="canvas-slider__header">
        <label className="canvas-slider__label">{label}</label>
        {showValue && <span className="canvas-slider__value">{numValue}</span>}
      </div>
      <input
        type="range"
        value={numValue}
        onChange={(e) => setValue(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="canvas-slider__input"
      />
    </div>
  );
}

// ============================================================================
// INTERACTIVE COMPONENTS
// ============================================================================

function Button({ element, onAction }: ComponentRenderProps) {
  const {
    label,
    action,
    variant = "primary",
    size = "md",
    icon,
    loading,
    disabled,
  } = element.props as {
    label: string;
    action: Action;
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    icon?: string;
    loading?: { path: string };
    disabled?: { path: string };
  };

  const isLoading = loading ? Boolean(useDataValue(loading.path)) : false;
  const isDisabled = disabled ? Boolean(useDataValue(disabled.path)) : false;

  return (
    <button
      onClick={() => onAction?.(action)}
      disabled={isLoading || isDisabled}
      className={cn(
        "canvas-button",
        `canvas-button--${variant}`,
        `canvas-button--${size}`,
        (isLoading || isDisabled) && "canvas-button--disabled",
      )}
    >
      {isLoading && <span className="canvas-button__spinner" />}
      {icon && <span className="canvas-button__icon">{icon}</span>}
      {label}
    </button>
  );
}

function Link({ element }: ComponentRenderProps) {
  const {
    label,
    href,
    external = false,
  } = element.props as {
    label: string;
    href: string;
    external?: boolean;
  };

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="canvas-link"
    >
      {label}
      {external && <span className="canvas-link__external">↗</span>}
    </a>
  );
}

function Toggle({ element }: ComponentRenderProps) {
  const { label, valuePath, description } = element.props as {
    label: string;
    valuePath: string;
    description?: string;
  };

  const [value, setValue] = useDataBinding(valuePath);

  return (
    <label className="canvas-toggle">
      <div className="canvas-toggle__content">
        <span className="canvas-toggle__label">{label}</span>
        {description && (
          <span className="canvas-toggle__description">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(value)}
        onClick={() => setValue(!value)}
        className={cn(
          "canvas-toggle__switch",
          Boolean(value) && "canvas-toggle__switch--on",
        )}
      >
        <span className="canvas-toggle__thumb" />
      </button>
    </label>
  );
}

// ============================================================================
// CONTENT COMPONENTS
// ============================================================================

function Text({ element }: ComponentRenderProps) {
  const {
    content,
    variant = "body",
    color,
  } = element.props as {
    content: string;
    variant?: "body" | "caption" | "label" | "heading";
    color?: "default" | "muted" | "success" | "warning" | "error";
  };

  const Component = variant === "heading" ? "h2" : "p";

  return (
    <Component
      className={cn(
        "canvas-text",
        `canvas-text--${variant}`,
        color && `canvas-text--${color}`,
      )}
    >
      {content}
    </Component>
  );
}

function Markdown({ element }: ComponentRenderProps) {
  const { content } = element.props as { content: string };

  return (
    <div className="canvas-markdown">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

function Code({ element }: ComponentRenderProps) {
  const {
    code,
    language = "typescript",
    showLineNumbers = false,
    highlightLines,
  } = element.props as {
    code: string;
    language?: string;
    showLineNumbers?: boolean;
    highlightLines?: number[];
  };

  return (
    <div className="canvas-code">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        wrapLines
        lineProps={(lineNumber: number) => ({
          style: highlightLines?.includes(lineNumber)
            ? { backgroundColor: "rgba(255,255,0,0.1)" }
            : {},
        })}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function Image({ element }: ComponentRenderProps) {
  const {
    src,
    alt,
    width,
    height,
    fit = "cover",
  } = element.props as {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    fit?: "cover" | "contain" | "fill";
  };

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("canvas-image", `canvas-image--${fit}`)}
    />
  );
}

function Divider({ element }: ComponentRenderProps) {
  const { label } = element.props as { label?: string };

  return (
    <div className="canvas-divider">
      {label && <span className="canvas-divider__label">{label}</span>}
    </div>
  );
}

// ============================================================================
// FEEDBACK COMPONENTS
// ============================================================================

function Alert({ element }: ComponentRenderProps) {
  const {
    title,
    message,
    variant = "info",
    dismissible = false,
  } = element.props as {
    title?: string;
    message: string;
    variant?: "info" | "success" | "warning" | "error";
    dismissible?: boolean;
  };

  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={cn("canvas-alert", `canvas-alert--${variant}`)}>
      {title && <h4 className="canvas-alert__title">{title}</h4>}
      <p className="canvas-alert__message">{message}</p>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="canvas-alert__dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Progress({ element }: ComponentRenderProps) {
  const {
    valuePath,
    label,
    showValue = true,
    variant = "bar",
  } = element.props as {
    valuePath: string;
    label?: string;
    showValue?: boolean;
    variant?: "bar" | "circle";
  };

  const value = Number(useDataValue(valuePath) ?? 0);
  const clampedValue = Math.min(100, Math.max(0, value));

  if (variant === "circle") {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (clampedValue / 100) * circumference;

    return (
      <div className="canvas-progress canvas-progress--circle">
        {label && <span className="canvas-progress__label">{label}</span>}
        <svg className="canvas-progress__circle" viewBox="0 0 100 100">
          <circle
            className="canvas-progress__circle-bg"
            cx="50"
            cy="50"
            r="45"
          />
          <circle
            className="canvas-progress__circle-fg"
            cx="50"
            cy="50"
            r="45"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        {showValue && (
          <span className="canvas-progress__value">{clampedValue}%</span>
        )}
      </div>
    );
  }

  return (
    <div className="canvas-progress canvas-progress--bar">
      <div className="canvas-progress__header">
        {label && <span className="canvas-progress__label">{label}</span>}
        {showValue && (
          <span className="canvas-progress__value">{clampedValue}%</span>
        )}
      </div>
      <div className="canvas-progress__track">
        <div
          className="canvas-progress__fill"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

function Badge({ element }: ComponentRenderProps) {
  const { label, variant = "default" } = element.props as {
    label: string;
    variant?: "default" | "success" | "warning" | "error" | "info";
  };

  return (
    <span className={cn("canvas-badge", `canvas-badge--${variant}`)}>
      {label}
    </span>
  );
}

function Empty({ element, onAction }: ComponentRenderProps) {
  const { title, description, icon, action } = element.props as {
    title: string;
    description?: string;
    icon?: string;
    action?: Action;
  };

  return (
    <div className="canvas-empty">
      {icon && <span className="canvas-empty__icon">{icon}</span>}
      <h3 className="canvas-empty__title">{title}</h3>
      {description && (
        <p className="canvas-empty__description">{description}</p>
      )}
      {action && (
        <button
          onClick={() => onAction?.(action)}
          className="canvas-button canvas-button--primary"
        >
          {action.name}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// SPECIAL COMPONENTS
// ============================================================================

function Conditional({ element, children }: ComponentRenderProps) {
  const { visible } = element.props as { visible: unknown };
  const isVisible = useIsVisible(visible as never);

  if (!isVisible) return null;
  return <>{children}</>;
}

function Loop({ element, children }: ComponentRenderProps) {
  const { dataPath, itemKey } = element.props as {
    dataPath: string;
    itemKey: string;
  };

  const data = (useDataValue(dataPath) as Record<string, unknown>[]) ?? [];

  return (
    <>
      {data.map((item, index) => (
        <div key={String(item[itemKey] ?? index)}>{children}</div>
      ))}
    </>
  );
}

// ============================================================================
// REGISTRY EXPORT
// ============================================================================

export const componentRegistry: ComponentRegistry = {
  // Layout
  Card,
  Grid,
  Stack,
  Tabs,
  TabPanel,

  // Data Display
  Metric,
  Chart,
  Table,
  List,
  Stat,

  // Forms
  Form,
  TextField,
  TextArea,
  Select,
  Checkbox,
  RadioGroup,
  DatePicker,
  Slider,

  // Interactive
  Button,
  Link,
  Toggle,

  // Content
  Text,
  Markdown,
  Code,
  Image,
  Divider,

  // Feedback
  Alert,
  Progress,
  Badge,
  Empty,

  // Special
  Conditional,
  Loop,
};
