import React from 'react';
import Chart from 'react-apexcharts';

/**
 * Professional donut/pie chart for product or truck market share.
 * Uses ApexCharts with professional styling and tooltips.
 */
export default function DonutChart({ 
  labels = [],
  series = [],
  title = "",
  height = 300,
  colors = ['#0B6E99', '#00A99D', '#F5A623', '#9333EA', '#DC2626', '#16A34A', '#0891B2']
}) {
  const options = {
    chart: {
      type: 'donut',
      height: height,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      dropShadow: {
        enabled: true,
        top: 2,
        left: 0,
        blur: 4,
        opacity: 0.1
      }
    },
    colors: colors,
    labels: labels,
    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return val.toFixed(1) + "%";
      },
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: ['#ffffff']
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 1,
        opacity: 0.5
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontWeight: 600,
              color: '#1F2937'
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 700,
              color: '#111827',
              formatter: function (val) {
                return parseFloat(val).toLocaleString();
              }
            },
            total: {
              show: true,
              label: title || 'Total',
              fontSize: '14px',
              fontWeight: 600,
              color: '#6B7280',
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString();
              }
            }
          }
        }
      }
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '12px',
      fontWeight: 500,
      labels: {
        colors: '#6B7280'
      },
      markers: {
        width: 12,
        height: 12,
        radius: 3
      },
      itemMargin: {
        horizontal: 8,
        vertical: 4
      }
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      y: {
        formatter: function(val) {
          return val.toLocaleString();
        }
      },
      style: {
        fontSize: '12px'
      }
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['#ffffff']
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <Chart 
        options={options} 
        series={series} 
        type="donut" 
        height={height} 
      />
    </div>
  );
}
