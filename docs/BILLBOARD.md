# Billboard Feature Documentation

## Overview

The Billboard feature provides a NASDAQ-style live ticker display that aggregates metrics from Service Tracking and Delivery Tickets. It's designed for display on TV screens or monitors to provide real-time operational visibility.

## Features

- **Live Ticker**: Scrolling marquee with key metrics
- **Metric Cards**: Large, easy-to-read KPI cards
- **Week Comparison**: Visual meter comparing This Week vs Last Week performance
- **Auto-refresh**: Configurable polling interval
- **TV Mode**: Full-screen display optimized for TV screens
- **Dark Theme**: Professional dark theme optimized for displays

## Usage

### Accessing the Billboard

Navigate to the Billboard tab in the main dashboard navigation.

### TV Mode

To open the Billboard in TV mode:

1. Click the **📺 Open TV Mode** button in the Billboard page header
2. A new window will open in a larger size optimized for TV displays
3. The browser will attempt to enter fullscreen mode automatically
4. TV mode hides the header and navigation for a cleaner display

Alternatively, you can access TV mode directly by adding `?tv=1` to the Billboard URL:
```
/billboard?tv=1
```

### Manual Refresh

Click the **🔄 Refresh** button in the header to manually refresh the data.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

#### BILLBOARD_REFRESH_SEC

Controls how often the Billboard auto-refreshes data (in seconds).

**Default**: 30 seconds

**Example**:
```bash
VITE_BILLBOARD_REFRESH_SEC=30
```

#### BILLBOARD_TV_TOKEN (Optional)

Optional token for securing TV mode access. When set, the TV mode will validate this token.

**Example**:
```bash
VITE_BILLBOARD_TV_TOKEN=your-secret-token-here
```

**Note**: For Vite-based React apps, environment variables must be prefixed with `VITE_` to be accessible in the browser.

### Query Parameters

You can override the refresh interval using a query parameter:

```
/billboard?refresh=15
```

This will refresh the data every 15 seconds instead of the default or configured interval.

## Testing Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root with your Supabase credentials and Billboard settings:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BILLBOARD_REFRESH_SEC=30
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Access Billboard

Open your browser and navigate to:
```
http://localhost:5173/billboard
```

Or for TV mode:
```
http://localhost:5173/billboard?tv=1
```

### 5. Test Different Refresh Intervals

```
http://localhost:5173/billboard?refresh=5
```

## Data Sources

The Billboard aggregates data from:

### Service Tracking
- **Table**: `service_jobs`
- **Metrics**:
  - Completed services count
  - Scheduled services count
  - Deferred services count
  - Completed revenue (sum of `job_amount` for completed jobs)
  - Pipeline revenue (sum of `job_amount` for scheduled/in-progress jobs)

### Delivery Tickets
- **Table**: `delivery_tickets`
- **Metrics**:
  - Total tickets count
  - Total gallons delivered (sum of `gallons_delivered`)
  - Revenue (sum of `amount`)

### Week Comparison
- Compares This Week (Monday-Sunday) vs Last Week
- Calculates percent change
- Color-coded indicator:
  - **Green**: >110% (strong growth)
  - **Amber**: 90-110% (stable)
  - **Red**: <90% (needs attention)

## API Endpoint

The Billboard uses a client-side API module at:
```
src/pages/api/billboard-summary.js
```

### Response Structure

```json
{
  "serviceTracking": {
    "completed": 42,
    "scheduled": 18,
    "deferred": 3,
    "completedRevenue": 125000.00,
    "pipelineRevenue": 45000.00
  },
  "deliveryTickets": {
    "totalTickets": 156,
    "totalGallons": 45230.5,
    "revenue": 89450.75
  },
  "weekCompare": {
    "thisWeekTotalRevenue": 214450.75,
    "lastWeekTotalRevenue": 198320.50,
    "percentChange": 8.1
  },
  "lastUpdated": "2025-10-23T15:30:00.000Z"
}
```

### Caching

The API implements a 15-second in-memory cache to prevent excessive database queries. This can be configured or moved to Redis for production use.

## Troubleshooting

### Billboard Not Loading Data

1. Check browser console for errors
2. Verify Supabase credentials are correct
3. Ensure the `service_jobs` and `delivery_tickets` tables exist
4. Check database permissions for the authenticated user

### Auto-refresh Not Working

1. Verify `VITE_BILLBOARD_REFRESH_SEC` is set correctly
2. Check browser console for JavaScript errors
3. Ensure the page hasn't lost focus (some browsers throttle timers)

### TV Mode Not Going Fullscreen

- Fullscreen API requires user interaction in most browsers
- Try clicking the TV Mode button rather than navigating directly
- Some browsers block fullscreen on page load for security reasons
- Check browser console for fullscreen API errors

## Performance Considerations

### Database Queries

- The Billboard queries are filtered by date range (This Week and Last Week)
- Ensure indexes exist on `job_date` and `delivery_date` columns for optimal performance
- The 15-second cache reduces database load significantly

### Browser Performance

- The ticker animation uses CSS transforms for 60fps performance
- Hardware acceleration is enabled via `will-change: transform`
- TV mode is optimized for 1920x1080 displays

## Security Notes

- The Billboard respects Supabase Row Level Security (RLS) policies
- All queries filter by the authenticated user's `created_by` field
- Consider implementing the optional `BILLBOARD_TV_TOKEN` for public displays
- For truly public displays, consider creating a read-only service account

## Future Enhancements

Potential improvements noted in code TODOs:

- [ ] WebSocket support for real-time updates (avoid polling)
- [ ] Redis caching for distributed deployments
- [ ] Additional metrics and customization options
- [ ] Historical trend charts
- [ ] Alert thresholds for critical metrics
- [ ] Export/snapshot functionality

## Support

For issues or questions, please refer to the main project README or open an issue in the repository.
