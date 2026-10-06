type Metric = {
  value: string;
  label: string;
};

type MetricStripProps = {
  items: Metric[];
};

export function MetricStrip({ items }: MetricStripProps) {
  return (
    <div className="metric-strip" aria-label="Belangrijkste uitgangspunten">
      {items.map((item) => (
        <div className="metric-item" key={`${item.value}-${item.label}`}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
