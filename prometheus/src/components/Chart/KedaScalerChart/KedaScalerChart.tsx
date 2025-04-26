import { alpha, useTheme } from '@mui/material';
import { green } from '@mui/material/colors';
import { fetchMetrics } from '../../../request';
import { createTickTimestampFormatter, dataProcessor } from '../../../util';
import Chart from '../Chart/Chart';

/**
 * Props for the KedaScalerChart component
 * @interface KedaScalerChartProps
 * @property {string} query - The Prometheus query to fetch KEDA trigger metrics
 * @property {string} prometheusPrefix - The prefix for Prometheus metrics
 * @property {string} interval - The time interval for data points
 * @property {boolean} autoRefresh - Whether to automatically refresh the chart data
 */
interface KedaScalerChartProps {
  query: string;
  prometheusPrefix: string;
  interval: string;
  autoRefresh: boolean;
}

export function KedaScalerChart(props: KedaScalerChartProps) {
  const xTickFormatter = createTickTimestampFormatter(props.interval);
  const theme = useTheme();

  const XTickProps = {
    dataKey: 'timestamp',
    tickLine: false,
    tick: props => {
      const value = xTickFormatter(props.payload.value);
      return (
        value !== '' && (
          <g
            transform={`translate(${props.x},${props.y})`}
            fill={theme.palette.chartStyles.labelColor}
          >
            <text x={0} y={10} dy={0} textAnchor="middle">
              {value}
            </text>
          </g>
        )
      );
    },
  };

  const YTickProps = {
    domain: [0, 'auto'],
    width: 60,
    allowDecimals: false,
  };

  const KedaTooltip = props => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const formatter = createTickTimestampFormatter(props.interval);

      return (
        <div
          className="custom-tooltip"
          style={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            padding: theme.spacing(1),
            borderRadius: theme.shape.borderRadius,
          }}
        >
          <p className="label">{`Time: ${formatter(label)}`}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }}>
              {`${p.name}: ${p.value}`}
              {data.metadata && data.metadata.metric && (
                <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  {`Metric: ${data.metadata.metric}`}
                  {data.metadata.triggerIndex !== undefined &&
                    `, Trigger: ${data.metadata.triggerIndex}`}
                  {data.metadata.scaler && `, Scaler: ${data.metadata.scaler}`}
                </span>
              )}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Chart
      plots={[
        {
          query: props.query,
          name: 'Trigger value',
          strokeColor: alpha(green[600], 0.8),
          fillColor: alpha(green[400], 0.1),
          dataProcessor: dataProcessor,
        },
      ]}
      xAxisProps={XTickProps}
      yAxisProps={YTickProps}
      CustomTooltip={KedaTooltip}
      fetchMetrics={fetchMetrics}
      {...props}
    />
  );
}
