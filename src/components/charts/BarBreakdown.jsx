import React from 'react';
import Chart from 'react-apexcharts';

/**
 * Professional stacked/side-by-side bar chart for per-truck/per-product breakdown.
 * Uses ApexCharts with professional styling.
 */
export default function BarBreakdown({ 
  categories = [],
  series = [],
  title = "",
  height = 300,
  stacked = true,
  horizontal = false,
  colors = ['#0B6E99', '#00A99D', '#F5A623', '#9333EA', '#DC2626', '#16A34A', '#0891B2'],
  yAxisFormatter = (val) => val?.toLocaleString() || '0'
}) {
  const options = {
    chart: {
      type: 'bar',
      height: height,
      stacked: stacked,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        }
      },
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      dropShadow: {
        enabled: false
      }
    },
    plotOptions: {
      bar: {
        horizontal: horizontal,
        columnWidth: '70%',
        borderRadius: 4,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors: colors,
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: true,
      width: 1,
      colors: ['#ffffff']
    },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          colors: '#6B7280',
          fontSize: '11px'
        },
        rotate: horizontal ? 0 : -45,
        rotateAlways: !horizontal && categories.length > 10
      },
      axisBorder: {
        show: true,
        color: '#E5E7EB'
      },
      axisTicks: {
        show: true,
        color: '#E5E7EB'
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#6B7280',
          fontSize: '11px'
        },
        formatter: yAxisFormatter
      }
    },
    grid: {
      borderColor: '#F3F4F6',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: horizontal
        }
      },
      yaxis: {
        lines: {
          show: !horizontal
        }
      }
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      y: {
        formatter: yAxisFormatter
      },
      style: {
        fontSize: '12px'
      }
    },
    legend: {
      show: series.length > 1,
      position: 'top',
      horizontalAlign: 'left',
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
        horizontal: 12,
        vertical: 4
      }
    },
    fill: {
      opacity: 1
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <Chart 
        options={options} 
        series={series} 
        type="bar" 
        height={height} 
      />
    </div>
  );
}
