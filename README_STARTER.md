# Gibson Oil & Gas - React Dashboard Starter Template

A complete, production-ready React dashboard starter template built with modern technologies and best practices. This template provides a solid foundation for building business dashboards without the complexity of authentication dependencies.

![Dashboard Screenshot](https://github.com/user-attachments/assets/eea954a3-6e1d-4c28-84df-838a0614a046)

## 🚀 Features

### ✅ Complete Dashboard System
- **Top Navigation Bar** with clean, intuitive navigation between Dashboard, KPIs, Budget, and Procedures
- **Responsive Design** that works on desktop, tablet, and mobile devices
- **Modern UI Components** built with Tailwind CSS for easy customization

### 📊 Dashboard & Analytics
- **Main Dashboard** with operational and financial KPIs
- **Interactive Charts** using Recharts library (line charts, bar charts, pie charts)
- **Real-time Data Display** with dummy data that can be easily replaced
- **Budget Summary Cards** with variance tracking

### 📈 KPI Management
- **Editable KPI Values** - click any KPI to modify values in real-time
- **Performance Analytics** with calculated ratios and insights
- **Data Export Capabilities** (ready for integration)
- **9 Pre-configured KPIs** including revenue, customers, fuel sales, and more

### 💰 Budget Management
- **Budget vs Actual Tracking** with visual charts
- **Interactive Budget Tables** with editable values
- **Spending Distribution** with pie chart visualization
- **Budget Category Management** - add/remove budget categories dynamically
- **Variance Analysis** with color-coded indicators

### 📋 Procedures Management
- **Video Integration** - support for YouTube, Vimeo, Loom, and custom video URLs
- **Customizable Categories** (Safety, Maintenance, Operations, Training, General)
- **Task Management** - mark procedures as complete, add notes
- **Upload Capabilities** - ready for file upload integration with cloud storage
- **Category Filtering** - organize procedures by type

### 🤖 AI Helper Widget
- **Chat Interface** positioned at bottom-right corner
- **Expandable/Collapsible** with smooth animations
- **Integration Ready** for OpenAI, Microsoft Copilot, or other AI services
- **Demo Responses** to showcase functionality

## 🛠 Tech Stack

- **React 18** - Modern React with hooks and functional components
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework for rapid styling
- **Recharts** - Composable charting library for React
- **Context API** - State management for sharing data across components

## 📁 Project Structure

```
src/
├── starter-components/
│   ├── context/
│   │   └── DashboardContext.jsx    # Global state management
│   ├── pages/
│   │   ├── Dashboard.jsx           # Main dashboard page
│   │   ├── KPIs.jsx               # KPI management page
│   │   ├── Budget.jsx             # Budget management page
│   │   └── Procedures.jsx         # Procedures management page
│   ├── ui/
│   │   ├── Navigation.jsx         # Top navigation component
│   │   └── Card.jsx              # Reusable card components
│   └── widgets/
│       └── AIHelper.jsx           # AI chat widget
├── App_Clean.jsx                  # Main app component (modular version)
├── main_starter.jsx               # Entry point for starter template
└── index.css                     # Global styles with Tailwind
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd KPI-Dashboard
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

4. **Build for production**
```bash
npm run build
```

The application will be available at `http://localhost:5173`

## 🎨 Customization

### Styling
The template uses Tailwind CSS for styling. You can:
- Modify `tailwind.config.js` to customize colors, fonts, and other design tokens
- Update `src/index.css` for global styles
- Replace Tailwind with Material-UI, Chakra UI, or any other CSS framework

### Data Integration
Replace dummy data with real data sources:

1. **KPI Data** - Update `INITIAL_KPI_DATA` in `DashboardContext.jsx`
2. **Chart Data** - Replace dummy arrays in Dashboard and Budget pages
3. **API Integration** - Add data fetching in useEffect hooks

### Adding New Features
- **New Pages** - Add to `src/starter-components/pages/`
- **New Components** - Add to `src/starter-components/ui/`
- **Navigation** - Update navigation items in `Navigation.jsx`

## 🔌 Integration Examples

### Database Integration
```javascript
// Example: Replace dummy data with API calls
useEffect(() => {
  async function fetchKPIs() {
    const response = await fetch('/api/kpis');
    const data = await response.json();
    setKpiData(data);
  }
  fetchKPIs();
}, []);
```

### AI Helper Integration
```javascript
// Example: Integrate with OpenAI
const sendMessage = async () => {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: inputText })
  });
  const aiResponse = await response.json();
  // Handle AI response
};
```

### File Upload Integration
```javascript
// Example: Add file upload for procedures
const handleFileUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  return result.url;
};
```

## 🎯 Use Cases

This template is perfect for:
- **Business Dashboards** - Financial, operational, and performance tracking
- **Oil & Gas Companies** - Fuel sales, equipment monitoring, safety procedures
- **Manufacturing** - Production KPIs, equipment maintenance, quality control
- **Retail** - Sales analytics, inventory management, store performance
- **Service Industries** - Customer metrics, service delivery, financial tracking

## 🔧 Advanced Configuration

### Environment Variables
Create a `.env` file for configuration:
```env
VITE_API_BASE_URL=https://your-api.com
VITE_OPENAI_API_KEY=your-openai-key
VITE_COMPANY_NAME="Your Company Name"
```

### Chart Customization
Modify chart colors and styling in component files:
```javascript
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
```

### Adding Authentication
To add authentication back:
1. Install authentication library (Firebase, Auth0, Supabase)
2. Wrap components with auth providers
3. Add login/logout functionality
4. Protect routes as needed

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For questions or support, please open an issue in the GitHub repository.

---

**Built with ❤️ for the React community**