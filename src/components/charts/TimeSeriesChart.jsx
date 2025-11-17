import React from 'react';
import Chart from 'react-apexcharts';

/**
 * Professional time series area/line chart for revenue, gallons, etc.
 * Uses ApexCharts for smooth rendering and professional tooltips.
 */
export default function TimeSeriesChart({ 
  data = [], 
  categories = [],
  title = "",
  height = 300,
  type = "area", // 'area' or 'line'
  color = "#0B6E99",
  yAxisFormatter = (val) => val?.toLocaleString() || '0'
}) {
  const series = [{
    name: title,
    data: data
  }];

  const options = {
    chart: {
      type: type,
      height: height,
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
        enabled: true,
        top: 2,
        left: 0,
        blur: 4,
        opacity: 0.1
      }
    },
    colors: [color],
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          colors: '#6B7280',
          fontSize: '11px'
        },
        rotate: -45,
        rotateAlways: categories.length > 15
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
          show: true
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      x: {
        show: true
      },
      y: {
        formatter: yAxisFormatter
      },
      style: {
        fontSize: '12px'
      }
    },
    legend: {
      show: false
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <Chart 
        options={options} 
        series={series} 
        type={type} 
        height={height} 
      />
    </div>
  );
}
